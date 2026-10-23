# HANDOFF — Zug-Bingo 🎯🚆 (Germany Hard Mode 시리즈 #1)

> "독일 기차에서 가장 희귀한 이벤트는? **정시 도착.** (🌈 Mythic)"
> 독일 기차의 지연·취소·대체버스를 수집형 게임으로 바꾸는 모바일 PWA. 고통이 점수가 되고, 점수가 보상금이 된다.

---

## 1. 컨셉
- 기본 빙고(5×5 칸 채우기)에 **수집 게임 + 실시간 인증 + 예측 베팅 + 보상금 연결**을 얹은 고도화 버전.
- 핵심 감정 전환: 😤 "또 늦네" → 😏 "오, Epic 칸 떴다"
- 자매 프로젝트 **Bahn-Wetter**(지연 예보)의 확률 데이터를 그대로 재사용 → 칸의 희귀도, 베팅 배당에 사용.
- 톤: 독일 기차 밈 감성, 한국어 기본 + 독일어 원어 병기 (예: "대체버스 (Ersatzverkehr)").
- ⚠️ 비공식 팬 프로젝트. DB 로고·브랜드 컬러·안내방송 음원 사용 금지. 이름에 "DB" 단독 사용 지양.

## 2. 핵심 게임 시스템

### 2.1 카드 종류
| 카드 | 설명 | 재미 포인트 |
|---|---|---|
| 🗓️ **오늘의 카드** (Daily) | 매일 00시, 모든 유저에게 같은 5×5 카드 (날짜 seed) | Wordle처럼 "오늘 몇 줄 했어?" 공유 |
| 🎫 **내 여정 카드** (Trip) | 열차번호/구간 입력 → 그 노선 특성에 맞춘 카드 생성 | Bahn-Wetter 확률로 칸 구성이 노선마다 다름 |
| ❄️ **시즌 카드** | 겨울(선로 결빙), 여름(에어컨 고장), 12월 어드벤트 카드 | 시즌 한정 칸, 한정 칭호 |
| ⚡ **이벤트 카드** | 파업 등 대형 이벤트 때 긴급 발행 | "역사적 순간" 기념 카드 |

중앙 칸은 무료 칸: **"오늘도 기차를 탔다 🫡"**

### 2.2 희귀도 (Rarity) — 아이러니가 핵심
| 등급 | 색 | 예시 칸 | 점수 |
|---|---|---|---|
| ⚪ Common | 회색 | 5분 이상 지연, 사과 안내방송 들음 | 10 |
| 🟢 Uncommon | 초록 | 승강장 변경, 20분 이상 지연 (Zugbindung 해제) | 25 |
| 🔵 Rare | 파랑 | 60분 이상 지연 (보상금 25% 대상), 객차 순서 반대 | 50 |
| 🟣 Epic | 보라 | 대체버스 탑승, 열차 중간역 종착 | 100 |
| 🟠 Legendary | 주황 | 120분 이상 지연 (보상금 50%), 같은 날 2회 취소 | 250 |
| 🌈 **Mythic** | 무지개 | **ICE 정시 도착**, 환승 0분 남기고 성공 | 500 |

- 희귀도는 고정값이 아니라 **Bahn-Wetter 데이터 기반 실제 발생 확률**로 산정 (예: 해당 노선 정시율이 높으면 정시 도착은 Rare로 강등).
- 확률 데이터가 없는 칸은 기본 등급 테이블(`config/squares.yaml`) 사용.

### 2.3 인증 시스템 (치트 방지 + 재미)
- ✅ **자동 인증**: 열차번호 + 날짜 + 역으로 실시간 데이터 조회 → 지연 분 수, 취소, 승강장 변경 확인. 점수 ×1.5, 카드에 "인증" 도장 애니메이션.
- 🙋 **셀프 신고**: 데이터로 확인 불가한 칸 (WLAN 고장, 식당칸 폐쇄, 에어컨 고장, 사과 방송). 점수 ×1.0.
- 칸마다 `verifiable: true/false` 속성 보유.

### 2.4 예측 베팅 🎲
- 탑승 전: "이 열차 몇 분 늦을까?" 구간 선택 (정시 / 5–19 / 20–59 / 60+ / 취소)
- 배당은 Bahn-Wetter 확률의 역수 (정시 맞히면 고배당).
- 하차 후 자동 정산. 게임 내 포인트만 사용, **실제 돈 베팅 절대 없음**.

