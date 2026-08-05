import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  GATE_STEPS,
  MAP_EDGES,
  MAP_NODES,
  RECEIPTS,
  canExtendRoute,
  directionAngle,
  isCorrectReceiptOrder,
  isCorrectRoute,
  normalizeRotation,
  requiredMapRotation,
  type Turn,
} from "./game/p01";
import { clearGame, loadGame, saveGame, type GamePhase, type SavedGame } from "./game/save";

const DEFAULT_GAME: SavedGame = {
  phase: "landing",
  selectedReceipts: [],
  route: ["impound"],
  gateIndex: 0,
  mapRotation: 0,
  attempts: 0,
  updatedAt: Date.now(),
};

const PHASE_PROGRESS: Record<GamePhase, number> = {
  landing: 0,
  intro: 6,
  receipts: 25,
  route: 52,
  gates: 76,
  success: 100,
};

const DIRECTION_NAME = { N: "북쪽", E: "동쪽", S: "남쪽", W: "서쪽" } as const;
const TURN_NAME: Record<Turn, string> = { left: "왼쪽", straight: "직진", right: "오른쪽" };

function playTone(frequency = 440, duration = 0.08) {
  try {
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = frequency;
    oscillator.type = "sine";
    gain.gain.setValueAtTime(0.06, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration);
    oscillator.addEventListener("ended", () => void context.close());
  } catch {
    // Audio is optional; mobile browsers may refuse it before a user gesture.
  }
}

function BoardMark() {
  const positions = [
    [1, 1], [2, 1], [3, 1], [4, 1], [4, 2], [4, 3],
    [4, 4], [3, 4], [2, 4], [1, 4], [1, 3], [1, 2],
  ];
  return (
    <div className="hero-board" aria-hidden="true">
      {positions.map(([column, row], index) => (
        <span className={`hero-tile tile-${index % 4}`} style={{ gridColumn: column, gridRow: row }} key={`${column}-${row}`} />
      ))}
      <div className="hero-bank">
        <span>ZERO</span>
        <strong>CITY</strong>
      </div>
      <div className="pawn pawn-one" />
      <div className="pawn pawn-two" />
    </div>
  );
}

function GameHeader({ phase, onReset }: { phase: GamePhase; onReset: () => void }) {
  const label = phase === "success" ? "탈출 경로 확보" : "파산 카운터 작동 중";
  return (
    <header className="game-header">
      <div>
        <span className="eyebrow">EP.01 · ZERO CITY</span>
        <strong>{label}</strong>
      </div>
      <button className="text-button" type="button" onClick={onReset}>처음부터</button>
      <div className="progress-track" aria-label={`P01 진행률 ${PHASE_PROGRESS[phase]}%`}>
        <span style={{ width: `${PHASE_PROGRESS[phase]}%` }} />
      </div>
    </header>
  );
}

function HintBox({ phase }: { phase: GamePhase }) {
  const hints: Partial<Record<GamePhase, string[]>> = {
    receipts: [
      "영수증 앞면의 색이 아니라 뒷면 인장과 종 전·후 시간을 보세요.",
      "23시 종을 기준으로 전은 음수, 후는 양수처럼 한 줄에 놓을 수 있습니다.",
      "동백 → 시계 → 항만 → 구름 → 은행 순서입니다.",
    ],
    route: [
      "영수증에서 확정한 역을 지도에서 같은 순서로 찾으세요.",
      "압류 테이프가 붙은 길은 폐쇄됐습니다. 현재 말과 직접 이어진 열린 길만 선택하세요.",
      "출발 → 동백 → 시계 → 항만 → 구름 → 은행입니다.",
    ],
    gates: [
      "검표대마다 말이 들어온 방향을 먼저 확인하세요.",
      "지도를 돌려 진행 화살표가 화면 위의 말 코와 일치해야 좌우를 읽을 수 있습니다.",
      "입력열은 왼쪽 → 직진 → 오른쪽 → 왼쪽 → 오른쪽입니다.",
    ],
  };
  const current = hints[phase];
  if (!current) return null;
  return (
    <details className="hint-box">
      <summary>규칙 감사관의 힌트</summary>
      <ol>{current.map((hint) => <li key={hint}>{hint}</li>)}</ol>
    </details>
  );
}

