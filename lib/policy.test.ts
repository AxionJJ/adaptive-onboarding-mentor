// 02_실행계획.md 4.4 시드 정합성 표를 그대로 옮긴 테스트.
// 이 테스트가 깨지면 데모 타임라인(하나는 줄고 하나는 유지)이 깨진다.

import { describe, expect, it } from "vitest";
import { applyEvent, applyEvents, buildSeedState, emptyDomainState } from "./policy";
import { DomainEvent } from "./types";

const ev = (
  domain: DomainEvent["domain"],
  kind: DomainEvent["kind"],
  taskId = "T",
): DomainEvent => ({ taskId, domain, kind, evidence: `${kind} evidence` });

describe("시드 재생 → 3주차 상태", () => {
  const s = buildSeedState();

  it("코드베이스: 안내 → 질문 → 침묵", () => {
    expect(s.domains.codebase.level).toBe("silent");
  });
  it("도메인: 안내 유지 (놓침 2회)", () => {
    expect(s.domains.domain.level).toBe("guide");
  });
  it("팀 규칙: 놓침 후 자력 1회 → 질문", () => {
    expect(s.domains.team.level).toBe("ask");
  });
  it("완료 태스크 T1, T2", () => {
    expect(s.completedTaskIds).toEqual(["T1", "T2"]);
  });
});

describe("Task 3 샘플 시나리오: 하나는 줄고 하나는 유지", () => {
  const s = buildSeedState();
  const { state, transitions } = applyEvents(s, [
    ev("codebase", "self_success", "T3"),
    ev("domain", "miss", "T3"),
    ev("team", "self_success", "T3"),
  ]);

  it("코드베이스 침묵 유지 (하한)", () => {
    expect(state.domains.codebase.level).toBe("silent");
    expect(transitions[0].direction).toBe("keep");
  });
  it("도메인 안내 유지 (상한, 3회째)", () => {
    expect(state.domains.domain.level).toBe("guide");
    expect(transitions[1].direction).toBe("keep");
    expect(transitions[1].reason).toContain("3회");
  });
  it("팀 규칙 질문 → 침묵", () => {
    expect(state.domains.team.level).toBe("silent");
    expect(transitions[2].direction).toBe("down");
  });
  it("T3가 완료 목록에 추가됨", () => {
    expect(state.completedTaskIds).toContain("T3");
  });
});

describe("건너뛰기 선택지별 결과", () => {
  it("'잘 해결했다' → 도메인도 한 단계 내려감", () => {
    const { state } = applyEvents(buildSeedState(), [
      ev("codebase", "self_success", "T3"),
      ev("domain", "self_success", "T3"),
      ev("team", "self_success", "T3"),
    ]);
    expect(state.domains.domain.level).toBe("ask");
    expect(state.domains.team.level).toBe("silent");
  });
  it("'테스트를 빠뜨렸다' → 팀 규칙 질문 → 안내", () => {
    const { state } = applyEvents(buildSeedState(), [
      ev("codebase", "self_success", "T3"),
      ev("domain", "self_success", "T3"),
      ev("team", "miss", "T3"),
    ]);
    expect(state.domains.team.level).toBe("guide");
  });
});

describe("도움 요청", () => {
  it("수준은 유지하고 연속 기록만 끊는다", () => {
    const ds = { ...emptyDomainState(), level: "silent" as const, successStreak: 0 };
    const r = applyEvent(ds, ev("codebase", "help_requested"));
    expect(r.state.level).toBe("silent");
    expect(r.transition.direction).toBe("keep");
    expect(r.transition.reason).toContain("도움");
  });
});

describe("경계", () => {
  it("guide에서 miss는 guide 유지", () => {
    const r = applyEvent(emptyDomainState(), ev("domain", "miss"));
    expect(r.state.level).toBe("guide");
  });
  it("silent에서 success는 silent 유지", () => {
    const ds = { ...emptyDomainState(), level: "silent" as const };
    const r = applyEvent(ds, ev("codebase", "self_success"));
    expect(r.state.level).toBe("silent");
  });
});
