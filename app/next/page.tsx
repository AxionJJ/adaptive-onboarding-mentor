"use client";

// S4 — 다음 태스크 예고. "새 영역 진입 시 지원 상승"이 여기서 보인다.

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { LevelBadge } from "@/components/LevelBadge";
import { LIVE_TASK_ID, NEXT_TASK_ID, getTask } from "@/data/tasks";
import { DOMAIN_LABELS, buildSeedState } from "@/lib/policy";
import { PERSONAS } from "@/lib/prompts";
import { loadState, resetState } from "@/lib/state";
import { DOMAINS, type AppState, type Domain, type Level } from "@/lib/types";

function note(d: Domain, level: Level, newDomainNote?: string): string {
  if (d === "domain") return newDomainNote ?? "";
  const who = PERSONAS[d].name;
  if (level === "silent") return `다음 태스크에서는 ${who}가 먼저 말하지 않습니다.`;
  if (level === "ask") return `${who}가 확인 질문을 한 번 합니다.`;
  return `${who}가 어디를 봐야 하는지 안내합니다.`;
}

export default function NextPage() {
  const router = useRouter();
  const [state, setState] = useState<AppState>(() => buildSeedState());
  useEffect(() => {
    // localStorage 복원 (SSR 불일치 방지를 위해 마운트 후 1회)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(loadState());
  }, []);
  const next = getTask(NEXT_TASK_ID)!;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <Header step="다음 태스크" />

      <section className="mt-8">
        <p className="font-mono text-xs text-zinc-400">{next.id}</p>
        <h1 className="mt-1 text-xl font-semibold">{next.title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">{next.description}</p>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">다음 태스크의 지원 수준</h2>
        <ul className="mt-3 space-y-2">
          {DOMAINS.map((d) => {
            // 도메인은 새 영역이므로 안내로 올라간다. 나머지는 현재 상태 유지.
            const level: Level = d === "domain" ? "guide" : state.domains[d].level;
            const raised = d === "domain" && state.domains.domain.level !== "guide";
            return (
              <li
                key={d}
                className={`grid grid-cols-[6rem_auto] items-start gap-x-3 gap-y-1 rounded-lg border bg-white px-4 py-3 sm:grid-cols-[7rem_4.5rem_1fr] ${
                  raised ? "border-blue-300" : "border-zinc-200"
                }`}
              >
                <span className="font-medium">{DOMAIN_LABELS[d]}</span>
                <LevelBadge level={level} />
                <span className="col-span-2 text-sm text-zinc-600 sm:col-span-1">
                  {note(d, level, next.newDomainNote)}
                  {raised && <span className="ml-1 text-xs text-blue-700">(새 영역이라 지원 상승)</span>}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-sm text-zinc-500">
          익숙해진 영역은 물러나고, 처음 보는 영역에서는 다시 앞에 섭니다.
        </p>
      </section>

      <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={() => {
            resetState();
            router.push("/");
          }}
          className="inline-flex items-center justify-center rounded-lg bg-zinc-900 px-5 py-3 font-semibold text-white hover:bg-zinc-700"
        >
          처음부터 다시 해보기
        </button>
        <button
          type="button"
          onClick={() => {
            resetState();
            router.push(`/task/${LIVE_TASK_ID}`);
          }}
          className="text-sm text-zinc-500 underline-offset-4 hover:underline"
        >
          다른 결과로 다시 해보기
        </button>
      </div>
    </main>
  );
}