function ReceiptPuzzle({ game, update, setFeedback }: ScreenProps) {
  const available = RECEIPTS.filter((receipt) => !game.selectedReceipts.includes(receipt.id));
  const chosen = game.selectedReceipts.map((id) => RECEIPTS.find((receipt) => receipt.id === id)!).filter(Boolean);

  const addReceipt = (id: string) => {
    playTone(520);
    update({ selectedReceipts: [...game.selectedReceipts, id] });
    setFeedback("영수증을 시간축에 놓았습니다.");
  };

  const submit = () => {
    if (!isCorrectReceiptOrder(game.selectedReceipts)) {
      update({ attempts: game.attempts + 1 });
      setFeedback("시간 순서가 맞지 않습니다. 종 전·후 표식을 다시 확인하세요.");
      playTone(180, 0.15);
      return;
    }
    playTone(740, 0.16);
    update({ phase: "route", route: ["impound"] });
    setFeedback("통행 시각 복원 완료. 노선도에 경로를 표시하세요.");
  };

  return (
    <section className="screen puzzle-screen" aria-labelledby="receipt-title">
      <div className="scene-title">
        <span className="step-chip">01-A · 기록 복원</span>
        <h1 id="receipt-title">마지막 통행을<br />시간순으로 놓아라</h1>
        <p>광장 종은 23시에 한 번 울렸다. 영수증의 인장과 종 전·후 표식을 대조하자.</p>
      </div>

      <div className="bell-reference"><span className="bell-icon">◆</span><strong>광장 종 · 23:00</strong><small>왼쪽은 종 전, 오른쪽은 종 후</small></div>

      <div className="timeline-slots" aria-label="선택한 영수증 순서">
        {Array.from({ length: 5 }).map((_, index) => {
          const receipt = chosen[index];
          return (
            <div className={`timeline-slot ${receipt ? "filled" : ""}`} key={index}>
              <span>{index + 1}</span>
              {receipt ? <><strong>{receipt.station}</strong><small>{receipt.timeLabel}</small></> : <em>빈 자리</em>}
            </div>
          );
        })}
      </div>

      <div className="receipt-stack" aria-label="남은 통행료 영수증">
        {available.map((receipt) => (
          <button className="receipt-card" type="button" key={receipt.id} onClick={() => addReceipt(receipt.id)}>
            <span className="receipt-seal">{receipt.seal}</span>
            <span><strong>{receipt.station}</strong><small>{receipt.timeLabel}</small></span>
            <b>선택</b>
          </button>
        ))}
        {available.length === 0 && <p className="empty-note">모든 영수증을 배치했습니다.</p>}
      </div>

      <div className="button-row">
        <button className="secondary-button" type="button" disabled={!chosen.length} onClick={() => update({ selectedReceipts: game.selectedReceipts.slice(0, -1) })}>하나 되돌리기</button>
        <button className="primary-button" type="button" disabled={chosen.length !== 5} onClick={submit}>기록 확정</button>
      </div>
      <HintBox phase="receipts" />
    </section>
  );
}

type ScreenProps = {
  game: SavedGame;
  update: (patch: Partial<SavedGame>) => void;
  setFeedback: (message: string) => void;
};

function edgeStyle(fromId: string, toId: string): CSSProperties {
  const from = MAP_NODES.find((node) => node.id === fromId)!;
  const to = MAP_NODES.find((node) => node.id === toId)!;
  const coordinate = (value: number) => 8 + value * 21;
  const x1 = coordinate(from.x);
  const y1 = coordinate(from.y);
  const x2 = coordinate(to.x);
  const y2 = coordinate(to.y);
  if (y1 === y2) return { left: `${Math.min(x1, x2)}%`, top: `${y1}%`, width: `${Math.abs(x2 - x1)}%` };
  return { left: `${x1}%`, top: `${Math.min(y1, y2)}%`, height: `${Math.abs(y2 - y1)}%` };
}

