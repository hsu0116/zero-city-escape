import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  EMPTY_SCAN_SLOTS,
  END_MARK,
  PROPERTIES,
  RECEIPTS,
  START_MARK,
  currentRent,
  isCorrectWord,
  normalizeRotation,
  validateScan,
  type ScanSlot,
} from "./game/p01";
import { clearGame, loadGame, saveGame, type GamePhase, type SavedGame } from "./game/save";

const DEFAULT_GAME: SavedGame = {
  phase: "landing",
  activeEvidence: "receipts",
  viewedEvidence: [],
  scanSlots: EMPTY_SCAN_SLOTS.map((slot) => ({ ...slot })),
  wordInput: "",
  attempts: 0,
  hintsOpened: 0,
  updatedAt: Date.now(),
};

const PHASE_PROGRESS: Record<GamePhase, number> = {
  landing: 0,
  intro: 7,
  investigation: 28,
  projection: 82,
  success: 100,
};

const DIRECTION_NAME = { N: "북", E: "동", S: "남", W: "서" } as const;

function playTone(frequency = 440, duration = 0.08) {
  try {
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = frequency;
    oscillator.type = "sine";
    gain.gain.setValueAtTime(0.055, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration);
    oscillator.addEventListener("ended", () => void context.close());
  } catch {
    // Sound is optional. Every cue also has a visible equivalent.
  }
}

function BoardMark() {
  const positions = [[1, 1], [2, 1], [3, 1], [4, 1], [4, 2], [4, 3], [4, 4], [3, 4], [2, 4], [1, 4], [1, 3], [1, 2]];
  return (
    <div className="hero-board" aria-hidden="true">
      {positions.map(([column, row], index) => <span className={`hero-tile tile-${index % 4}`} style={{ gridColumn: column, gridRow: row }} key={`${column}-${row}`} />)}
      <div className="hero-bank"><span>ZERO</span><strong>CITY</strong></div>
      <div className="pawn pawn-one" /><div className="pawn pawn-two" />
    </div>
  );
}

function GameHeader({ phase, onReset }: { phase: GamePhase; onReset: () => void }) {
  const label = phase === "success" ? "무소유자 통행 승인" : "최고 난이도 · 감사 모드";
  return (
    <header className="game-header">
      <div><span className="eyebrow">EP.01 · ZERO CITY</span><strong>{label}</strong></div>
      <button className="text-button" type="button" onClick={onReset}>처음부터</button>
      <div className="progress-track" aria-label={`P01 진행률 ${PHASE_PROGRESS[phase]}%`}><span style={{ width: `${PHASE_PROGRESS[phase]}%` }} /></div>
    </header>
  );
}

const HINTS = [
  "각 영수증의 금액·양쪽 절취 표식·도착 칸의 현재 상태는 서로 다른 질문에 답합니다.",
  `말 바닥의 ${START_MARK}에서 시작해 영수증의 입구→출구 절취가 이어져야 합니다. 금액은 등기표가 아니라 현재 건물 수의 지대입니다.`,
  "절취 순서는 C-A-E-B-D입니다. 지대가 일치하는 도착지는 동백-시계-항만-구름-은행이며, 각 영수증의 입구 파임을 그 칸의 진입 도로로 돌리세요.",
];

function HintBox({ game, update }: { game: SavedGame; update: (patch: Partial<SavedGame>) => void }) {
  return (
    <section className="tiered-hints" aria-label="단계별 힌트">
      <div><strong>규칙 감사관</strong><span>{game.hintsOpened}/3 열람</span></div>
      {HINTS.slice(0, game.hintsOpened).map((hint, index) => <p key={hint}><b>{index + 1}</b>{hint}</p>)}
      {game.hintsOpened < HINTS.length && (
        <button type="button" onClick={() => update({ hintsOpened: game.hintsOpened + 1 })}>힌트 {game.hintsOpened + 1} 열기</button>
      )}
    </section>
  );
}

