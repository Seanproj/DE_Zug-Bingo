// Simulate N daily cards and print a Markdown balance report.
//   npm run report:balance -- --days 30 --from 2026-10-23 --out reports/balance-30d.md
import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { loadConfig } from '../app/config/node.ts';
import { boardLines } from '../app/game/board.ts';
import { generateDailyCard } from '../app/game/card.ts';
import { addDays } from '../app/game/date.ts';
import { simulateCard, squareProbability } from '../app/game/simulate.ts';
import { createI18n } from '../app/i18n/index.ts';

const { values } = parseArgs({
  options: {
    days: { type: 'string', default: '30' },
    from: { type: 'string' },
    trials: { type: 'string', default: '20000' },
    out: { type: 'string' },
  },
});

const config = loadConfig();
const i18n = createI18n(config, 'ko');
const days = Number(values.days);
const from = values.from ?? config.game.daily.epoch;
const trials = Number(values.trials);
const rarities = config.rarity.rarities;
const pct = (x: number, d = 1) => `${(x * 100).toFixed(d)}%`;
const label = (id: string) => i18n.square(id).label;
const tierOf = (id: string) => config.rarityById.get(config.squareById.get(id)!.rarity)!.tier;

/** Difficulty bands on P(≥1 line per day). Tuning targets, not config. */
const band = (p: number) => (p >= 0.4 ? '😴 너무 쉬움' : p >= 0.15 ? '🙂 적정' : p >= 0.05 ? '😤 어려움' : '🧊 너무 어려움');

const rows: { key: string; card: ReturnType<typeof generateDailyCard>; d: ReturnType<typeof simulateCard>; highlights: string[] }[] = [];
const appear = new Map<string, number>();
for (let i = 0; i < days; i++) {
  const key = addDays(from, i);
  const card = generateDailyCard(config, key);
  for (const c of card.cells) if (!c.free) appear.set(c.squareId, (appear.get(c.squareId) ?? 0) + 1);
  const d = simulateCard(config, card, trials);
  const highlights = card.cells
    .filter((c) => !c.free && tierOf(c.squareId) >= 4)
    .map((c) => `${config.rarityById.get(config.squareById.get(c.squareId)!.rarity)!.emoji} ${label(c.squareId)}`);
  rows.push({ key, card, d, highlights });
}

const avg = (f: (r: (typeof rows)[number]) => number) => rows.reduce((n, r) => n + f(r), 0) / rows.length;
const out: string[] = [];
const w = (s = '') => out.push(s);

