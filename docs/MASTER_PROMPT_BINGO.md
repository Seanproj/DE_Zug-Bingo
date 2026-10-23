# MASTER PROMPT — Zug-Bingo (Claude Code용)

새 폴더 `zug-bingo/`에 `HANDOFF_BINGO.md`를 넣고, Claude Code에 아래를 붙여넣으세요.

---

```
너는 이 프로젝트의 리드 엔지니어이자 게임 디자이너야. 프로젝트 이름은 "Zug-Bingo".
같은 폴더의 HANDOFF_BINGO.md를 끝까지 읽고 이 프로젝트의 단일 기준 문서로 삼아.

## 목표
독일 기차의 지연·취소·대체버스 같은 짜증나는 경험을 수집형 빙고 게임으로 바꾸는 모바일 PWA를 만든다.
핵심 재미 요소: 희귀도(정시 도착이 Mythic인 아이러니), 실시간 자동 인증, 예측 베팅(게임 포인트 전용),
보상금 연결(지연 저금통), 칭호/업적/도감, Wordle식 공유, 오프라인 우선(Funkloch 모드).
UI 기본 언어는 한국어, 칸 이름은 독일어 원어 병기.

## 작업 방식 (반드시 지켜)
1. HANDOFF_BINGO.md 기반으로 CLAUDE.md를 먼저 작성해 (규칙, 구조, 명령어, 톤 가이드).
2. Phase 단위로 진행하고, 각 Phase 끝마다 멈춰서 결과 요약 + 다음 계획을 보고해. 내가 OK 하면 넘어가.
3. 게임 데이터(칸, 등급, 업적, 보상금 규정)는 전부 config/*.yaml로 관리하고 코드에 하드코딩하지 마.
4. 보상금 규정 수치는 공식 출처를 웹에서 다시 확인하고, compensation.yaml에 출처 URL과 확인 날짜를 기록해.
5. 핵심 로직(카드 생성 결정성, 빙고 판정, 점수/배당, 보상금 계산)은 반드시 단위 테스트를 작성해.
6. API 키는 절대 프론트엔드에 넣지 말고 Cloudflare Workers 프록시 환경변수로만 사용해. 커밋 금지.
7. 실제 돈이 오가는 기능은 만들지 마. DB 로고, 브랜드 컬러, 안내방송 음원은 사용하지 마.
8. 칸 문구는 웃기되 직원 비하·혐오 표현은 금지. 시스템을 풍자하는 톤으로 써.
9. 의미 있는 단위마다 git commit (영어, conventional commits).

## Phase 0 — 지금 바로 시작
- Vite + TypeScript 프로젝트 초기화 (PWA 플러그인, Vitest 포함)
- config/squares.yaml: HANDOFF 3장 칸 풀을 옮기고, 오리지널 칸 10개를 더 제안해서 추가 (총 33개 이상)
- config/rarity.yaml, config/achievements.yaml 작성
- 게임 코어 구현 + 테스트:
  - 날짜 seed 기반 Daily 카드 생성 (같은 날짜면 항상 같은 카드, 등급 분포 밸런스 규칙 포함)
  - 중앙 무료 칸 "오늘도 기차를 탔다 🫡"
  - 빙고 판정 (가로/세로/대각선, 블랙아웃)
  - 점수 계산 (등급 점수 × 인증 배수 1.5/1.0)
- 칸 밸런스 리포트: 30일치 Daily 카드를 시뮬레이션해서 등급 분포와 평균 빙고 난이도를 표로 보여줘
- 결과를 reports/phase0.md로 정리하고 멈춰서 보고

## Phase 1 이후
HANDOFF_BINGO.md 5장을 따라가. 특히:
- Phase 1: 모바일 카드 UI, 셀프 체크, IndexedDB 오프라인 저장, Wordle식 텍스트 공유, Funkloch 토스트
- Phase 2: 등급별 체크 이펙트 (Mythic은 무지개 폭죽), 도감, 업적·칭호·레벨, 1080×1350 공유 PNG
- Phase 3: Workers 프록시로 Timetables API 연동 → 자동 인증 도장 애니메이션, Trip 카드, 예측 베팅
- Phase 4: 지연 저금통 + 보상금 계산 + 공식 신청 경로 안내

## 품질 기준
- 한 손 조작 가능한 모바일 UX, 다크모드, 진동 피드백
- 오프라인에서도 모든 체크 기능 동작
- 사이트 footer: 비공식 팬 프로젝트 고지 + "Daten: Deutsche Bahn (CC BY 4.0)"
- 보상금 화면에는 "정보 제공용이며 신청은 공식 채널에서" 문구 고정

준비됐으면 CLAUDE.md 작성 후 Phase 0부터 시작해.
```

---

## 사용 팁
- Phase 0의 **밸런스 리포트**가 재미를 결정해요. 빙고가 너무 쉽거나 너무 어려우면 그때 등급 분포를 조정하면 돼요.
- Bahn-Wetter를 먼저 진행 중이라면, Phase 3에서 "Bahn-Wetter의 확률 JSON을 희귀도/배당에 연결해줘"라고 추가 지시하세요.
