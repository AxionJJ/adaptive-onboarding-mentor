"use client";

// S4 — 다음 태스크 예고. 새 영역(정산)에 들어가니 도메인 지원이 다시 올라간다.

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DomainCard } from "@/components/DomainCard";
import { Header } from "@/components/Header";
import { LIVE_TASK_ID, NEXT_TASK_ID, getTask } from "@/data/tasks";
import { buildSeedState } from "@/lib/policy";
import { PERSONAS } from "@/lib/prompts";
import { loadState, resetState } from "@/lib/state";
import { DOMAINS, type AppState, type Domain, type Level } from "@/lib/types";

function note(d: Domain, level: Level, newDomainNote?: string): string {
  if (d === "domain") return newDomainNote ?? "";
  const who = PERSONAS[d].name;
  if (level === "silent") return `${who}는 먼저 말하지 않습니다.`;
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
    <main className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8">
      <Header step="다음 태스크" />

      <section className="mt-10 max-w-3xl">
        <p className="font-mono text-xs text-faint">{next.id}</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-[26px]">{next.title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">{next.description}</p>
        <p className="mt-4 text-[15px] leading-relaxed">
          익숙해진 영역에서는 물러나고, 처음 보는 영역에서는 다시 앞에 섭니다.
        </p>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        {DOMAINS.map((d) => {
          const level: Level = d === "domain" ? "guide" : state.domains[d].level;
          const raised = d === "domain" && state.domains.domain.level !== "guide";
          return (
            <DomainCard key={d} domain={d} level={level} emphasize={d === "domain"}>
              <p className="text-[13px] leading-relaxed text-muted">
                {note(d, level, next.newDomainNote)}
                {raised && <span className="mt-1 block font-bold text-guide-fg">새 영역이라 지원을 올립니다.</span>}
              </p>
            </DomainCard>
          );
        })}
      </section>

      <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={() => {
            resetState();
            router.push("/");
          }}
          className="inline-flex items-center justify-center rounded-xl bg-ink px-5 py-3.5 text-[15px] font-bold text-ink-fg hover:opacity-90"
        >
          처음부터 다시 해보기
        </button>
        <button
          type="button"
          onClick={() => {
            resetState();
            router.push(`/task/${LIVE_TASK_ID}`);
          }}
          className="text-sm text-muted underline-offset-4 hover:text-fg hover:underline"
        >
          다른 결과로 다시 해보기
        </button>
      </div>
    </main>
  );
}
