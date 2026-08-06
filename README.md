# 무한 라운드: 제로 시티 탈출

무료 정적 PWA로 제작한 모바일 포인트앤클릭 탈출 게임입니다. 현재 최대 난이도 P01 `빈 등기 검문`까지 플레이할 수 있습니다. 문서 교차검증, 기록 정합, 회전 기준 전환, 음각 단어 입력을 한 흐름으로 사용합니다.

## 로컬 실행

```bash
npm ci
npm run dev
```

## 검사

```bash
npm test
npm run build
```

## GitHub Pages

`main` 브랜치에 푸시하면 `.github/workflows/deploy-pages.yml`이 테스트와 빌드를 실행한 뒤 Pages에 배포합니다. 저장소의 **Settings → Pages → Source**가 `GitHub Actions`로 설정되어 있어야 합니다.

배포 주소: `https://hsu0116.github.io/zero-city-escape/`

## 비용 원칙

- 서버, 데이터베이스, 로그인, 유료 API 없음
- 진행 상태는 브라우저 IndexedDB에만 저장
- 모든 실행 에셋은 저장소에 포함
- 공개 GitHub Pages 기본 주소 사용