### 2.5 보상금 연결 (고통 → 돈) 🐷
- Rare 이상 지연 칸 획득 시: "💶 이 칸으로 보상금 €X 청구 가능!" 팝업
- 규칙: 도착역 기준 60분 이상 → 편도 운임 25%, 120분 이상 → 50%. 지급 하한 4유로(Bagatellgrenze). 정기권/Deutschlandticket은 정액 규정 별도.
- 티켓 가격 입력 시 금액 계산 + DB 공식 신청 경로 안내 링크
- 누적 화면 **"지연 저금통"**: "올해 기차가 나에게 준 용돈 €47.50"
- ⚠️ 규정 수치는 `config/compensation.yaml`에 두고, 출처 URL과 확인 날짜를 함께 기록. 하드코딩 금지.

### 2.6 칭호 & 업적 🏅
- **칭호** (프로필 표시): "대체버스 마스터", "S3의 순교자", "환승의 신", "Frankfurt Hbf 터줏대감", "정시 목격자" (Mythic 획득)
- **업적 예시**:
  - 🥉 첫 빙고 / 🥈 한 카드 3줄 / 🥇 블랙아웃 (전 칸)
  - 🔥 연속 7일 Daily 참여
  - 🧘 "누적 지연 24시간 — 하루를 기차에 바쳤다"
  - 💶 "보상금 €100 돌파 — DB 주주급 대우"
  - 🌈 Mythic 칸 획득
- 레벨: 누적 점수 기반 "Fahrgast Lv.1 → Bahn-Veteran → Gleis-Legende"

### 2.7 공유 카드 📸
- 빙고 달성 시 1080×1350 PNG 자동 생성 (Instagram 세로)
- Wordle식 텍스트 공유도 지원:
  ```
  Zug-Bingo #142 🚆 2줄!
  🟩🟩⬜🟪🟩
  ⬜🟦🟩⬜⬜
  🟩🟩🫡🟩🟩
  ⬜⬜🟩⬜🟧
  ⬜🟦🟩⬜⬜
  누적 지연 87분 · 보상금 €12.50
  ```
- 원어 병기 덕분에 독일 친구에게도 공유 가능

### 2.8 Funkloch 모드 📵 (기능이자 농담)
- **오프라인 우선 PWA**: 통신이 끊겨도 칸 체크 가능, 연결되면 자동 인증 동기화.
- 오프라인 진입 시 토스트: "📵 Funkloch 진입! 기록은 저장 중… (보너스 칸 '통신 두절' 획득)"

## 3. 칸 풀 (초안 — `config/squares.yaml`로 관리)

| id | 칸 | 원어 | 등급 | 자동인증 |
|---|---|---|---|---|
| delay_5 | 5분 이상 지연 | Verspätung +5 | Common | ✅ |
| delay_20 | 20분+ 지연, 열차 지정 해제 | Zugbindung aufgehoben | Uncommon | ✅ |
| delay_60 | 60분+ 지연 (보상금 25%) | +60 | Rare | ✅ |
| delay_120 | 120분+ 지연 (보상금 50%) | +120 | Legendary | ✅ |
| platform_change | 승강장 변경 | Gleiswechsel | Uncommon | ✅ |
| cancelled | 열차 취소 | Zugausfall | Epic | ✅ |
| short_turn | 중간역 종착 | endet vorzeitig | Epic | ✅ |
| on_time_ice | ICE 정시 도착 | pünktlich | Mythic | ✅ |
| ersatzverkehr | 대체버스 탑승 | SEV / Ersatzverkehr | Epic | 🙋 |
| reverse_order | 객차 순서 반대 | umgekehrte Wagenreihung | Rare | 🙋 |
| wifi_dead | 와이파이 안 됨 | WLAN gestört | Common | 🙋 |
| bistro_closed | 식당칸 영업 안 함 | Bordbistro geschlossen | Uncommon | 🙋 |
| ac_broken | 에어컨/난방 고장 | Klimaanlage defekt | Rare | 🙋 |
| repair | "열차 수리 중" 안내 | Reparatur am Zug | Uncommon | 🙋 |
| signal | "신호 장애" 안내 | Signalstörung | Uncommon | 🙋 |
| priority | "타 열차 우선 통과" 안내 | Vorfahrt eines anderen Zuges | Common | 🙋 |
| apology | 사과 방송 3회 이상 | Wir bitten um Entschuldigung | Common | 🙋 |
| standing | 지정석 있는데 서서 감 | Reservierung weg | Rare | 🙋 |
| missed_conn | 환승 놓침 | Anschluss verpasst | Rare | ✅ |
| saved_conn | 환승 2분 이내 성공 | Anschluss erreicht | Legendary | ✅ |
| faster_alt | 늦은 열차 버리고 다른 열차가 더 빨리 도착 | — | Epic | ✅ |
| funkloch | 통신 끊김 구간 진입 | Funkloch | Common | 🙋 (오프라인 자동) |
| strike_day | 파업일 탑승 | Streik | Legendary | ✅ (이벤트) |

