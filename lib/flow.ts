// 화면 쪽 흐름 헬퍼 (클라이언트 전용).
// 리뷰 결과 → 사건 → 규칙 엔진 → 저장, 그리고 S2 → S3로 결과를 넘기는 sessionStorage.

import { applyEvents } from "./policy";
import { saveState } from "./state";
import { FALLBACK_REVIEW } from "./prompts";
import type {
  AppState,
  Domain,
  DomainEvent,
  ReviewResponse,
  Transition,
} from "./types";

export interface LastReview {
  taskId: string;
  comments: Record<Domain, string>;
  transitions: Transition[];
  helpRequested: Domain[];
  fallback: boolean;
  skipped: boolean;
}

const KEY = "aom.lastReview";

export function stashReview(r: LastReview): void {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(r));
  } catch {
    // ignore
  }
}

export function readReview(): LastReview | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as LastReview) : null;
  } catch {
    return null;
  }
}

const HELP_EVIDENCE: Record<Domain, string> = {
  codebase: "선임 개발자에게 물어봄",
  domain: "기획 담당자에게 물어봄",
  team: "팀장에게 물어봄",
};

/** 리뷰 응답을 사건으로 바꾸고 규칙 엔진에 적용해 저장한다. */
export function finishTask(
  state: AppState,
  taskId: string,
  review: ReviewResponse,
  helpRequested: Domain[],
  opts: { fallback: boolean; skipped: boolean },
): { state: AppState; last: LastReview } {
  const events: DomainEvent[] = (["codebase", "domain", "team"] as Domain[]).map(
    (d) =>
      helpRequested.includes(d)
        ? { taskId, domain: d, kind: "help_requested", evidence: HELP_EVIDENCE[d] }
        : { taskId, domain: d, kind: review[d].kind, evidence: review[d].evidence },
  );
  const r = applyEvents(state, events);
  saveState(r.state);
  const last: LastReview = {
    taskId,
    comments: {
      codebase: review.codebase.comment,
      domain: review.domain.comment,
      team: review.team.comment,
    },
    transitions: r.transitions,
    helpRequested,
    fallback: opts.fallback,
    skipped: opts.skipped,
  };
  stashReview(last);
  return { state: r.state, last };
}

/** 건너뛰기 선택지. LLM 호출 없음. (04_세션2_지시.md S2-b 표) */
export interface SkipChoice {
  id: string;
  label: string;
  review: ReviewResponse;
}

const OK = {
  codebase: {
    kind: "self_success" as const,
    evidence: "수정 위치를 정확히 찾음",
    comment: "RefundService.refund만 고친 거 좋아요. assertTransition도 그대로 살렸고요.",
  },
  domain: {
    kind: "self_success" as const,
    evidence: "환불 조건 3개 모두 확인",
    comment: "기간, 상태, 누적 상한까지 셋 다 봤네요. 지난번엔 빠졌던 건데 이번엔 챙겼어요.",
  },
  team: {
    kind: "self_success" as const,
    evidence: "부분 환불 테스트 추가",
    comment: "테스트 추가한 거 확인했어요. 이번엔 안 물어봐도 됐네요.",
  },
};

export const SKIP_CHOICES: SkipChoice[] = [
  {
    id: "ok",
    label: "잘 해결했다",
    review: OK,
  },
  {
    id: "domain_miss",
    label: "환불 조건을 놓쳤다",
    review: FALLBACK_REVIEW,
  },
  {
    id: "team_miss",
    label: "테스트를 빠뜨렸다",
    review: {
      codebase: OK.codebase,
      domain: OK.domain,
      team: {
        kind: "miss",
        evidence: "상태 전환 변경에 테스트 없음",
        comment: "상태 전환을 바꿨는데 테스트가 없어요. CONTRIBUTING 1항이에요. 이건 머지 못 해요.",
      },
    },
  },
];