function RoutePuzzle({ game, update, setFeedback }: ScreenProps) {
  const clickNode = (nodeId: string) => {
    if (game.route[game.route.length - 1] === nodeId) return;
    if (!canExtendRoute(game.route, nodeId)) {
      setFeedback("그 방향은 폐쇄됐거나 현재 위치와 이어지지 않습니다.");
      playTone(170, 0.12);
      return;
    }
    playTone(500 + game.route.length * 45);
    update({ route: [...game.route, nodeId] });
    setFeedback(`${MAP_NODES.find((node) => node.id === nodeId)?.label} 통과.`);
  };

  const submit = () => {
    if (!isCorrectRoute(game.route)) {
      update({ attempts: game.attempts + 1 });
      setFeedback("영수증 순서와 경로가 일치하지 않습니다.");
      playTone(180, 0.15);
      return;
    }
    update({ phase: "gates", gateIndex: 0, mapRotation: 0 });
    setFeedback("경로 확인 완료. 각 검표문을 말 기준으로 읽으세요.");
    playTone(760, 0.16);
  };

  return (
    <section className="screen puzzle-screen" aria-labelledby="route-title">
      <div className="scene-title">
        <span className="step-chip">01-B · 노선 추적</span>
        <h1 id="route-title">영수증의 역을<br />열린 길로 이어라</h1>
        <p>현재 말에서 시작해 다음 역을 탭하자. 사선 압류 테이프가 붙은 길은 폐쇄됐다.</p>
      </div>

      <div className="route-summary" aria-label="복원된 방문 순서">동백 <i>›</i> 시계 <i>›</i> 항만 <i>›</i> 구름 <i>›</i> 은행</div>
      <div className="map-board" aria-label="제로 시티 노선도">
        <div className="map-north">N</div>
        {MAP_EDGES.map((edge) => {
          const from = MAP_NODES.find((node) => node.id === edge.from)!;
          const to = MAP_NODES.find((node) => node.id === edge.to)!;
          const vertical = from.x === to.x;
          return <span key={`${edge.from}-${edge.to}`} className={`map-road ${vertical ? "vertical" : "horizontal"} ${edge.blocked ? "blocked" : ""}`} style={edgeStyle(edge.from, edge.to)} />;
        })}
        {MAP_NODES.map((node) => {
          const selectedIndex = game.route.indexOf(node.id);
          return (
            <button
              key={node.id}
              className={`map-node ${node.kind} ${selectedIndex >= 0 ? "selected" : ""}`}
              style={{ left: `${8 + node.x * 21}%`, top: `${8 + node.y * 21}%` }}
              type="button"
              onClick={() => clickNode(node.id)}
              aria-label={`${node.label}${selectedIndex >= 0 ? `, 경로 ${selectedIndex + 1}번째` : ""}`}
            >
              {selectedIndex >= 0 && <span>{selectedIndex + 1}</span>}
              <strong>{node.shortLabel}</strong>
            </button>
          );
        })}
      </div>

      <div className="route-log">현재 경로 · {game.route.map((id) => MAP_NODES.find((node) => node.id === id)?.shortLabel).join(" → ")}</div>
      <div className="button-row">
        <button className="secondary-button" type="button" disabled={game.route.length <= 1} onClick={() => update({ route: game.route.slice(0, -1) })}>한 칸 되돌리기</button>
        <button className="primary-button" type="button" disabled={game.route.length !== 6} onClick={submit}>경로 확정</button>
      </div>
      <HintBox phase="route" />
    </section>
  );
}