> 칸 문구는 기존 유명 밈/콘텐츠를 베끼지 말고 직접 작성. 웃기되 직원 비하·혐오 표현 금지 ("기관사 탓" 류 금지, 시스템을 놀리는 톤).

## 4. 데이터 & 아키텍처

### 4.1 데이터
- **실시간 인증**: DB API Marketplace Timetables API (plan / fchg / rchg). API 키 필요 → 브라우저 노출 금지, 서버리스 프록시 사용.
  https://developers.deutschebahn.com/db-api-marketplace/apis/product/timetables
- **희귀도/배당**: Bahn-Wetter 파이프라인이 export하는 확률 JSON 재사용 (없으면 기본 테이블).
- **보상금 규정**: `config/compensation.yaml` (출처, 확인일 포함).
- 데이터 출처 표기: Deutsche Bahn (CC BY 4.0).

### 4.2 기술 스택 (권장)
```
zug-bingo/
├── app/                 # Vite + TypeScript (또는 SvelteKit), PWA, 모바일 우선
│   ├── game/            # 카드 생성(seeded RNG), 빙고 판정, 점수, 업적
│   ├── verify/          # 자동 인증 클라이언트
│   ├── share/           # 공유 카드 PNG (canvas) + 텍스트 공유
│   └── storage/         # IndexedDB (오프라인 우선)
├── worker/              # Cloudflare Workers: Timetables API 프록시 + 캐싱
├── config/
│   ├── squares.yaml
│   ├── rarity.yaml
│   ├── achievements.yaml
│   └── compensation.yaml
└── tests/               # 빙고 판정, 카드 생성 결정성, 보상금 계산 단위 테스트
```
- MVP는 **계정 없이** 로컬 저장 (IndexedDB). 리더보드·친구 기능은 Phase 4에서 계정 도입 시.
- Daily 카드는 날짜 seed로 결정적 생성 → 서버 없이 모두 같은 카드.
- 개인정보 최소화: 위치·이름 수집 안 함. 열차번호만 사용.

### 4.3 화면
1. **홈**: 오늘의 카드 + 연속 참여 🔥 + 지연 저금통 요약
2. **카드 화면**: 5×5 그리드, 칸 탭 → 체크/인증 애니메이션 (등급별 이펙트: Mythic은 무지개 폭죽)
3. **내 여정**: 열차번호 입력 → Trip 카드 생성 + 예측 베팅
4. **도감 (컬렉션)**: 획득한 칸 전체를 등급별로 수집, 미획득은 실루엣
5. **프로필**: 칭호, 레벨, 업적, 누적 통계 ("올해 기차에서 보낸 추가 시간 14시간")
6. **보상금 가이드**: 규정 요약 + 공식 신청 링크

디자인: 카드 게임 감성 (등급별 테두리 글로우), 다크모드, 한 손 조작, 진동 피드백.

## 5. 단계별 계획
| Phase | 목표 | 완료 기준 |
|---|---|---|
| 0 | 기획 고정 | squares/rarity/achievements yaml 작성, 빙고 판정·카드 생성 로직 + 단위 테스트 |
| 1 | MVP | Daily 카드, 셀프 체크, 빙고 판정, 텍스트 공유, 오프라인 PWA |
| 2 | 수집 & 성장 | 희귀도 이펙트, 도감, 업적, 칭호, 레벨, 공유 PNG |
| 3 | 실시간 인증 | Workers 프록시, 자동 인증, Trip 카드, 예측 베팅 |
| 4 | 보상금 & 소셜 | 지연 저금통, 보상금 계산, (선택) 계정·친구·리더보드 |
| 5 | 시즌 & 이벤트 | 어드벤트 카드, 시즌 칸, 파업 긴급 카드 |

## 6. 원칙
- 비공식 고지 + 데이터 출처 표기 필수
- 실제 돈 베팅·결제 없음 (포인트는 게임 내 전용)
- 보상금 안내는 정보 제공일 뿐, 신청은 공식 채널로 연결
- API 키는 Workers 환경변수로만 관리, 커밋 금지
- 칸 문구·톤 가이드 준수 (직원 비하 금지, 시스템 풍자)
