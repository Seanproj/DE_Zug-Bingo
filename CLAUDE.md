# CLAUDE.md — Zug-Bingo 🎯🚆

독일 기차의 지연·취소·대체버스를 수집형 빙고 게임으로 바꾸는 모바일 PWA.
**단일 기준 문서는 `HANDOFF_BINGO.md`** 이다. 이 파일과 충돌하면 HANDOFF가 이긴다.
작업 지시 원문: `docs/MASTER_PROMPT_BINGO.md`.

---

## 1. 절대 규칙 (Never)

1. **실제 돈이 오가는 기능 금지.** 베팅은 게임 포인트 전용. 결제·송금·현금화 없음.
2. **API 키는 프론트엔드에 절대 넣지 않는다.** Cloudflare Workers 환경변수(`wrangler secret`)로만. `.env*`, `.dev.vars` 커밋 금지.
3. **DB 로고, 브랜드 컬러(DB 레드 `#EC0016` 계열), 안내방송 음원 사용 금지.** 이름에 "DB" 단독 사용 지양.
4. **게임 데이터 하드코딩 금지.** 칸·등급·점수·배수·업적·칭호·레벨·보상금 규정은 전부 `config/*.yaml`. 코드는 config를 읽기만 한다.
5. **보상금 수치는 공식 출처 재확인 후** `config/compensation.yaml`에 `source_url` + `checked_at` 기록.
6. **직원 비하·혐오 표현 금지.** 풍자 대상은 언제나 *시스템* (인프라, 안내, 운영)이지 사람이 아니다.
7. 개인정보 최소화: 위치·이름 수집 안 함. 열차번호만 사용. 계정 없음(MVP).

## 2. 작업 방식

- **Phase 단위로 진행**하고, 각 Phase 끝에 `reports/phaseN.md` 작성 → 멈추고 보고 → OK 받은 뒤 다음 Phase.
- 핵심 로직(카드 생성 결정성, 빙고 판정, 점수/배당, 보상금 계산)은 **반드시 단위 테스트**.
- 의미 있는 단위마다 git commit — **영어, Conventional Commits** (`feat:`, `fix:`, `test:`, `docs:`, `chore:`, `refactor:`).
- 커밋 전 `npm run typecheck && npm test` 통과 필수.

## 3. 명령어

| 명령 | 설명 |
|---|---|
| `npm run dev` | Vite 개발 서버 |
| `npm run build` | 타입체크 + 프로덕션 빌드 (PWA 포함) |
| `npm test` | Vitest 단위 테스트 1회 실행 |
| `npm run test:watch` | Vitest watch |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run report:balance` | 30일치 Daily 카드 밸런스 리포트 출력 (`-- --days 60 --out reports/x.md` 옵션) |

## 4. 구조

```
config/                 # 게임 데이터 (YAML, 유일한 진실의 원천)
  game.yaml             #   보드 크기, 무료 칸, 인증 배수, 빙고 보너스, Daily epoch/시간대
  squares.yaml          #   칸 풀
  rarity.yaml           #   등급(점수·색·확률·공유 이모지) + Daily 카드 구성/배치 규칙
  achievements.yaml     #   업적, 칭호, 레벨
  compensation.yaml     #   (Phase 4) 보상금 규정 + 출처
app/
  config/               # YAML 파싱 + 스키마 검증 (schema.ts), 브라우저 로더 (index.ts)
  game/                 # 순수 함수 게임 코어 — DOM/IndexedDB 의존 금지
    rng.ts              #   문자열 seed → 결정적 PRNG
    date.ts             #   Europe/Berlin 기준 날짜 키, Daily 번호
    card.ts             #   카드 생성 (구성 + 줄 단위 배치 제약)
    bingo.ts            #   빙고 판정 (가로/세로/대각선/블랙아웃)
    score.ts            #   점수 계산
    achievements.ts     #   업적/칭호/레벨 조건 평가
  verify/ share/ storage/ ui/   # Phase 1+
