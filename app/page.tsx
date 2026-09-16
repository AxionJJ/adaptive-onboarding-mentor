"use client";

// S1 — 3주차 진입. 로그인 없음. 이 화면이 첫 화면이다.

import Link from "next/link";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { LevelBadge } from "@/components/LevelBadge";
import { TASKS, LIVE_TASK_ID } from "@/data/tasks";
import { DOMAIN_LABELS, buildSeedState, currentReason } from "@/lib/policy";
import { PERSONAS } from "@/lib/prompts";
import { loadState } from "@/lib/state";
import { DOMAINS, type AppState } from "@/lib/types";

export default function Home() {
  const [state, setState] = useState<AppState>(() => buildSeedState());
  useEffect(() => {
    // localStorage 복원 (SSR 불일치 방지를 위해 마운트 후 1회)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(loadState());
  }, []);

  const done = TASKS.filter((t) => state.completedTaskIds.includes(t.id));
  const live = TASKS.find((t) => t.id === LIVE_TASK_ID)!;
  const liveDone = state.completedTaskIds.includes(LIVE_TASK_ID);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <Header />

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">지난 기록</h2>
        <ul className="mt-3 divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white">
          {done.map((t) => {
            const misses = DOMAINS.flatMap((d) =>
              state.domains[d].events.filter((e) => e.taskId === t.id && e.kind === "miss"),
            );
            return (
              <li key={t.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3">
                <span className="w-8 shrink-0 font-mono text-xs text-zinc-400">{t.id}</span>
                <span className="flex-1 basis-48">{t.title}</span>
                <span className="text-xs font-medium text-emerald-700">완료</span>
                {misses.length > 0 && (
                  <span className="basis-full pl-11 text-xs text-zinc-500">
                    └ {misses.map((m) => `${PERSONAS[m.domain].name} 지적`).join(", ")}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">지금 상태</h2>
        <p className="mt-1 text-sm text-zinc-500">
          영역마다 지원 수준이 다릅니다. 근거는 기록에서 나옵니다.
        </p>
        <ul className="mt-3 space-y-2">
          {DOMAINS.map((d) => {
            const ds = state.domains[d];
            return (
              <li
                key={d}
                className="grid grid-cols-[6rem_auto] items-start gap-x-3 gap-y-1 rounded-lg border border-zinc-200 bg-white px-4 py-3 sm:grid-cols-[7rem_4.5rem_1fr]"
              >
                <span className="font-medium">{DOMAIN_LABELS[d]}</span>
                <LevelBadge level={ds.level} />
                <span className="col-span-2 text-sm text-zinc-600 sm:col-span-1">
                  <span className="text-zinc-400">근거: </span>
                  {currentReason(d, ds)}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="mt-10 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
        <Link
          href={`/task/${LIVE_TASK_ID}`}
          className="inline-flex items-center justify-center rounded-lg bg-zinc-900 px-5 py-3 font-semibold text-white hover:bg-zinc-700"
        >
          {liveDone ? `${live.id} 다시 해보기` : `${live.id} 시작하기`} — {live.title}
        </Link>
        {liveDone && (
          <Link href="/next" className="text-sm text-zinc-500 underline-offset-4 hover:underline">
            다음 태스크 예고 보기
          </Link>
        )}
      </div>
    </main>
  );
}
