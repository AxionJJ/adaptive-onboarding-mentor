"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { COMPANY_NAME } from "@/data/company";
import { resetState } from "@/lib/state";
import { ThemeToggle } from "./ThemeToggle";

export function Header({ step }: { step?: string }) {
  const router = useRouter();
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-5">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <Link href="/" className="text-lg font-bold tracking-tight">
          Adaptive Onboarding Mentor
        </Link>
        <span className="text-sm text-muted">
          {COMPANY_NAME} 백엔드팀, 입사 3주차{step ? `, ${step}` : ""}
        </span>
      </div>
      <div className="flex items-center gap-2">
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
          className="h-9 rounded-md border border-line bg-card px-3 text-sm text-muted hover:text-fg"
        >
          처음부터
        </button>
        <ThemeToggle />
      </div>
    </header>
  );
}