w(`# Daily 카드 밸런스 리포트 — ${days}일 (${from} ~ ${addDays(from, days - 1)})`);
w();
w(`- generator_version: ${config.game.generator_version} · 시뮬레이션: 카드당 ${trials.toLocaleString()}회 Monte Carlo`);
w(`- 모델: 각 칸이 하루에 독립적으로 발생 (확률 = 칸별 override 또는 등급 기본값), \`implies\` 전파. 실제 지연은 상관관계가 있으므로 **상대 난이도** 지표로 읽을 것.`);
w(`- 난이도 기준 (하루 1줄 이상 확률): 😴 ≥40% · 🙂 15–40% · 😤 5–15% · 🧊 <5%`);
w();
w('## 1. 등급 구성 (카드당, 무료 칸 제외)');
w();
w('| 등급 | 칸 수 | 점수 | 기본 확률/일 | 풀 크기 (daily) | 30일 내 칸당 평균 등장 |');
w('|---|---:|---:|---:|---:|---:|');
for (const r of rarities) {
  const n = config.rarity.daily_card.composition[r.id];
  const pool = config.squares.filter((s) => s.rarity === r.id && s.pools.includes('daily'));
  w(`| ${r.emoji} ${i18n.rarity(r.id)} | ${n} | ${r.points} | ${pct(r.probability, 0)} | ${pool.length} | ${((n * days) / pool.length).toFixed(1)}회 |`);
}
w();
w('## 2. 요약');
w();
w('| 지표 | 값 |');
w('|---|---:|');
w(`| 하루 1줄 이상 확률 (평균) | **${pct(avg((r) => r.d.pLine))}** |`);
w(`| 하루 1줄 이상 확률 (최소 ~ 최대) | ${pct(Math.min(...rows.map((r) => r.d.pLine)))} ~ ${pct(Math.max(...rows.map((r) => r.d.pLine)))} |`);
w(`| 하루 2줄 이상 확률 | ${pct(avg((r) => r.d.pTwoLines))} |`);
w(`| 기대 줄 수 / 일 | ${avg((r) => r.d.expectedLines).toFixed(3)} |`);
w(`| 기대 체크 칸 수 / 일 | ${avg((r) => r.d.expectedMarked).toFixed(1)} / 24 |`);
w(`| 블랙아웃 확률 | ${pct(avg((r) => r.d.pBlackout), 4)} |`);
w(`| 주 5일 통근 시 주간 1줄 이상 경험 확률 | ${pct(1 - Math.pow(1 - avg((r) => r.d.pLine), 5))} |`);
w();
w('## 3. 일자별');
w();
w('| # | 날짜 | 난이도 | 1줄+ | 2줄+ | 기대 줄 | 🫡 축복 라인 | 가장 쉬운 줄 | 가장 어려운 줄 | Legendary / Mythic |');
w('|---:|---|---|---:|---:|---:|---|---|---|---|');
for (const r of rows) {
  const { d } = r;
  w(
    `| ${r.card.number} | ${r.key} | ${band(d.pLine)} | ${pct(d.pLine)} | ${pct(d.pTwoLines)} | ${d.expectedLines.toFixed(2)} | ${r.card.blessedLines.join(' + ')} | ${d.easiestLine.id} ${pct(d.easiestLine.p, 2)} | ${d.hardestLine.id} ${pct(d.hardestLine.p, 4)} | ${r.highlights.join(', ')} |`,
  );
}
w();
w('## 4. 칸별 등장 빈도');
w();
w(`| 칸 | 등급 | 확률/일 | 자동인증 | ${days}일 중 등장 |`);
w('|---|---|---:|:---:|---:|');
const daily = config.squares.filter((s) => s.pools.includes('daily'));
daily.sort((a, b) => tierOf(a.id) - tierOf(b.id) || (appear.get(b.id) ?? 0) - (appear.get(a.id) ?? 0));
for (const s of daily) {
  const r = config.rarityById.get(s.rarity)!;
  w(`| ${s.emoji} ${label(s.id)} (${s.term}) | ${r.emoji} ${i18n.rarity(r.id)} | ${pct(squareProbability(config, s.id), 0)} | ${s.verifiable ? '✅' : '🙋'} | ${appear.get(s.id) ?? 0} |`);
}
w();
w('## 5. 첫 카드 미리보기');
w();
const first = rows[0]!.card;
const size = first.size;
w(`Zug-Bingo #${first.number} (${first.key})`);
w();
w('| ' + Array.from({ length: size }, (_, c) => `c${c}`).join(' | ') + ' |');
w('|' + ' :---: |'.repeat(size));
for (let r = 0; r < size; r++) {
  const cells = Array.from({ length: size }, (_, c) => {
    const cell = first.cells[r * size + c]!;
    if (cell.free) return `${config.game.board.free_square.emoji} **${label(cell.squareId)}**`;
    const sq = config.squareById.get(cell.squareId)!;
    return `${config.rarityById.get(sq.rarity)!.emoji} ${label(sq.id)}`;
  });
  w(`| ${cells.join(' | ')} |`);
}
w();
w(`(줄 ${boardLines(size).length}개: 가로 ${size} · 세로 ${size} · 대각선 2 · 🫡 축복 라인: ${first.blessedLines.join(', ')})`);

const md = out.join('\n') + '\n';
if (values.out) writeFileSync(values.out, md);
process.stdout.write(md);