function GatePuzzle({ game, update, setFeedback }: ScreenProps) {
  const step = GATE_STEPS[game.gateIndex];
  const required = requiredMapRotation(step.incoming);
  const aligned = normalizeRotation(game.mapRotation) === required;

  const rotate = (amount: number) => {
    playTone(360);
    update({ mapRotation: normalizeRotation(game.mapRotation + amount) });
    setFeedback("노선도를 90도 회전했습니다.");
  };

  const chooseTurn = (turn: Turn) => {
    if (!aligned) return;
    if (turn !== step.answer) {
      update({ attempts: game.attempts + 1 });
      setFeedback("검표 불일치. 말의 앞을 기준으로 다시 보세요.");
      playTone(160, 0.16);
      return;
    }
    playTone(620 + game.gateIndex * 55, 0.14);
    if (game.gateIndex === GATE_STEPS.length - 1) {
      update({ phase: "success", gateIndex: GATE_STEPS.length, mapRotation: 0 });
      setFeedback("모든 검표문이 일치했습니다. 회전문이 열립니다.");
      return;
    }
    update({ gateIndex: game.gateIndex + 1, mapRotation: 0 });
    setFeedback("검표 완료. 다음 문으로 이동합니다.");
  };

  return (
    <section className="screen puzzle-screen gate-screen" aria-labelledby="gate-title">
      <div className="scene-title compact">
        <span className="step-chip">01-C · 상대 기준 판독</span>
        <h1 id="gate-title">말의 코가<br />언제나 위</h1>
        <p>지도를 돌려 말이 들어온 방향을 위로 맞춘 뒤, 다음 길이 왼쪽·앞·오른쪽 중 어디인지 입력하자.</p>
      </div>

      <div className="gate-progress" aria-label={`검표문 ${game.gateIndex + 1} / 5`}>
        {GATE_STEPS.map((item, index) => <span className={index < game.gateIndex ? "done" : index === game.gateIndex ? "active" : ""} key={item.station}>{index + 1}</span>)}
      </div>

      <div className="gate-console">
        <div className="gate-label"><small>현재 검표문</small><strong>{step.station}</strong></div>
        <div className="pawn-nose"><i />말의 코</div>
        <div className={`rotation-ring ${aligned ? "aligned" : ""}`}>
          <div className="map-disc" style={{ transform: `rotate(${game.mapRotation}deg)` }}>
            <span className="disc-north">N</span>
            <i className="direction-spoke incoming" style={{ transform: `translateX(-50%) rotate(${directionAngle(step.incoming)}deg)` }}><b>진행</b></i>
            <i className="direction-spoke outgoing" style={{ transform: `translateX(-50%) rotate(${directionAngle(step.outgoing)}deg)` }}><b>다음</b></i>
            <div className="disc-center">말</div>
          </div>
        </div>
        <div className="rotation-readout">
          <span>진입 {DIRECTION_NAME[step.incoming]}</span>
          <strong>{aligned ? "기준 정렬 완료" : `지도 ${game.mapRotation}°`}</strong>
          <span>출구 {DIRECTION_NAME[step.outgoing]}</span>
        </div>
        <div className="rotate-controls">
          <button type="button" onClick={() => rotate(-90)} aria-label="지도를 왼쪽으로 90도 회전">↶ 왼쪽 회전</button>
          <button type="button" onClick={() => rotate(90)} aria-label="지도를 오른쪽으로 90도 회전">오른쪽 회전 ↷</button>
        </div>
      </div>

      <p className={`alignment-message ${aligned ? "ready" : ""}`}>{aligned ? "말의 코와 진행 방향이 일치했습니다. 다음 길을 입력하세요." : "진행 표식을 화면 위의 말 코에 맞추세요."}</p>
      <div className="turn-controls">
        {(["left", "straight", "right"] as Turn[]).map((turn) => (
          <button type="button" key={turn} disabled={!aligned} onClick={() => chooseTurn(turn)}>
            <span>{turn === "left" ? "←" : turn === "right" ? "→" : "↑"}</span>{TURN_NAME[turn]}
          </button>
        ))}
      </div>
      <HintBox phase="gates" />
    </section>
  );
}

