"use client";

// S1 — 3주차 진입. 로그인 없음. 이 화면이 첫 화면이다.

import Link from "next/link";
import { useEffect, useState } from "react";
import { DomainCard } from "@/components/DomainCard";
import { Header } from "@/components/Header";
import { TASKS, LIVE_TASK_ID } from "@/data/tasks";
import { buildSeedState, currentReason } from "@/lib/policy";
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
    <main className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8">
      <Header />

      <section className="mt-10 max-w-3xl">
        <h1 className="text-3xl font-black leading-tight tracking-tight sm:text-4xl">
          영역마다 지원 수준이 다릅니다.
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          코드베이스는 이미 혼자 하고, 도메인은 아직 안내가 필요하고, 팀 규칙은 확인 질문만 남았습니다.
          근거는 지난 기록에서 나옵니다.
        </p>
      </section>

      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        {DOMAINS.map((d) => (
          <DomainCard key={d} domain={d} level={state.domains[d].level} reason={currentReason(d, state.domains[d])} />
        ))}
      </section>

      <section className="mt-6 grid gap-5 lg:grid-cols-[1fr_22rem]">
        <div className="overflow-hidden rounded-2xl border border-line bg-card">
          <h2 className="border-b border-line px-5 py-3 text-xs font-bold text-muted">지난 기록</h2>
          <ul className="divide-y divide-line">
            {done.map((t) => {
              const misses = DOMAINS.flatMap((d) =>
                state.domains[d].events.filter((e) => e.taskId === t.id && e.kind === "miss"),
              );
              return (
                <li key={t.id} className="flex items-center gap-4 px-5 py-4">
                  <span className="w-7 shrink-0 font-mono text-xs text-faint">{t.id}</span>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-sm">{t.title}</span>
                    {misses.length > 0 && (
                      <span className="text-xs text-faint">
                        {misses.map((m) => `${PERSONAS[m.domain].name} 지적`).join(", ")}
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-bold text-ok">완료</span>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="flex flex-col gap-3 rounded-2xl bg-ink p-6 text-ink-fg">
          <span className="text-xs font-bold opacity-70">{liveDone ? "다시 해보기" : "다음 태스크"}</span>
          <span className="text-[17px] font-bold leading-snug">
            {live.id} {live.title}
          </span>
          <Link
            href={`/task/${LIVE_TASK_ID}`}
            className="mt-1 inline-flex items-center justify-center rounded-xl bg-card px-4 py-3.5 text-[15px] font-bold text-fg hover:opacity-90"
          >
            시작하기
          </Link>
          <span className="text-xs opacity-70">직접 해보지 않아도 결과를 가정하고 넘어갈 수 있습니다.</span>
          {liveDone && (
            <Link href="/next" className="text-xs underline underline-offset-4 opacity-80 hover:opacity-100">
              다음 태스크 예고 보기
            </Link>
          )}
        </div>
      </section>
    </main>
  );
}
