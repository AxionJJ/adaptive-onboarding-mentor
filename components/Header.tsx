"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { COMPANY_NAME } from "@/data/company";
import { resetState } from "@/lib/state";

export function Header({ step }: { step?: string }) {
  const router = useRouter();
  return (
    <header className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 pb-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Adaptive Onboarding Mentor
        </Link>
        <span className="text-sm text-zinc-500">
          {COMPANY_NAME} · 입사 3주차 · 백엔드 신입
        </span>
        {step && <span className="text-sm text-zinc-400">/ {step}</span>}
      </div>
      <button
        type="button"
        onClick={() => {
          resetState();
          try {
            window.sessionStorage.removeItem("aom.lastReview");
          } catch {
            // ignore
          }
          router.push("/");
          router.refresh();
        }}
        className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs text-zinc-600 hover:bg-zinc-100"
      >
        처음부터
      </button>
    </header>
  );
}
