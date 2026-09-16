// 가상 회사 "페이플로우" 결제 서비스 레포. 실존 회사 아님.
// 파일은 모두 문자열이다 — 앱 코드가 아니라 데모 데이터이므로 컴파일 대상이 아니다.

export interface RepoFile {
  path: string;
  content: string;
}

export const COMPANY_NAME = "페이플로우";

export const REPO_FILES: RepoFile[] = [
  {
    path: "src/payment/PaymentStatus.ts",
    content: `export enum PaymentStatus {
  PAID = "PAID",
  REFUND_PENDING = "REFUND_PENDING",
  PARTIALLY_REFUNDED = "PARTIALLY_REFUNDED",
  REFUNDED = "REFUNDED",
  CANCELED = "CANCELED",
}

// 허용된 상태 전환. 여기 없는 전환은 InvalidTransitionError.
const TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  [PaymentStatus.PAID]: [
    PaymentStatus.REFUND_PENDING,
    PaymentStatus.PARTIALLY_REFUNDED,
    PaymentStatus.REFUNDED,
    PaymentStatus.CANCELED,
  ],
  [PaymentStatus.REFUND_PENDING]: [
    PaymentStatus.PARTIALLY_REFUNDED,
    PaymentStatus.REFUNDED,
  ],
  [PaymentStatus.PARTIALLY_REFUNDED]: [
    PaymentStatus.PARTIALLY_REFUNDED,
    PaymentStatus.REFUNDED,
  ],
  [PaymentStatus.REFUNDED]: [],
  [PaymentStatus.CANCELED]: [],
};

export class InvalidTransitionError extends Error {
  constructor(from: PaymentStatus, to: PaymentStatus) {
    super("Invalid transition: " + from + " -> " + to);
  }
}

export function assertTransition(from: PaymentStatus, to: PaymentStatus): void {
  if (!TRANSITIONS[from].includes(to)) {
    throw new InvalidTransitionError(from, to);
  }
}
`,
  },
  {
    path: "src/payment/Payment.ts",
    content: `import { PaymentStatus } from "./PaymentStatus";

export interface Payment {
  id: string;
  orderId: string;
  /** 원결제 금액 (원) */
  amount: number;
  /** 지금까지 환불된 누적 금액 (원) */
  refundedAmount: number;
  status: PaymentStatus;
  paidAt: Date;
}
`,
  },
  {
    path: "src/payment/RefundPolicy.ts",
    content: `import { Payment } from "./Payment";
import { PaymentStatus } from "./PaymentStatus";

/** 환불 가능 기간: 결제일로부터 7일 (docs/domain-glossary.md "환불 가능 기간") */
export const REFUND_WINDOW_DAYS = 7;

export function isWithinRefundWindow(payment: Payment, now: Date): boolean {
  const ms = now.getTime() - payment.paidAt.getTime();
  return ms <= REFUND_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

/** 이미 전액 환불되었거나 취소된 결제는 환불 불가 */
export function isRefundableStatus(payment: Payment): boolean {
  return (
    payment.status === PaymentStatus.PAID ||
    payment.status === PaymentStatus.REFUND_PENDING ||
    payment.status === PaymentStatus.PARTIALLY_REFUNDED
  );
}

/**
 * 부분 환불 누적 상한: 누적 환불액이 원결제 금액을 넘을 수 없다.
 * (docs/domain-glossary.md "부분 환불 누적 상한")
 */
export function isWithinAmountLimit(payment: Payment, amount: number): boolean {
  return amount > 0 && payment.refundedAmount + amount <= payment.amount;
}
`,
  },
  {
    path: "src/payment/RefundService.ts",
    content: `import { Payment } from "./Payment";
import { PaymentStatus, assertTransition } from "./PaymentStatus";
import { isRefundableStatus, isWithinRefundWindow } from "./RefundPolicy";

export class RefundRejectedError extends Error {}

export class RefundService {
  constructor(private readonly now: () => Date = () => new Date()) {}

  /**
   * 환불 처리. amount가 남은 금액보다 작으면 부분 환불이다.
   * BUG(T3): 부분 환불인데도 항상 REFUNDED로 전환된다.
   */
  refund(payment: Payment, amount: number): Payment {
    if (!isRefundableStatus(payment)) {
      throw new RefundRejectedError("환불 불가 상태: " + payment.status);
    }
    if (!isWithinRefundWindow(payment, this.now())) {
      throw new RefundRejectedError("환불 가능 기간이 지났습니다");
    }

    const next = PaymentStatus.REFUNDED;
    assertTransition(payment.status, next);

    return {
      ...payment,
      refundedAmount: payment.refundedAmount + amount,
      status: next,
    };
  }
}
`,
  },
  {
    path: "src/payment/PaymentController.ts",
    content: `import { Payment } from "./Payment";
import { RefundService, RefundRejectedError } from "./RefundService";

interface RefundRequest {
  paymentId: string;
  amount: number;
}

export class PaymentController {
  constructor(
    private readonly refundService: RefundService,
    private readonly repo: { find(id: string): Payment | undefined; save(p: Payment): void },
  ) {}

  /** POST /payments/:id/refund */
  postRefund(req: RefundRequest): { status: number; body: unknown } {
    const payment = this.repo.find(req.paymentId);
    if (!payment) return { status: 404, body: { error: "payment not found" } };
    try {
      const updated = this.refundService.refund(payment, req.amount);
      this.repo.save(updated);
      return { status: 200, body: updated };
    } catch (e) {
      if (e instanceof RefundRejectedError) {
        return { status: 409, body: { error: e.message } };
      }
      throw e;
    }
  }
}
`,
  },
  {
    path: "src/payment/__tests__/RefundService.test.ts",
    content: `import { describe, expect, it } from "vitest";
import { Payment } from "../Payment";
import { PaymentStatus } from "../PaymentStatus";
import { RefundService } from "../RefundService";

const paid = (over: Partial<Payment> = {}): Payment => ({
  id: "p1",
  orderId: "o1",
  amount: 10000,
  refundedAmount: 0,
  status: PaymentStatus.PAID,
  paidAt: new Date("2026-09-10T00:00:00Z"),
  ...over,
});

describe("RefundService.refund", () => {
  const svc = new RefundService(() => new Date("2026-09-12T00:00:00Z"));

  it("전액 환불 → REFUNDED", () => {
    const r = svc.refund(paid(), 10000);
    expect(r.status).toBe(PaymentStatus.REFUNDED);
    expect(r.refundedAmount).toBe(10000);
  });

  it("환불 가능 기간이 지나면 거부", () => {
    const late = new RefundService(() => new Date("2026-09-20T00:00:00Z"));
    expect(() => late.refund(paid(), 1000)).toThrow("기간");
  });

  it("이미 환불된 결제는 거부", () => {
    expect(() =>
      svc.refund(paid({ status: PaymentStatus.REFUNDED, refundedAmount: 10000 }), 1000),
    ).toThrow("환불 불가");
  });
});
`,
  },
  {
    path: "docs/domain-glossary.md",
    content: `# 결제 도메인 용어집

| 용어 | 정의 |
|---|---|
| 원결제 금액 | 고객이 최초 결제한 금액. Payment.amount |
| 부분 환불 | 원결제 금액보다 적은 금액을 환불하는 것. 여러 번 가능 |
| 부분 환불 누적 상한 | 부분 환불을 여러 번 하더라도 누적 환불액이 원결제 금액을 넘을 수 없다. RefundPolicy.isWithinAmountLimit |
| 환불 가능 기간 | 결제일로부터 7일. 이후에는 CS 승인 없이는 환불 불가 |
| 정산 대기 | 환불 완료 후 PG사 정산이 끝나기 전 상태. (T4에서 도입 예정) |

## 환불 정책 3원칙

1. 환불 가능 기간 안이어야 한다.
2. 이미 전액 환불되었거나 취소된 결제는 다시 환불할 수 없다.
3. 누적 환불액은 원결제 금액을 넘을 수 없다.

세 조건은 모두 RefundPolicy.ts에 함수로 있다. 환불 로직을 고칠 때는 셋 다 확인한다.
`,
  },
  {
    path: "CONTRIBUTING.md",
    content: `# 기여 규칙

## PR 규칙

1. **상태 전환(PaymentStatus)을 바꾸는 변경에는 테스트가 반드시 있어야 한다.**
   \\_\\_tests\\_\\_ 폴더에 해당 케이스를 추가한다. 테스트 없는 상태 전환 PR은 머지하지 않는다.
2. 정책 조건은 RefundPolicy.ts의 함수를 호출한다. 서비스 코드 안에 조건을 직접 쓰지 않는다.
3. 커밋 메시지는 "fix:", "feat:", "test:" 접두어로 시작한다.

## 리뷰

- 팀장이 PR 규칙을, 선임 개발자가 코드 구조를, 기획 담당자가 정책 조건을 각각 본다.
`,
  },
];

export function getFile(path: string): RepoFile | undefined {
  return REPO_FILES.find((f) => f.path === path);
}
