# Phase 3 진행 상황 — 중간 저장 (이어서 작업용)

> 상태: ⏸️ **진행 중 일시 정지** · 테스트 323개 통과 · 브랜치 `claude/compassionate-babbage-j2nd58`
> 다음 세션 시작 시: 이 파일 → `CLAUDE.md` → 아래 "남은 작업" 순서대로.

## ✅ 완료 (커밋됨)

| 영역 | 파일 | 내용 |
|---|---|---|
| 설정 | `config/game.yaml` | `verify`(프록시 경로 `/api`, 타임아웃), `prediction`(시작 100🪙, 체크인 +10, 판돈 10/25/50, 지연 구간 5개 + 확률) — 스키마 검증 포함 |
| 인증 규칙 | `app/verify/rules.ts`, `types.ts` | 관측값 → 인증 칸. 지연/정시/조기 도착은 **실제 도착 후에만 확정**, 취소·승강장 변경·예정 시각 변경은 즉시. 환승·중간역 종착 등은 `unsupported` (셀프 체크) |
| 예측 베팅 | `app/game/trips.ts` | 배당 = 1/확률, 지갑은 **파생값**(시작 + 체크인 보너스 − 판돈 + 당첨금) → 어긋날 수 없음. 정산, 여정 합계(적중 수·누적 지연·노선·역) |
| Workers 프록시 | `worker/src/{index,timetables,mock}.ts`, `worker/wrangler.toml` | `/api/stations`, `/api/trip`, `/api/health`. 공식 엔드포인트·헤더(`DB-Client-Id`/`DB-Api-Key`) 확인 완료. 캐싱(역 1일/계획 1시간/변경 30초), IP당 분당 30회 제한, CORS, 입력 검증, 오류 응답에 키 노출 없음. **키가 없으면 결정적 모의 모드** |
| 로컬 실행 | `scripts/worker-dev.ts` | `npm run worker:dev` → Node에서 프록시 실행(:8787), vite dev/preview가 `/api`를 넘김 |

## ✅ 완료 (이번 저장 커밋)

- `app/verify/client.ts` — 브라우저 → 프록시 클라이언트 (오프라인/404/429/타임아웃 구분)
- `updatePeriodDays`의 `extra` — 카드에 없는 칸도 자동 인증되면 도감에 기록
- `aggregate(…, trips)` — 여정 결과가 업적·칭호에 반영 (`oracle_5`, `delay_24h`, `S3의 순교자`, `Frankfurt Hbf 터줏대감`이 이제 달성 가능)
- 3개 언어 문구 추가: `tab.trip`, `trip.*`, `predict.*`, `toast.verified`, `toast.bet_won`, `cell.verified`, `cell.stamp`, `help.trip`

## ⏭️ 남은 작업 (이 순서로)

1. **`app/ui/Trip.tsx` — 여정 탭 화면**
   - 입력: 열차(`parseTrain`), 도착역 검색(`searchStations`, 디바운스), 도착 예정 시각 → `TripRecord` 생성 (meta `trips`에 저장)
   - 여정 카드: 전광판 스타일(열차 뱃지, 역, 계획 → 실제 시각, 큰 `+48` 지연, 승강장 변경, 모의 데이터 뱃지)
   - 예측: 구간 칩(배당 표시) + 판돈 선택 + 걸기 → `placeBet` / 결과 확정 시 `settleTrip` + 토스트
   - "실시간 확인" → `fetchTrip` → `evaluateTrip` → `result` 저장
2. **`App.tsx` 연결**
   - 탭 4개: 오늘 · 여정 · 도감 · 프로필
   - 인증된 칸 자동 도장: 카드에 있는 칸은 `checkCell(..., 'auto')`로 `apply`, 없는 칸은 `extra`로 전달 → 토스트 `toast.verified`
   - 지갑: `walletBalance(config, 체크인한 날 수, trips)`
   - `aggregate(config, days, key, trips)`로 trips 전달
   - 온라인 복귀 시 오늘의 미확정 여정 자동 재확인
3. **`Board.tsx` / `styles.css`** — `marks.get(i) === 'auto'`인 칸에 `is-auto` 클래스 + "인증/VERIFIED/GEPRÜFT" 고무도장 애니메이션
4. **`HelpSheet`에 `help.trip` 항목 추가**
5. 브라우저 확인 (`npm run worker:dev` + `npm run build && npx vite preview`) → 모의 시나리오: 열차 번호 끝자리로 결정 (0 정시, 1 +7, 2 +23·승강장 변경, 3 +65, 4 +131, 5 취소, 6 −2분 조기, 7 +12·승강장 변경, 8 +45, 9 +3)
6. `reports/phase3.md` 작성 → 보고 → 승인

## 📝 미결 사항 / 사용자 확인

- **API 키**: Bahn-Wetter용 키는 그 애플리케이션이 Timetables API를 구독 중이면 재사용 가능. 단 호출 한도를 공유하므로 Zug-Bingo용 애플리케이션을 따로 만드는 것을 권장. 넣는 법: `cd worker && npx wrangler secret put DB_CLIENT_ID` / `DB_API_KEY` (채팅에 붙여 넣지 않기)
- **Trip 카드(노선별 빙고판)**: HANDOFF Phase 3 항목이지만 노선별 확률 데이터(Bahn-Wetter JSON)가 있어야 의미가 있어 보류. 지금은 여정 = 인증 + 예측
- 예측 구간 확률은 추정치 — 정시 60%라 정시 배당이 낮음(×1.7). HANDOFF의 "정시 맞히면 고배당"은 정시율이 낮은 노선에서 성립 → Bahn-Wetter 연결 시 노선별로 자연스럽게 반영
