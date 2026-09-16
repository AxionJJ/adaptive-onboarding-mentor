// 데이터 계약 — 02_실행계획.md 4절
// 이 파일이 화면(A)과 AI/데이터(B)의 유일한 접점이다.

export type Domain = "codebase" | "domain" | "team";
export type Level = "guide" | "ask" | "silent"; // 안내 / 질문 / 침묵
export type EventKind = "self_success" | "miss" | "help_requested";

export const DOMAINS: Domain[] = ["codebase", "domain", "team"];

export interface DomainEvent {
  taskId: string;
  domain: Domain;
  kind: EventKind;
  /** 화면에 그대로 노출되는 근거 한 줄 */
  evidence: string;
}

export interface DomainState {
  level: Level;
  /** 시간순. 시드 + 실행 중 추가 */
  events: DomainEvent[];
  /** 연속 자력 성공 횟수 (5단계 확장 시 임계값에 사용) */
  successStreak: number;
}

export interface AppState {
  domains: Record<Domain, DomainState>;
  completedTaskIds: string[];
}

/** 규칙 엔진이 사건 하나를 적용한 결과 */
export interface Transition {
  domain: Domain;
  from: Level;
  to: Level;
  direction: "down" | "up" | "keep";
  /** 화면 노출용. 예: "지원 낮춤. 근거: 자력 성공 2회 연속" */
  reason: string;
}

export interface LevelsConfig {
  order: Level[];
  labels: Record<Level, string>;
  rules: {
    lowerAfterConsecutiveSuccess: number;
    raiseOnMiss: number;
    initialLevel: Level;
  };
}

export interface Persona {
  name: string;
  role: string;
  tone: string;
}

export interface TaskSpec {
  id: string;
  title: string;
  description: string;
  /** 수정 대상 파일 경로 (S2에서 코드 textarea 초기값) */
  targetFile: string;
  relevantFiles: string[];
  /** 영역별로 리뷰어가 확인하는 요건 */
  requirements: Record<Domain, string[]>;
  /** 새 영역 진입 여부 (S4 예고용) */
  newDomainNote?: string;
}

// ---- LLM 호출 입출력 (02_실행계획.md 4.6) ----

export interface HintRequest {
  taskId: string;
  domain: Domain;
  level: Level;
  recentEvents: DomainEvent[];
}
export interface HintResponse {
  text: string;
}

export interface ApproachRequest {
  taskId: string;
  approachText: string;
}
export type ApproachResponse = Record<
  Domain,
  { understood: boolean; note: string }
>;

export interface ReviewRequest {
  taskId: string;
  code: string;
  approachResult?: ApproachResponse | null;
  helpRequested: Domain[];
  /** 영역별 최근 기록 (리뷰어가 '같은 유형 재발'을 말하기 위해) */
  recentEvents?: Partial<Record<Domain, DomainEvent[]>>;
}
export type ReviewVerdict = {
  kind: "self_success" | "miss";
  evidence: string;
  comment: string;
};
export type ReviewResponse = Record<Domain, ReviewVerdict>;
