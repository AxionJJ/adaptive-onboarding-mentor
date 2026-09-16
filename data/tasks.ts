import { TaskSpec } from "@/lib/types";

export const TASKS: TaskSpec[] = [
  {
    id: "T1",
    title: "결제 취소 API에 상태 검증 추가",
    description:
      "PaymentController.postRefund가 환불 불가 상태(REFUNDED, CANCELED)에서도 환불을 진행하는 문제를 고치세요.",
    targetFile: "src/payment/PaymentController.ts",
    relevantFiles: ["src/payment/PaymentController.ts", "src/payment/PaymentStatus.ts"],
    requirements: {
      codebase: ["수정 위치가 PaymentController 또는 RefundService임을 파악"],
      domain: ["환불 가능 기간 조건 확인"],
      team: ["상태 전환 변경에 테스트 추가"],
    },
  },
  {
    id: "T2",
    title: "환불 정책 조건 누락 수정",
    description:
      "RefundService.refund가 RefundPolicy의 조건을 일부만 확인하는 문제를 고치세요.",
    targetFile: "src/payment/RefundService.ts",
    relevantFiles: ["src/payment/RefundService.ts", "src/payment/RefundPolicy.ts"],
    requirements: {
      codebase: ["RefundPolicy 호출 흐름 파악"],
      domain: ["이미 환불된 결제 재환불 차단"],
      team: ["테스트 추가"],
    },
  },
  {
    id: "T3",
    title: "부분 환불 시 상태 전환 오류 수정",
    description:
      "고객이 10,000원 결제 중 3,000원만 환불을 요청했는데 결제 상태가 REFUNDED(전액 환불)로 바뀝니다. " +
      "부분 환불이면 PARTIALLY_REFUNDED로, 남은 금액을 전부 환불하면 REFUNDED로 전환되도록 고치세요.",
    targetFile: "src/payment/RefundService.ts",
    relevantFiles: [
      "src/payment/RefundService.ts",
      "src/payment/RefundPolicy.ts",
      "src/payment/PaymentStatus.ts",
      "src/payment/Payment.ts",
      "docs/domain-glossary.md",
      "CONTRIBUTING.md",
    ],
    requirements: {
      codebase: [
        "수정 위치가 RefundService.refund임을 파악",
        "PaymentStatus.assertTransition을 우회하지 않고 사용",
        "다른 파일(PaymentController 등)을 불필요하게 건드리지 않음",
      ],
      domain: [
        "부분 환불 누적 상한 확인 — refundedAmount + amount가 원결제 금액을 넘으면 거부 (RefundPolicy.isWithinAmountLimit 호출)",
        "환불 가능 기간과 환불 불가 상태 검증을 그대로 유지",
        "남은 금액 전부 환불 시에만 REFUNDED, 아니면 PARTIALLY_REFUNDED",
      ],
      team: [
        "상태 전환을 바꿨으므로 __tests__/RefundService.test.ts에 부분 환불 케이스 테스트 추가 (CONTRIBUTING 1항)",
        "정책 조건을 서비스 코드에 직접 쓰지 않고 RefundPolicy 함수 호출 (CONTRIBUTING 2항)",
      ],
    },
  },
  {
    id: "T4",
    title: "정산 대기 상태 도입",
    description:
      "환불 완료 후 PG사 정산이 끝나기 전까지 SETTLEMENT_PENDING 상태를 거치도록 상태 모델을 확장하세요.",
    targetFile: "src/payment/PaymentStatus.ts",
    relevantFiles: ["src/payment/PaymentStatus.ts", "docs/domain-glossary.md"],
    requirements: {
      codebase: ["TRANSITIONS 표 확장"],
      domain: ["정산 대기의 정의와 전환 조건 (새 영역)"],
      team: ["상태 전환 테스트"],
    },
    newDomainNote:
      "\"정산\"은 처음 보는 영역입니다. 도메인은 안내부터 시작합니다.",
  },
];

export function getTask(id: string): TaskSpec | undefined {
  return TASKS.find((t) => t.id === id);
}

/** 심사위원이 수행하는 태스크 */
export const LIVE_TASK_ID = "T3";
export const NEXT_TASK_ID = "T4";

// ---- S2 샘플 버튼 문구 (02_실행계획.md 5.4) ----
// 이 조합이 "도메인 miss, 나머지 self_success" 기본 시나리오를 만든다.

export const SAMPLE_APPROACH =
  "RefundService.refund()에서 환불 후 남은 금액을 계산해서, 남은 금액이 0이면 REFUNDED, " +
  "아니면 PARTIALLY_REFUNDED로 전환하겠습니다. 상태 전환이 바뀌므로 " +
  "__tests__/RefundService.test.ts에 부분 환불 케이스 테스트를 추가하겠습니다.";

export const SAMPLE_CODE = `import { Payment } from "./Payment";
import { PaymentStatus, assertTransition } from "./PaymentStatus";
import { isRefundableStatus, isWithinRefundWindow } from "./RefundPolicy";

export class RefundRejectedError extends Error {}

export class RefundService {
  constructor(private readonly now: () => Date = () => new Date()) {}

  refund(payment: Payment, amount: number): Payment {
    if (!isRefundableStatus(payment)) {
      throw new RefundRejectedError("환불 불가 상태: " + payment.status);
    }
    if (!isWithinRefundWindow(payment, this.now())) {
      throw new RefundRejectedError("환불 가능 기간이 지났습니다");
    }

    const refundedAmount = payment.refundedAmount + amount;
    const remaining = payment.amount - refundedAmount;
    const next =
      remaining === 0 ? PaymentStatus.REFUNDED : PaymentStatus.PARTIALLY_REFUNDED;
    assertTransition(payment.status, next);

    return { ...payment, refundedAmount, status: next };
  }
}

// --- __tests__/RefundService.test.ts 에 추가 ---
// it("부분 환불 → PARTIALLY_REFUNDED", () => {
//   const r = svc.refund(paid(), 3000);
//   expect(r.status).toBe(PaymentStatus.PARTIALLY_REFUNDED);
//   expect(r.refundedAmount).toBe(3000);
// });
// it("남은 금액 전부 환불 → REFUNDED", () => {
//   const r = svc.refund(paid({ refundedAmount: 7000, status: PaymentStatus.PARTIALLY_REFUNDED }), 3000);
//   expect(r.status).toBe(PaymentStatus.REFUNDED);
// });
`;