type ScreenProps = {
  game: SavedGame;
  update: (patch: Partial<SavedGame>) => void;
  setFeedback: (message: string) => void;
};

function ReceiptEvidence() {
  return (
    <div className="evidence-panel receipt-evidence">
      <div className="pawn-base-rule"><span>{START_MARK}</span><p><strong>압류 말 바닥</strong><small>“바닥의 파임으로 들어와 머리의 절취로 나간다.”</small></p><span>{END_MARK}</span></div>
      <div className="hard-receipt-list">
        {RECEIPTS.map((receipt) => (
          <article className="hard-receipt" key={receipt.id}>
            <span className="tear-mark">{receipt.entryMark}</span>
            <div><small>{receipt.label} · 도착지 미기재</small><strong>징수액 {receipt.amount} Z</strong><em>{receipt.print}</em></div>
            <span className="tear-mark exit">{receipt.exitMark}</span>
          </article>
        ))}
      </div>
    </div>
  );
}

function DeedEvidence() {
  return (
    <div className="evidence-panel deed-grid">
      <p className="evidence-instruction">등기표의 세 숫자는 건물 <b>0 / 1 / 2채</b>일 때의 지대다.</p>
      {PROPERTIES.map((property) => (
        <article className="deed-card" key={property.id}>
          <div><span>{property.district}</span><strong>{property.name}</strong></div>
          <ol>{property.tariffs.map((tariff, index) => <li key={tariff}><small>{index}채</small><b>{tariff}</b></li>)}</ol>
          <footer>진입 도로 <b>{DIRECTION_NAME[property.incoming]}</b></footer>
        </article>
      ))}
    </div>
  );
}

function LedgerEvidence() {
  return (
    <div className="evidence-panel ledger-sheet">
      <div className="ledger-rule"><strong>야간 압류 규칙 7조</strong><p>현재 건물 수의 지대를 징수한다. <u>저당 칸은 건물과 무관하게 무건물 지대의 절반</u>만 징수한다.</p></div>
      <table>
        <thead><tr><th>구역</th><th>현재 건물</th><th>등기 상태</th></tr></thead>
        <tbody>{PROPERTIES.map((property) => <tr key={property.id}><th>{property.shortName}</th><td>{property.buildings}채</td><td>{property.mortgaged ? "저당" : "정상"}</td></tr>)}</tbody>
      </table>
      <p className="audit-note">감사관 메모: “인쇄된 최고액이나 토지가격이 아니라 <b>지금 받을 금액</b>으로 도착 칸을 찾는다.”</p>
    </div>
  );
}

function ManualEvidence() {
  return (
    <div className="evidence-panel manual-sheet">
      <span className="manual-stamp">검표기<br />교육용</span>
      <h2>영수증 정합 절차</h2>
      <div className="training-diagram" aria-label="입구 파임을 진입 도로에 맞추는 예시"><span>도로</span><i>↑</i><div><b>○</b><small>입구 파임</small></div></div>
      <ol>
        <li>연속된 절취 기록을 검표 순서대로 넣는다.</li>
        <li>징수액과 현재 지대가 같은 도착 칸을 받친다.</li>
        <li><b>입구 파임</b>이 그 칸의 진입 도로를 보도록 영수증을 돌린다.</li>
      </ol>
      <blockquote>검은 인쇄는 압류된 이동. 다섯 창에 남은 <b>빈 공간</b>만 현재 소유 상태로 신고한다.</blockquote>
    </div>
  );
}

const EVIDENCE_TABS = [
  ["receipts", "영수증"], ["deeds", "등기표"], ["ledger", "현황 장부"], ["manual", "검표 매뉴얼"],
] as const;