worker/                 # (Phase 3) Cloudflare Workers — Timetables API 프록시
scripts/                # 리포트 등 Node 스크립트 (tsx)
tests/                  # Vitest
reports/                # Phase별 보고서
```

- `app/game/*`는 **순수 TypeScript**. 입력은 파싱된 config 객체 + 상태, 출력은 값. 부수효과 없음 → Node/브라우저/Worker 어디서나 테스트·재사용 가능.
- YAML은 브라우저에서 `?raw` import, Node 스크립트에서는 `fs`로 읽어 같은 `parseConfig()`를 통과한다.

## 5. 게임 코어 계약

- **결정성**: Daily 카드는 `seed = "daily:" + YYYY-MM-DD(Europe/Berlin)` 로 생성. 같은 날짜 + 같은 config ⇒ 전 세계 동일 카드. RNG 알고리즘이나 생성 순서를 바꾸면 **모든 과거 카드가 바뀌므로** `game.yaml`의 `generator_version`을 올리고 리포트에 기록.
- **보드 인덱스**: row-major, `index = row * size + col`. 중앙(5×5에서 12)은 무료 칸.
- **점수**: `round(등급 점수 × 인증 배수)` 를 칸마다 합산 + 빙고 보너스(config). 무료 칸 0점.
- **implies**: 상위 칸 체크 시 하위 칸 자동 체크 (예: 120분 지연 ⇒ 60/20/5분 지연).

## 6. 톤 가이드 (칸 문구)

- UI 기본 한국어, 칸 이름은 **독일어 원어 병기**: `대체버스 (Ersatzverkehr)`.
- 감정 전환이 목표: 😤 "또 늦네" → 😏 "오, Epic 떴다".
- 웃음 포인트는 **아이러니와 체념의 공감**: 정시 도착이 Mythic, "추가 안내 예정"이 끝내 안 오는 것.
- ✅ 시스템·인프라·안내 문구·운영 상황을 놀린다.
- ❌ 기관사·승무원·직원 개인 탓, 특정 집단 비하, 인명사고(Personenschaden) 소재 금지.
- 기존 밈/콘텐츠 문구 복붙 금지 — 직접 쓴다.
- `flavor` 문구는 한 줄, 20~40자 내외, 담담하게.

## 7. 디자인 원칙 (임팩트 + 사용성)

**콘셉트: "심야 승강장 × 트레이딩 카드"** — 출발 전광판의 정보 밀도와 TCG의 수집 쾌감.

- **다크 퍼스트.** 배경은 심야 승강장의 잉크 네이비(`#0B0F17` 계열). 라이트 모드는 "아침 승강장" 페이퍼 톤.
- **색은 등급이 독점한다.** UI 크롬은 무채색, 강조색은 오직 등급 색(`rarity.yaml`의 `color`). DB 레드 계열 금지.
- **타이포**: 한글 Pretendard, 숫자·원어·번호는 모노/전광판 감성(`JetBrains Mono` 등). 지연 분 수는 크게, 탭 가능한 숫자처럼.
- **카드 셀** = 미니 트레이딩 카드: 등급 테두리 글로우, Epic+는 홀로그램 쉬머, Mythic은 회전하는 무지개 conic 테두리.
- **피드백 위계**: 체크 시 등급이 높을수록 이펙트·진동이 커진다 (Common: 짧은 탭 / Mythic: 폭죽 + 긴 패턴). 빙고 줄은 선이 *그어지는* 애니메이션.
- **한 손 조작**: 주요 액션은 화면 하단 1/3 (엄지 영역). 탭 타깃 ≥ 44px. 상단은 정보 전용.
- **접근성**: 색만으로 등급 구분 금지 — 이모지/라벨 병기. `prefers-reduced-motion` 존중. 대비 WCAG AA.
- **오프라인은 기능이자 농담**: Funkloch 토스트는 사과가 아니라 보너스처럼 보이게.
- 필수 고지(footer): 비공식 팬 프로젝트 + `Daten: Deutsche Bahn (CC BY 4.0)`. 보상금 화면에 "정보 제공용이며 신청은 공식 채널에서" 고정.
