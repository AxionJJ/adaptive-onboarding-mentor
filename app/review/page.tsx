"use client";

// S3 — 리뷰 + 상태 변화. "하나는 줄고 하나는 유지"가 시각적으로 보여야 한다.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { LevelBadge } from "@/components/LevelBadge";
import { getTask } from "@/data/tasks";
import { readReview, type LastReview } from "@/lib/flow";
import { DOMAIN_LABELS } from "@/lib/policy";
import { PERSONAS } from "@/lib/prompts";
import { DOMAINS, type Transition } from "@/lib/types";

const ARROW: Record<Transition["direction"], { cls: string; label: string }> = {
  down: { cls: "text-emerald-700", label: "낮춤" },
  keep: { cls: "text-zinc-400", label: "유지" },
  up: { cls: "text-amber-700", label: "올림" },
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

  // 상태 변화 3줄을 0.5초 간격으로 드러낸다.
  useEffect(() => {
    if (!last) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShown(0);
    const timers = last.transitions.map((_, i) => setTimeout(() => setShown(i + 1), 600 + i * 500));
    return () => timers.forEach(clearTimeout);
  }, [last]);

  if (!last) return null;
  const task = getTask(last.taskId);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <Header step={`${last.taskId} 리뷰`} />

      <section className="mt-8">
        <h1 className="text-xl font-semibold">리뷰</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {task?.title}
          {last.skipped && " · 결과를 가정하고 진행했습니다"}
          {last.fallback && " · (LLM 연결 없음 — 기본 시나리오)"}
        </p>
        <ul className="mt-4 space-y-3">
          {DOMAINS.map((d) => (
            <li key={d} className="flex gap-3 rounded-lg border border-zinc-200 bg-white p-4">
              <div className="w-24 shrink-0">
                <p className="font-semibold">{PERSONAS[d].name}</p>
                <p className="text-xs text-zinc-400">{DOMAIN_LABELS[d]}</p>
              </div>
              <p className="text-sm leading-relaxed text-zinc-700">
                {last.comments[d]}
                {last.helpRequested.includes(d) && (
                  <span className="mt-1 block text-xs text-zinc-400">(이 영역은 물어보고 진행했습니다)</span>
                )}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">상태 변화</h2>
        <p className="mt-1 text-sm text-zinc-500">리뷰 결과를 규칙에 넣은 결과입니다. LLM이 정하지 않습니다.</p>
        <ul className="mt-4 space-y-2">
          {last.transitions.map((t, i) => {
            const a = ARROW[t.direction];
            const visible = i < shown;
            return (
              <li
                key={t.domain}
                className={`grid grid-cols-[6rem_1fr] items-start gap-x-3 gap-y-1 rounded-lg border bg-white px-4 py-3 transition-all duration-500 sm:grid-cols-[7rem_11rem_1fr] ${
                  visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
                } ${t.direction === "down" ? "border-emerald-300" : t.direction === "up" ? "border-amber-300" : "border-zinc-200"}`}
              >
                <span className="font-medium">{DOMAIN_LABELS[t.domain]}</span>
                <span className="flex items-center gap-2">
                  <LevelBadge level={t.from} size="sm" />
                  <span className={`font-semibold ${a.cls}`}>→</span>
                  <LevelBadge level={t.to} size="sm" />
                  <span className={`text-xs ${a.cls}`}>{a.label}</span>
                </span>
                <span className="col-span-2 text-sm text-zinc-600 sm:col-span-1">{t.reason}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Link
          href="/next"
          className="inline-flex items-center justify-center rounded-lg bg-zinc-900 px-5 py-3 font-semibold text-white hover:bg-zinc-700"
        >
          다음 태스크 보기
        </Link>
        <Link href={`/task/${last.taskId}`} className="text-sm text-zinc-500 underline-offset-4 hover:underline">
          다른 결과로 다시 해보기
        </Link>
      </div>
    </main>
  );
}