function ScannerConsole({ game, update, setFeedback }: ScreenProps) {
  const setSlot = (index: number, patch: Partial<ScanSlot>) => {
    const next = game.scanSlots.map((slot, slotIndex) => slotIndex === index ? { ...slot, ...patch } : slot);
    update({ scanSlots: next });
  };

  const complete = game.scanSlots.every((slot) => slot.receiptId && slot.propertyId);
  const duplicates = new Set(game.scanSlots.filter((slot) => slot.receiptId).map((slot) => slot.receiptId)).size !== game.scanSlots.filter((slot) => slot.receiptId).length
    || new Set(game.scanSlots.filter((slot) => slot.propertyId).map((slot) => slot.propertyId)).size !== game.scanSlots.filter((slot) => slot.propertyId).length;

  const submit = () => {
    const result = validateScan(game.scanSlots);
    if (!result.chain) setFeedback("검표 거부 · 말 바닥부터 마감 표식까지 절취가 이어지지 않습니다.");
    else if (!result.rents) setFeedback("검표 거부 · 한 장 이상이 현재 지대와 다른 칸에 놓였습니다.");
    else if (!result.orientations) setFeedback("검표 거부 · 입구 파임과 진입 도로가 맞지 않습니다.");
    else {
      playTone(780, 0.18);
      update({ phase: "projection" });
      setFeedback("다섯 투명창이 정합됐습니다. 빈 공간 투사가 시작됩니다.");
      return;
    }
    playTone(160, 0.16);
    update({ attempts: game.attempts + 1 });
  };

  return (
    <section className="scanner-console" aria-labelledby="scanner-title">
      <header><span>VISIBLE OBSTACLE</span><h2 id="scanner-title">무소유자 검문 셔터</h2><p>다섯 기록을 한 번에 정합해야 단어 신고창이 열린다.</p></header>
      <div className="scan-slots">
        {game.scanSlots.map((slot, index) => (
          <article className="scan-slot" key={index}>
            <div className="scan-index"><span>{index + 1}</span><small>{index === 0 ? START_MARK : "→"}{index === 4 ? END_MARK : ""}</small></div>
            <label>기록<select value={slot.receiptId} onChange={(event) => setSlot(index, { receiptId: event.target.value })}><option value="">선택</option>{RECEIPTS.map((receipt) => <option value={receipt.id} key={receipt.id}>{receipt.label} · {receipt.amount}Z · {receipt.entryMark}→{receipt.exitMark}</option>)}</select></label>
            <label>도착 칸<select value={slot.propertyId} onChange={(event) => setSlot(index, { propertyId: event.target.value })}><option value="">선택</option>{PROPERTIES.map((property) => <option value={property.id} key={property.id}>{property.name}</option>)}</select></label>
            <button className="rotation-button" type="button" onClick={() => setSlot(index, { rotation: normalizeRotation(slot.rotation + 90) })}>
              <span style={{ transform: `rotate(${slot.rotation}deg)` }}>↑</span><b>{slot.rotation}°</b><small>영수증 회전</small>
            </button>
          </article>
        ))}
      </div>
      {duplicates && <p className="duplicate-warning">같은 영수증이나 도착 칸은 두 번 검표할 수 없습니다.</p>}
      <div className="scanner-actions"><button className="secondary-button" type="button" onClick={() => update({ scanSlots: EMPTY_SCAN_SLOTS.map((slot) => ({ ...slot })) })}>정합판 초기화</button><button className="primary-button" type="button" disabled={!complete || duplicates} onClick={submit}>일괄 스캔</button></div>
    </section>
  );
}