export function App() {
  const [game, setGame] = useState<SavedGame>(DEFAULT_GAME);
  const [resumeGame, setResumeGame] = useState<SavedGame | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [feedback, setFeedback] = useState("게임 준비 완료");

  useEffect(() => {
    loadGame().then((saved) => {
      if (saved && saved.phase !== "landing") setResumeGame(saved);
    }).catch(() => setFeedback("저장 데이터를 읽지 못했지만 게임은 진행할 수 있습니다.")).finally(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (!hydrated || game.phase === "landing") return;
    void saveGame({ ...game, updatedAt: Date.now() });
  }, [game, hydrated]);

  const update = (patch: Partial<SavedGame>) => setGame((current) => ({ ...current, ...patch, updatedAt: Date.now() }));

  const startNew = async () => {
    await clearGame().catch(() => undefined);
    playTone(460, 0.1);
    setResumeGame(null);
    setGame({ ...DEFAULT_GAME, phase: "intro", updatedAt: Date.now() });
    setFeedback("제로 시티와 연결됐습니다.");
  };

  const reset = () => {
    if (!window.confirm("현재 P01 진행을 지우고 처음 화면으로 돌아갈까요?")) return;
    void clearGame();
    setResumeGame(null);
    setGame({ ...DEFAULT_GAME, updatedAt: Date.now() });
    setFeedback("진행을 초기화했습니다.");
  };

  const continueGame = () => {
    if (!resumeGame) return;
    playTone(520, 0.1);
    setGame(resumeGame);
    setFeedback("저장된 검표 기록을 불러왔습니다.");
  };

  const screen = useMemo(() => {
    const props: ScreenProps = { game, update, setFeedback };
    if (game.phase === "receipts") return <ReceiptPuzzle {...props} />;
    if (game.phase === "route") return <RoutePuzzle {...props} />;
    if (game.phase === "gates") return <GatePuzzle {...props} />;
    return null;
  }, [game]);

  if (game.phase === "landing") {
    return (
      <main className="app-shell landing-screen">
        <div className="ambient-grid" />
        <section className="landing-content">
          <span className="eyebrow">MOBILE ESCAPE · EPISODE 01</span>
          <BoardMark />
          <div className="title-block">
            <p>무한 라운드</p>
            <h1>제로 시티<br /><em>탈출</em></h1>
            <span>규칙은 감옥이다. 읽을 수 있다면, 문도 있다.</span>
          </div>
          <div className="landing-actions">
            <button className="primary-button large" type="button" onClick={startNew}>새 게임 시작</button>
            {resumeGame && <button className="secondary-button large" type="button" onClick={continueGame}>저장 지점에서 계속</button>}
          </div>
          <div className="feature-row"><span>자동 저장</span><span>세로 화면</span><span>오프라인 지원</span></div>
          {!hydrated && <p className="loading-copy">저장 기록을 확인하는 중…</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <GameHeader phase={game.phase} onReset={reset} />
      {game.phase === "intro" && (
        <section className="screen intro-screen">
          <div className="impound-door" aria-hidden="true"><div className="door-slot" /><div className="pawn-shadow" /></div>
          <span className="step-chip">SYSTEM MESSAGE</span>
          <h1>당신은 이제<br />도시의 말입니다.</h1>
          <div className="system-copy">
            <p>은행장의 파산 카운터가 한 바퀴 돌면 당신의 이름은 지워진다.</p>
            <p>압류역 회전문은 미정산 말의 마지막 통행 기록만 인정한다.</p>
          </div>
          <button className="primary-button large" type="button" onClick={() => { update({ phase: "receipts" }); setFeedback("영수증 다섯 장을 발견했습니다."); playTone(560); }}>압류역 조사하기</button>
        </section>
      )}
      {screen}
      {game.phase === "success" && (
        <section className="screen success-screen">
          <div className="open-gate" aria-hidden="true"><span /><span /><div className="light-path" /></div>
          <span className="step-chip success">P01 COMPLETE</span>
          <h1>회전문이<br />열렸다.</h1>
          <p>검표함에서 황동 도구가 떨어졌다.</p>
          <div className="reward-card"><div className="ticket-punch"><i /><b /></div><span><small>획득한 도구</small><strong>검표 펀치</strong><em>다른 표식에도 같은 홈이 있을지 모른다.</em></span></div>
          <div className="next-episode"><span>다음 구역</span><strong>P02 · 저당 등기 차분</strong><small>현재 프로토타입은 P01까지 플레이할 수 있습니다.</small></div>
          <button className="secondary-button large" type="button" onClick={reset}>처음 화면으로</button>
        </section>
      )}
      <div className="feedback-bar" role="status" aria-live="polite">{feedback}<span>저장됨</span></div>
    </main>
  );
}
