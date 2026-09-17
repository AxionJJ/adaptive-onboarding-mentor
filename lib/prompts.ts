// 프롬프트 3개 + 페르소나. 페르소나는 표현 계층이다 (결정 08).
// 판정(kind/evidence)은 요건 기준으로, 코멘트(comment)만 페르소나 말투로.

import { z } from "zod";
import personasJson from "@/config/personas.json";
import { getFile } from "@/data/company";
import { getTask } from "@/data/tasks";
import { DOMAIN_LABELS, levelLabel } from "./policy";
import type {
  ApproachResponse,
  Domain,
  DomainEvent,
  HintRequest,
  Level,
  Persona,
  ReviewRequest,
  TaskSpec,
} from "./types";

export const PERSONAS: Record<Domain, Persona> = personasJson;

// ---------- 스키마 ----------

export const HintSchema = z.object({ text: z.string() });

const ApproachVerdict = z.object({ understood: z.boolean(), note: z.string() });
export const ApproachSchema = z.object({
  codebase: ApproachVerdict,
  domain: ApproachVerdict,
  team: ApproachVerdict,
});

const ReviewVerdict = z.object({
  kind: z.enum(["self_success", "miss"]),
  evidence: z.string(),
  comment: z.string(),
});
export const ReviewSchema = z.object({
  codebase: ReviewVerdict,
  domain: ReviewVerdict,
  team: ReviewVerdict,
});

// ---------- 공통 ----------

function taskBlock(task: TaskSpec): string {
  return [
    `## 태스크 ${task.id}: ${task.title}`,
    task.description,
    "",
    "## 영역별 확인 요건",
    ...(["codebase", "domain", "team"] as Domain[]).map(
      (d) => `- ${DOMAIN_LABELS[d]}: ${task.requirements[d].join(" / ")}`,
    ),
  ].join("\n");
}

function filesBlock(paths: string[]): string {
  return paths
    .map((p) => getFile(p))
    .filter((f): f is NonNullable<typeof f> => Boolean(f))
    .map((f) => `### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``)
    .join("\n\n");
}

function personaBlock(d: Domain): string {
  const p = PERSONAS[d];
  return `${p.name} (${p.role}). 말투: ${p.tone}`;
}

function eventsBlock(events: DomainEvent[]): string {
  if (events.length === 0) return "(기록 없음)";
  return events
    .map((e) => `- ${e.taskId}: ${e.kind === "miss" ? "놓침" : e.kind === "self_success" ? "자력 성공" : "도움 요청"} — ${e.evidence}`)
    .join("\n");
}

const COMMON_RULES = `당신은 신입 개발자의 온보딩을 돕는 시스템의 일부다.
회사는 결제 서비스 스타트업이며 레포와 문서는 아래에 있다.
반드시 요청된 JSON 형식으로만 답한다. 한국어로 쓴다. 존댓말(해요체)을 쓴다.`;

// ---------- 호출 1: 힌트 ----------

export function buildHintPrompt(req: HintRequest): { system: string; user: string } {
  const task = getTask(req.taskId)!;
  const p = PERSONAS[req.domain];
  const levelInstr: Record<Level, string> = {
    guide: `안내 모드. 이 영역에서 어디를 왜 봐야 하는지 알려준다. 파일명과 조건을 구체적으로 지목한다. 단, 완성된 코드는 주지 않는다. 3문장 이내, 전체 150자 이내.`,
    ask: `질문 모드. 답을 주지 않는다. 이 영역에서 놓치기 쉬운 것을 스스로 확인하게 만드는 질문 딱 1개만 던진다. 1문장.`,
    silent: `침묵 모드. 이 호출은 오지 않아야 한다. 빈 문자열을 반환한다.`,
  };
  const system = `${COMMON_RULES}

당신의 역할: ${personaBlock(req.domain)}
당신이 보는 영역: ${DOMAIN_LABELS[req.domain]}. 다른 영역 얘기는 하지 않는다.
현재 지원 수준: ${levelLabel(req.level)}
${levelInstr[req.level]}
말머리에 이름을 붙이지 않는다 (화면이 붙인다).`;

  const user = `${taskBlock(task)}

## 이 사람의 ${DOMAIN_LABELS[req.domain]} 영역 최근 기록
${eventsBlock(req.recentEvents)}
(놓침이 반복됐다면 그 유형을 이번에 특히 짚어준다. ${p.name}답게.)

## 관련 파일
${filesBlock(task.relevantFiles)}`;
  return { system, user };
}

// ---------- 호출 2: 접근 방법 평가 ----------

export function buildApproachPrompt(req: { taskId: string; approachText: string }): { system: string; user: string } {
  const task = getTask(req.taskId)!;
  const system = `${COMMON_RULES}

사용자가 코드를 고치기 전에 쓴 "접근 방법"을 읽고, 영역별로 **이해했는가**만 판단한다.
- codebase: 어디를(어떤 파일/함수) 왜 고쳐야 하는지 아는가. 수정할 파일과 함수를 맞게 지목했으면 understood=true. assertTransition 사용 같은 구현 디테일은 코드 리뷰에서 보므로 여기서 요구하지 않는다
- domain: 관련 비즈니스 규칙(정책 조건)을 인지하고 있는가. 요건에 있는 조건을 언급하지 않았으면 understood=false
- team: 팀 규칙을 지킬 계획인가. 상태 전환을 바꾸면서 테스트를 추가할 계획이 있으면 understood=true. 정책 함수 호출을 언급하지 않았다는 이유만으로 false를 주지 않는다 (정책 조건 누락은 domain의 몫)
note는 1문장. 이해했으면 무엇을 이해했는지, 아니면 무엇이 빠졌는지 — 단, 답을 직접 알려주지 말고 "확인해볼 것"으로 표현한다.`;
  const user = `${taskBlock(task)}

## 사용자의 접근 방법
${req.approachText}

## 관련 파일
${filesBlock(task.relevantFiles)}`;
  return { system, user };
}

// ---------- 호출 3: 코드 리뷰 ----------

export function buildReviewPrompt(req: ReviewRequest): { system: string; user: string } {
  const task = getTask(req.taskId)!;
  const system = `${COMMON_RULES}

사용자가 제출한 코드를 영역별로 리뷰한다. 영역마다 리뷰어가 다르다:
- codebase → ${personaBlock("codebase")}
- domain → ${personaBlock("domain")}
- team → ${personaBlock("team")}

영역별로 다음을 낸다:
- kind: 그 영역의 확인 요건을 모두 충족하면 "self_success", 하나라도 빠지면 "miss". 요건에 없는 것으로 miss를 주지 않는다.
- 같은 누락을 두 영역에서 이중으로 miss 처리하지 않는다. 정책 조건(상한/기간/상태)을 확인하지 않은 것은 **domain 한 곳**의 miss다. team의 "정책 함수 호출" 요건은 조건을 서비스 코드에 직접 하드코딩한 경우에만 miss이고, 조건을 아예 안 쓴 것은 team miss가 아니다.
- evidence: 판정 근거 한 줄 (20자 내외, 명사형). 화면의 "근거:" 뒤에 그대로 붙는다. 예: "부분 환불 누적 상한 조건 누락", "수정 위치를 정확히 찾음", "부분 환불 테스트 추가"
- comment: 그 리뷰어의 말투로 2문장 이내. 이름은 붙이지 않는다. 같은 유형의 놓침이 기록에 있으면 "지난번과 같은 유형"이라고 말한다.

주의: 테스트 코드가 주석으로 적혀 있어도 "테스트를 추가했다"로 인정한다 (데모 환경이라 파일을 따로 못 만든다).`;

  const help =
    req.helpRequested.length > 0
      ? `\n## 도움 요청한 영역\n${req.helpRequested.map((d) => DOMAIN_LABELS[d]).join(", ")} (이 영역은 판정과 무관하게 시스템이 '도움 요청'으로 기록한다. 코멘트에서 그 사실을 짧게 언급해도 된다.)`
      : "";
  const approach = req.approachResult
    ? `\n## 접근 방법 평가 결과\n${(["codebase", "domain", "team"] as Domain[])
        .map((d) => `- ${DOMAIN_LABELS[d]}: ${req.approachResult![d].understood ? "이해함" : "미흡"} — ${req.approachResult![d].note}`)
        .join("\n")}\n(접근 방법은 맞았는데 코드에서 빠졌다면 "방향은 이해했지만 구현에서 빠졌다"는 뉘앙스로.)`
    : "";

  const user = `${taskBlock(task)}

## 이 사람의 영역별 최근 기록
${(["codebase", "domain", "team"] as Domain[])
  .map((d) => `### ${DOMAIN_LABELS[d]}\n${eventsBlock(req.recentEvents?.[d] ?? [])}`)
  .join("\n")}
${approach}${help}

## 원본 파일 (수정 전)
${filesBlock([task.targetFile])}

## 사용자가 제출한 코드 (${task.targetFile})
\`\`\`
${req.code}
\`\`\`

## 참고 파일
${filesBlock(task.relevantFiles.filter((p) => p !== task.targetFile))}`;
  return { system, user };
}