function Investigation({ game, update, setFeedback }: ScreenProps) {
  const selectEvidence = (id: SavedGame["activeEvidence"]) => {
    const viewedEvidence = game.viewedEvidence.includes(id) ? game.viewedEvidence : [...game.viewedEvidence, id];
    update({ activeEvidence: id, viewedEvidence });
    playTone(360, 0.05);
  };
  const panel = useMemo(() => {
    if (game.activeEvidence === "deeds") return <DeedEvidence />;
    if (game.activeEvidence === "ledger") return <LedgerEvidence />;
    if (game.activeEvidence === "manual") return <ManualEvidence />;
    return <ReceiptEvidence />;
  }, [game.activeEvidence]);
  return (
    <section className="screen investigation-screen">
      <div className="scene-title"><span className="step-chip">P01 · 빈 등기 검문</span><h1>기록은 모두 맞다.<br />기준만 틀렸다.</h1><p>어느 한 문서도 정답을 직접 주지 않는다. 각 문서가 설명하는 역할을 분리해 다섯 기록을 정합하라.</p></div>
      <nav className="evidence-tabs" aria-label="증거 문서">
        {EVIDENCE_TABS.map(([id, label]) => <button type="button" className={game.activeEvidence === id ? "active" : ""} onClick={() => selectEvidence(id)} key={id}>{game.viewedEvidence.includes(id) && <i>•</i>}{label}</button>)}
      </nav>
      {panel}
      <ScannerConsole game={game} update={update} setFeedback={setFeedback} />
      <HintBox game={game} update={update} />
    </section>
  );
}

function ProjectionPuzzle({ game, update, setFeedback }: ScreenProps) {
  const submitWord = (event: FormEvent) => {
    event.preventDefault();
    if (!isCorrectWord(game.wordInput)) {
      update({ attempts: game.attempts + 1 });
      setFeedback("단어 불일치 · 검은 경로가 아니라 세 개의 빈 한글 음절을 읽으세요.");
      playTone(150, 0.17);
      return;
    }
    update({ phase: "success" });
    setFeedback("소유 상태 확인 · 검문 셔터가 열립니다.");
    playTone(860, 0.22);
  };
  return (
    <section className="screen projection-screen">
      <div className="scene-title"><span className="step-chip">01-B · 빈 공간 판독</span><h1>검은 것은<br />압류된 길</h1><p>다섯 영수증의 창이 겹쳤다. 남은 빈 획을 자음과 모음으로 묶어 현재 소유 상태를 신고하라.</p></div>
      <div className="projection-frame" aria-label="세 개의 한글 음절을 이루는 빈 획 투사">
        <div className="projection-noise" />
        <div className="negative-glyphs" aria-hidden="true"><span>ㅁㅜ</span><span>ㅅㅗ</span><span>ㅇㅠ</span></div>
        <small>BLACK = SEIZED ROUTE · VOID = STATUS</small>
      </div>
      <form className="word-lock" onSubmit={submitWord}>
        <label htmlFor="status-word">현재 소유 상태 · 한 단어</label>
        <input id="status-word" value={game.wordInput} onChange={(event) => update({ wordInput: event.target.value })} placeholder="한글로 입력" autoComplete="off" enterKeyHint="done" />
        <button className="primary-button large" type="submit" disabled={!game.wordInput.trim()}>신고 단어 제출</button>
      </form>
      <details className="hint-box"><summary>판독 보조</summary><p>왼쪽부터 자음과 모음을 한 음절씩 합치세요. 결과는 “재산이나 소유한 것이 없음”을 뜻합니다.</p></details>
    </section>
  );
}

