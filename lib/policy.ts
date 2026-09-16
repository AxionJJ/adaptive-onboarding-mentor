// 규칙 엔진 — LLM이 아니다. 순수 함수만 있다.
// LLM은 "무슨 일이 일어났는가"(DomainEvent)까지만 판정하고,
// 지원 수준(Level)은 여기서 결정한다. (결정 05)

import levelsJson from "@/config/levels.json";
import seedJson from "@/config/seed.json";
import {
  AppState,
  DOMAINS,
  Domain,
  DomainEvent,
  DomainState,
  Level,
  LevelsConfig,
  Transition,
} from "./types";

export const LEVELS: LevelsConfig = levelsJson as LevelsConfig;

export const DOMAIN_LABELS: Record<Domain, string> = {
  codebase: "코드베이스",
  domain: "도메인",
  team: "팀 규칙",
};

export function levelLabel(level: Level): string {
  return LEVELS.labels[level];
}

function shift(level: Level, delta: number, cfg: LevelsConfig): Level {
  const i = cfg.order.indexOf(level);
  const j = Math.min(cfg.order.length - 1, Math.max(0, i + delta));
  return cfg.order[j];
}

function trailingMisses(events: DomainEvent[]): number {
  let n = 0;
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].kind === "miss") n++;
    else break;
  }
  return n;
}

export function emptyDomainState(cfg: LevelsConfig = LEVELS): DomainState {
  return { level: cfg.rules.initialLevel, events: [], successStreak: 0 };
}

export function emptyState(cfg: LevelsConfig = LEVELS): AppState {
  return {
    domains: {
      codebase: emptyDomainState(cfg),
      domain: emptyDomainState(cfg),
      team: emptyDomainState(cfg),
    },
    completedTaskIds: [],
  };
}

/**
 * 사건 하나를 영역 상태에 적용한다.
 *  miss           -> 한 단계 상향 (guide 상한), streak 0
 *  help_requested -> 유지, streak 0
 *  self_success   -> streak+1, 임계값 도달 시 한 단계 하향 (silent 하한), streak 0
 */
export function applyEvent(
  ds: DomainState,
  event: DomainEvent,
  cfg: LevelsConfig = LEVELS,
): { state: DomainState; transition: Transition } {
  const from = ds.level;
  const events = [...ds.events, event];
  let level = from;
  let streak = ds.successStreak;
  let reason = "";

  if (event.kind === "miss") {
    level = shift(from, -cfg.rules.raiseOnMiss, cfg); // guide 쪽으로
    streak = 0;
    const n = trailingMisses(events);
    reason =
      level === from
        ? `지원 유지 (놓침 ${n}회 반복). 근거: ${event.evidence}`
        : `지원 올림 (놓침). 근거: ${event.evidence}`;
  } else if (event.kind === "help_requested") {
    streak = 0;
    reason = `지원 유지 (도움 요청으로 자력 연속 기록 끊김). 근거: ${event.evidence}`;
  } else {
    streak += 1;
    if (streak >= cfg.rules.lowerAfterConsecutiveSuccess) {
      level = shift(from, +1, cfg); // silent 쪽으로
      streak = 0;
    }
    const selfCount = events.filter((e) => e.kind === "self_success").length;
    reason =
      level === from
        ? `지원 유지 (이미 최소 단계, 자력 ${selfCount}회째). 근거: ${event.evidence}`
        : `지원 낮춤 (자력 성공). 근거: ${event.evidence}`;
  }

  const direction: Transition["direction"] =
    cfg.order.indexOf(level) > cfg.order.indexOf(from)
      ? "down"
      : cfg.order.indexOf(level) < cfg.order.indexOf(from)
        ? "up"
        : "keep";

  return {
    state: { level, events, successStreak: streak },
    transition: { domain: event.domain, from, to: level, direction, reason },
  };
}

/** 여러 사건(한 태스크의 리뷰 결과)을 앱 상태에 적용한다. */
export function applyEvents(
  state: AppState,
  events: DomainEvent[],
  cfg: LevelsConfig = LEVELS,
): { state: AppState; transitions: Transition[] } {
  const domains = { ...state.domains };
  const transitions: Transition[] = [];
  for (const ev of events) {
    const r = applyEvent(domains[ev.domain], ev, cfg);
    domains[ev.domain] = r.state;
    transitions.push(r.transition);
  }
  const taskIds = new Set(state.completedTaskIds);
  for (const ev of events) taskIds.add(ev.taskId);
  return {
    state: { domains, completedTaskIds: [...taskIds] },
    transitions,
  };
}

/** 시드 사건을 규칙으로 재생해서 3주차 상태를 만든다. 상태를 저장하지 않으므로 규칙과 항상 일치한다. */
export function buildSeedState(cfg: LevelsConfig = LEVELS): AppState {
  const { state } = applyEvents(
    emptyState(cfg),
    seedJson.events as DomainEvent[],
    cfg,
  );
  return { ...state, completedTaskIds: [...seedJson.completedTaskIds] };
}

/** S1 화면용: 현재 수준의 근거 한 줄. 마지막 사건들을 요약한다. */
export function currentReason(domain: Domain, ds: DomainState): string {
  const evs = ds.events;
  if (evs.length === 0) return "아직 기록 없음. 안내부터 시작합니다.";
  const last = evs[evs.length - 1];
  if (last.kind === "miss") {
    const n = trailingMisses(evs);
    return n >= 2
      ? `같은 유형 놓침 ${n}회 반복 — ${last.evidence}`
      : `놓침 — ${last.evidence}`;
  }
  if (last.kind === "help_requested") {
    return `도움 요청 — ${last.evidence}`;
  }
  let n = 0;
  for (let i = evs.length - 1; i >= 0 && evs[i].kind === "self_success"; i--) n++;
  return n >= 2
    ? `최근 ${n}개 태스크에서 자력 성공 — ${last.evidence}`
    : `자력 성공 — ${last.evidence}`;
}

export function eventsForTask(state: AppState, taskId: string): DomainEvent[] {
  return DOMAINS.flatMap((d) =>
    state.domains[d].events.filter((e) => e.taskId === taskId),
  );
}