// ---------- 폴백 (LLM 실패 시. 기본 시나리오로 데모가 계속 가게 한다) ----------

export const FALLBACK_HINT: Record<Domain, Record<Level, string>> = {
  codebase: {
    guide: "환불 로직은 RefundService.refund에 있어요. 상태를 정하는 줄과 assertTransition 호출을 보세요.",
    ask: "이번 수정에서 건드려야 하는 파일이 하나뿐인지 확인해보셨어요?",
    silent: "",
  },
  domain: {
    guide: "RefundPolicy.ts에 환불 조건이 세 개 있어요. 기간, 상태, 그리고 누적 상한. 지금 서비스는 몇 개를 확인하고 있는지 보세요.",
    ask: "부분 환불을 여러 번 하면 누적 금액이 원결제 금액을 넘을 수도 있지 않을까요?",
    silent: "",
  },
  team: {
    guide: "CONTRIBUTING.md 1항: 상태 전환을 바꾸면 테스트가 필수예요. __tests__/RefundService.test.ts에 케이스를 추가하세요.",
    ask: "이 변경에 테스트가 필요할까요?",
    silent: "",
  },
};

export const FALLBACK_APPROACH: ApproachResponse = {
  codebase: { understood: true, note: "수정 위치를 RefundService.refund로 잡은 건 맞아요." },
  domain: { understood: false, note: "환불 조건 중 확인 안 한 게 있는지 RefundPolicy.ts를 다시 봐보세요." },
  team: { understood: true, note: "테스트 추가 계획이 있네요." },
};

export const FALLBACK_REVIEW = {
  codebase: {
    kind: "self_success" as const,
    evidence: "수정 위치를 정확히 찾음",
    comment: "RefundService.refund만 고친 거 좋아요. assertTransition도 그대로 살렸고요.",
  },
  domain: {
    kind: "miss" as const,
    evidence: "부분 환불 누적 상한 조건 누락",
    comment: "누적 환불액이 원결제 금액을 넘는 경우를 안 막았어요. 지난번 환불 조건 누락이랑 같은 유형이에요.",
  },
  team: {
    kind: "self_success" as const,
    evidence: "부분 환불 테스트 추가",
    comment: "테스트 추가한 거 확인했어요. 이번엔 안 물어봐도 됐네요.",
  },
};