export function App() {
  const [game, setGame] = useState<SavedGame>(DEFAULT_GAME);
  const [resumeGame, setResumeGame] = useState<SavedGame | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [feedback, setFeedback] = useState("최고 난이도 감사 모드 준비 완료");

  useEffect(() => {
    loadGame().then((saved) => { if (saved && saved.phase !== "landing") setResumeGame(saved); }).catch(() => setFeedback("저장 데이터를 읽지 못했지만 게임은 진행할 수 있습니다.")).finally(() => setHydrated(true));
  }, []);
  useEffect(() => { if (hydrated && game.phase !== "landing") void saveGame({ ...game, updatedAt: Date.now() }); }, [game, hydrated]);

  const update = (patch: Partial<SavedGame>) => setGame((current) => ({ ...current, ...patch, updatedAt: Date.now() }));
  const startNew = async () => { await clearGame().catch(() => undefined); setResumeGame(null); setGame({ ...DEFAULT_GAME, phase: "intro", scanSlots: EMPTY_SCAN_SLOTS.map((slot) => ({ ...slot })), updatedAt: Date.now() }); setFeedback("제로 시티 최고 난이도 감사를 시작합니다."); playTone(460); };
  const continueGame = () => { if (resumeGame) { setGame(resumeGame); setFeedback("저장된 정합판을 불러왔습니다."); } };
  const reset = () => { if (!window.confirm("현재 P01 진행을 지우고 처음 화면으로 돌아갈까요?")) return; void clearGame(); setResumeGame(null); setGame({ ...DEFAULT_GAME, scanSlots: EMPTY_SCAN_SLOTS.map((slot) => ({ ...slot })), updatedAt: Date.now() }); setFeedback("진행을 초기화했습니다."); };

  if (game.phase === "landing") return (
    <main className="app-shell landing-screen"><div className="ambient-grid" /><section className="landing-content"><span className="eyebrow">MOBILE ESCAPE · EPISODE 01</span><BoardMark /><div className="title-block"><p>무한 라운드</p><h1>제로 시티<br /><em>탈출</em></h1><span>최고 난이도 · 방향을 발견하면 모든 기록이 한 번에 풀린다.</span></div><div className="landing-actions"><button className="primary-button large" type="button" onClick={startNew}>새 게임 시작</button>{resumeGame && <button className="secondary-button large" type="button" onClick={continueGame}>저장 지점에서 계속</button>}</div><div className="feature-row"><span>자동 저장</span><span>단어 잠금</span><span>오프라인 지원</span></div>{!hydrated && <p className="loading-copy">저장 기록을 확인하는 중…</p>}</section></main>
  );

  return (
    <main className="app-shell">
      <GameHeader phase={game.phase} onReset={reset} />
      {game.phase === "intro" && <section className="screen intro-screen"><div className="impound-door hard" aria-hidden="true"><div className="door-slot" /><div className="pawn-shadow" /></div><span className="step-chip">SYSTEM · MAXIMUM AUDIT</span><h1>소유가 있는 말은<br />나갈 수 없다.</h1><div className="system-copy"><p>검문 셔터 앞에는 도착지가 지워진 영수증 다섯 장과 서로 다른 규칙 문서가 놓여 있다.</p><p>순서, 도착 칸, 방향, 출력은 각각 다른 증거가 결정한다. 모든 조건을 한 번에 만족시켜라.</p></div><button className="primary-button large" type="button" onClick={() => { update({ phase: "investigation", viewedEvidence: ["receipts"] }); setFeedback("증거 문서 네 묶음과 정합 스캐너를 발견했습니다."); playTone(560); }}>검문 기록 조사하기</button></section>}
      {game.phase === "investigation" && <Investigation game={game} update={update} setFeedback={setFeedback} />}
      {game.phase === "projection" && <ProjectionPuzzle game={game} update={update} setFeedback={setFeedback} />}
      {game.phase === "success" && <section className="screen success-screen"><div className="open-gate" aria-hidden="true"><span /><span /><div className="light-path" /></div><span className="step-chip success">P01 COMPLETE · 9.5 EST.</span><h1>검문 셔터가<br />열렸다.</h1><p>기록이 증명한 것은 경로가 아니라 당신이 가진 것이 없다는 사실이었다.</p><div className="reward-card"><div className="ticket-punch"><i /><b /></div><span><small>획득한 도구</small><strong>검표 펀치</strong><em>다른 표식에도 같은 홈이 있을지 모른다.</em></span></div><div className="next-episode"><span>다음 구역</span><strong>P02 · 저당 등기 차분</strong><small>현재 웹 프로토타입은 P01까지 플레이할 수 있습니다.</small></div><button className="secondary-button large" type="button" onClick={reset}>처음 화면으로</button></section>}
      <div className="feedback-bar" role="status" aria-live="polite">{feedback}<span>저장됨</span></div>
    </main>
  );
}
