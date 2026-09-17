// LLM 판정 안정성 하네스 (배포에 포함되지 않음).
// 사용: cd mentor-app && N=10 LLM_MODEL=gpt-5.5 npx tsx --tsconfig tsconfig.json scripts/llm-harness.mts
// 기대 분포: review 전부 self_success/miss/self_success (샘플 코드는 도메인 누적 상한을 일부러 빠뜨림)
import fs from "node:fs";
for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const { structured, MODEL } = await import("@/lib/llm");
const { ReviewSchema, ApproachSchema, HintSchema, buildReviewPrompt, buildApproachPrompt, buildHintPrompt } = await import("@/lib/prompts");
const { SAMPLE_APPROACH, SAMPLE_CODE } = await import("@/data/tasks");
const { buildSeedState } = await import("@/lib/policy");

const N = Number(process.env.N ?? 10);
const seed = buildSeedState();
const recent = { codebase: seed.domains.codebase.events, domain: seed.domains.domain.events, team: seed.domains.team.events };

async function timed<T>(fn: () => Promise<T>): Promise<[T, number]> {
  const t = Date.now(); const r = await fn(); return [r, Date.now() - t];
}

console.log(`model=${MODEL} N=${N}`);
// 1) 접근 방법 평가 (1회 — 결과를 리뷰 입력으로 씀)
const ap = buildApproachPrompt({ taskId: "T3", approachText: SAMPLE_APPROACH });
const [approach, apMs] = await timed(() => structured(ApproachSchema, ap.system, ap.user));
console.log(`approach ${apMs}ms`, approach ? JSON.stringify({ c: approach.codebase.understood, d: approach.domain.understood, t: approach.team.understood }) : "NULL");
if (approach) for (const d of ["codebase", "domain", "team"] as const) console.log(`   ${d}: ${approach[d].note}`);

// 2) 리뷰 N회 (샘플 코드 = 도메인 누적 상한 누락 → 기대: c=ok d=miss t=ok)
const rp = buildReviewPrompt({ taskId: "T3", code: SAMPLE_CODE, approachResult: approach ?? undefined, helpRequested: [], recentEvents: recent });
const tally: Record<string, number> = {};
const lat: number[] = [];
for (let i = 0; i < N; i++) {
  const [r, ms] = await timed(() => structured(ReviewSchema, rp.system, rp.user));
  lat.push(ms);
  if (!r) { tally.NULL = (tally.NULL ?? 0) + 1; console.log(`#${i + 1} ${ms}ms NULL`); continue; }
  const key = `${r.codebase.kind}/${r.domain.kind}/${r.team.kind}`;
  tally[key] = (tally[key] ?? 0) + 1;
  console.log(`#${i + 1} ${ms}ms ${key} | ${r.codebase.evidence} | ${r.domain.evidence} | ${r.team.evidence}`);
  if (i === 0) for (const d of ["codebase", "domain", "team"] as const) console.log(`   ${d} comment: ${r[d].comment}`);
}
lat.sort((a, b) => a - b);
console.log("review tally:", JSON.stringify(tally), `p50=${lat[Math.floor(lat.length / 2)]}ms max=${lat[lat.length - 1]}ms`);

// 3) 힌트 (도메인 guide, 팀 ask) 1회씩
for (const [domain, level] of [["domain", "guide"], ["team", "ask"]] as const) {
  const hp = buildHintPrompt({ taskId: "T3", domain, level, recentEvents: recent[domain] });
  const [h, ms] = await timed(() => structured(HintSchema, hp.system, hp.user));
  console.log(`hint ${domain}/${level} ${ms}ms:`, h?.text ?? "NULL");
}
