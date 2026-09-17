"use client";

// S3 — 리뷰 + 상태 변화. "하나는 줄고 하나는 유지"가 카드 3장의 색으로 보인다.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { LevelBadge, levelBorder } from "@/components/LevelBadge";
import { getTask } from "@/data/tasks";
import { readReview, type LastReview } from "@/lib/flow";
import { DOMAIN_LABELS } from "@/lib/policy";
import { PERSONAS } from "@/lib/prompts";
import { DOMAINS, type Transition } from "@/lib/types";

const DIRECTION: Record<Transition["direction"], { cls: string; label: string }> = {
  down: { cls: "text-ok", label: "지원 낮춤" },
  keep: { cls: "text-faint", label: "유지" },
  up: { cls: "text-warn", label: "지원 올림" },
};

export default function ReviewPage() {
  const router = useRouter();
  const [last, setLast] = useState<LastReview | null | undefined>(undefined);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const r = readReview();
    if (!r) {
      router.replace("/");
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLast(r);
  }, [router]);

  // 카드 3장이 0.5초 간격으로 드러난다. 이 화면의 유일한 연출.
  useEffect(() => {
    if (!last) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShown(0);
    const timers = last.transitions.map((_, i) => setTimeout(() => setShown(i + 1), 500 + i * 500));
    return () => timers.forEach(clearTimeout);
  }, [last]);

  if (!last) return null;
  const task = getTask(last.taskId);

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8">
      <Header step={`${last.taskId} 리뷰`} />

      <section className="mt-10">
        <h1 className="text-2xl font-black tracking-tight sm:text-[26px]">리뷰어 3명의 코멘트</h1>
        <p className="mt-1 text-sm text-muted">
          {task?.title}
          {last.skipped && ". 결과를 가정하고 진행했습니다"}
          {last.fallback && ". LLM 연결 없이 기본 시나리오로 진행했습니다"}
        </p>
        <ul className="mt-5 flex flex-col gap-3">
          {DOMAINS.map((d) => (
            <li key={d} className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-5 sm:flex-row sm:gap-5">
              <div className="w-28 shrink-0">
                <p className="font-bold">{PERSONAS[d].name}</p>
                <p className="text-xs text-faint">{DOMAIN_LABELS[d]}</p>
              </div>
              <p className="text-[15px] leading-relaxed">
                {last.comments[d]}
                {last.helpRequested.includes(d) && (
                  <span className="mt-1 block text-xs text-faint">이 영역은 물어보고 진행했습니다.</span>
                )}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-black tracking-tight sm:text-[26px]">다음 태스크의 지원 수준</h2>
        <p className="mt-1 text-sm text-muted">리뷰 결과를 규칙에 넣은 결과입니다. 수준은 LLM이 정하지 않습니다.</p>
        <ul className="mt-5 grid gap-4 sm:grid-cols-3">
          {last.transitions.map((t, i) => {
            const dir = DIRECTION[t.direction];
            const visible = i < shown;
            return (
              <li
                key={t.domain}
                className={`flex flex-col gap-4 rounded-2xl border bg-card p-6 transition-all duration-500 ${levelBorder(t.to)} ${
                  visible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-muted">{DOMAIN_LABELS[t.domain]}</span>
                  <span className={`text-xs font-bold ${dir.cls}`}>{dir.label}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <LevelBadge level={t.from} size="md" />
                  <span className={`text-lg font-black ${dir.cls}`}>→</span>
                  <LevelBadge level={t.to} size="lg" />
                </div>
                <p className="text-[13px] leading-relaxed text-muted">{t.reason}</p>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Link
          href="/next"
          className="inline-flex items-center justify-center rounded-xl bg-ink px-5 py-3.5 text-[15px] font-bold text-ink-fg hover:opacity-90"
        >
          다음 태스크 보기
        </Link>
        <Link href={`/task/${last.taskId}`} className="text-sm text-muted underline-offset-4 hover:text-fg hover:underline">
          다른 결과로 다시 해보기
        </Link>
      </div>
    </main>
  );
}
