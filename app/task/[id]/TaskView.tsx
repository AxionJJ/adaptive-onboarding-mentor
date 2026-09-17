"use client";

// S2 — 태스크 화면. 리뷰어 3장이 맨 위 가로 띠. 한 화면에 [침묵][안내][질문]이 동시에 보인다.

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DomainCard } from "@/components/DomainCard";
import { Header } from "@/components/Header";
import { getFile } from "@/data/company";
import { SAMPLE_APPROACH, SAMPLE_CODE, getTask } from "@/data/tasks";
import { SKIP_CHOICES, finishTask } from "@/lib/flow";
import { DOMAIN_LABELS, buildSeedState } from "@/lib/policy";
import { PERSONAS } from "@/lib/prompts";
import { loadState } from "@/lib/state";
import {
  DOMAINS,
  type ApproachResponse,
  type AppState,
  type Domain,
  type ReviewResponse,
} from "@/lib/types";

type HintState = { text: string; loading: boolean; error: boolean };

export function TaskView({ taskId }: { taskId: string }) {
  const router = useRouter();
  const task = getTask(taskId)!;
  const [state, setState] = useState<AppState>(() => buildSeedState());
  const [tab, setTab] = useState(task.targetFile);
  const [approach, setApproach] = useState("");
  const [approachResult, setApproachResult] = useState<(ApproachResponse & { fallback?: boolean }) | null>(null);
  const [approachBusy, setApproachBusy] = useState(false);
  const [code, setCode] = useState(() => getFile(task.targetFile)?.content ?? "");
  const [hints, setHints] = useState<Record<Domain, HintState>>({
    codebase: { text: "", loading: false, error: false },
    domain: { text: "", loading: false, error: false },
    team: { text: "", loading: false, error: false },
  });
  const [helpRequested, setHelpRequested] = useState<Domain[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [skipOpen, setSkipOpen] = useState(false);
  const [skipChoice, setSkipChoice] = useState(SKIP_CHOICES[1].id);

  useEffect(() => {
    const s = loadState();
    // localStorage 복원 (SSR 불일치 방지를 위해 마운트 후 1회)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(s);
    for (const d of DOMAINS) {
      if (s.domains[d].level !== "silent") void fetchHint(d, s.domains[d].level, s);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  async function fetchHint(domain: Domain, level: "guide" | "ask", s: AppState) {
    setHints((h) => ({ ...h, [domain]: { ...h[domain], loading: true, error: false } }));
    try {
      const res = await fetch("/api/hint", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ taskId, domain, level, recentEvents: s.domains[domain].events.slice(-2) }),
      });
      const json = (await res.json()) as { text: string };
      setHints((h) => ({ ...h, [domain]: { text: json.text, loading: false, error: false } }));
    } catch {
      setHints((h) => ({ ...h, [domain]: { text: "", loading: false, error: true } }));
    }
  }

  async function askForHelp(domain: Domain) {
    if (helpRequested.includes(domain)) return;
    setHelpRequested((arr) => [...arr, domain]);
    await fetchHint(domain, "guide", state);
  }

  async function evaluateApproach() {
    if (!approach.trim()) return;
    setApproachBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/approach", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ taskId, approachText: approach }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setApproachResult((await res.json()) as ApproachResponse & { fallback?: boolean });
    } catch {
      setError("접근 방법 평가에 실패했어요. 코드 수정으로 바로 넘어가도 됩니다.");
    } finally {
      setApproachBusy(false);
    }
  }

  async function submit() {
    if (!code.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          taskId,
          code,
          approachResult: approachResult
            ? { codebase: approachResult.codebase, domain: approachResult.domain, team: approachResult.team }
            : null,
          helpRequested,
          recentEvents: {
            codebase: state.domains.codebase.events.slice(-2),
            domain: state.domains.domain.events.slice(-2),
            team: state.domains.team.events.slice(-2),
          },
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as ReviewResponse & { fallback?: boolean };
      finishTask(state, taskId, json, helpRequested, { fallback: Boolean(json.fallback), skipped: false });
      router.push("/review");
    } catch {
      setError("리뷰 요청에 실패했어요. 다시 시도하거나 아래에서 결과를 가정하고 넘어가세요.");
      setSubmitting(false);
    }
  }

  function skip() {
    const choice = SKIP_CHOICES.find((c) => c.id === skipChoice)!;
    finishTask(state, taskId, choice.review, [], { fallback: false, skipped: true });
    router.push("/review");
  }

  const file = getFile(tab);

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8">
      <Header step={`${task.id} 진행 중`} />

      <section className="mt-8 max-w-3xl">
        <p className="font-mono text-xs text-faint">{task.id}</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-[26px]">{task.title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">{task.description}</p>
      </section>

      {/* 리뷰어 3장 — 코드보다 먼저 보인다 */}
      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        {DOMAINS.map((d) => {
          const level = state.domains[d].level;
          const h = hints[d];
          const asked = helpRequested.includes(d);
          const shownLevel = asked ? "guide" : level;
          return (
            <DomainCard key={d} domain={d} level={shownLevel} emphasize>
              <div className="min-h-12 flex-1 text-sm leading-relaxed">
                {level === "silent" && !asked ? (
                  <p className="text-faint">직접 찾아보세요.</p>
                ) : h.loading ? (
                  <p className="text-faint">{PERSONAS[d].name}가 보는 중...</p>
                ) : h.error ? (
                  <p className="text-danger">힌트를 불러오지 못했어요. 새로고침하면 다시 시도합니다.</p>
                ) : (
                  <p>{h.text}</p>
                )}
              </div>
              {level !== "guide" && (
                <button
                  type="button"
                  onClick={() => askForHelp(d)}
                  disabled={asked}
                  className="self-start rounded-md border border-line px-3 py-1.5 text-xs text-muted hover:border-line-strong hover:text-fg disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {asked ? "물어봤음, 기록에 남습니다" : `${PERSONAS[d].name}에게 물어보기`}
                </button>
              )}
            </DomainCard>
          );
        })}
      </section>

      <section className="mt-6 grid gap-5 lg:grid-cols-2">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[15px] font-bold">1) 접근 방법</h2>
              <div className="flex gap-2">
                <button type="button" onClick={() => setApproach(SAMPLE_APPROACH)} className={btnGhost}>
                  샘플 채우기
                </button>
                <button
                  type="button"
                  onClick={evaluateApproach}
                  disabled={approachBusy || !approach.trim()}
                  className={btnSecondary}
                >
                  {approachBusy ? "평가 중..." : "평가 받기"}
                </button>
              </div>
            </div>
            <p className="text-xs text-faint">어디를 왜 고칠지 먼저 씁니다. 사용자가 먼저 말해야 AI가 반응합니다.</p>
            <textarea
              value={approach}
              onChange={(e) => setApproach(e.target.value)}
              rows={3}
              placeholder="예: RefundService.refund에서 ..."
              className={textareaCls}
            />
            {approachResult && (
              <ul className="flex flex-col gap-1 rounded-xl border border-line bg-card p-3 text-sm">
                {DOMAINS.map((d) => (
                  <li key={d} className="flex gap-2">
                    <span className={approachResult[d].understood ? "text-ok" : "text-warn"}>
                      {approachResult[d].understood ? "✓" : "○"}
                    </span>
                    <span className="w-16 shrink-0 text-faint">{DOMAIN_LABELS[d]}</span>
                    <span className="text-muted">{approachResult[d].note}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-col gap-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[15px] font-bold">2) 코드 수정</h2>
              <div className="flex gap-2">
                <button type="button" onClick={() => setCode(SAMPLE_CODE)} className={btnGhost}>
                  샘플 채우기
                </button>
                <button type="button" onClick={submit} disabled={submitting || !code.trim()} className={btnPrimary}>
                  {submitting ? "리뷰어 3명이 보는 중..." : "제출"}
                </button>
              </div>
            </div>
            <p className="font-mono text-xs text-faint">{task.targetFile}</p>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              rows={18}
              spellCheck={false}
              className={`${textareaCls} font-mono text-xs leading-relaxed`}
            />
          </div>

          {error && <p className="rounded-xl bg-danger-bg px-4 py-3 text-sm text-danger">{error}</p>}
        </div>

        <div className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-line bg-card lg:sticky lg:top-6 lg:self-start">
          <div className="flex gap-1 overflow-x-auto border-b border-line px-2 pt-2">
            {task.relevantFiles.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setTab(p)}
                className={`shrink-0 rounded-t-md px-3 py-1.5 font-mono text-[11px] ${
                  tab === p ? "bg-bg font-bold text-fg" : "text-faint hover:text-fg"
                }`}
              >
                {p.split("/").pop()}
              </button>
            ))}
          </div>
          <pre className="max-h-[36rem] overflow-auto p-4 font-mono text-xs leading-relaxed text-muted">
            {file?.content ?? ""}
          </pre>
        </div>
      </section>

      <div className="mt-10 border-t border-line pt-6 text-center">
        <button
          type="button"
          onClick={() => setSkipOpen(true)}
          className="text-sm text-muted underline-offset-4 hover:text-fg hover:underline"
        >
          결과를 가정하고 넘어가기 (직접 안 해도 됩니다)
        </button>
      </div>

      {skipOpen && (
        <div
          className="fixed inset-0 z-20 flex items-end justify-center bg-black/50 p-4 sm:items-center"
          onClick={() => setSkipOpen(false)}
        >
          <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold">이번 태스크를 어떻게 마쳤다고 할까요?</h3>
            <p className="mt-1 text-xs text-faint">선택에 따라 결과가 달라집니다. 두 번 눌러보셔도 됩니다.</p>
            <ul className="mt-4 flex flex-col gap-2">
              {SKIP_CHOICES.map((c) => (
                <li key={c.id}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-line px-4 py-3 hover:border-line-strong">
                    <input
                      type="radio"
                      name="skip"
                      value={c.id}
                      checked={skipChoice === c.id}
                      onChange={() => setSkipChoice(c.id)}
                      className="accent-[var(--guide-dot)]"
                    />
                    <span className="text-sm">{c.label}</span>
                  </label>
                </li>
              ))}
            </ul>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setSkipOpen(false)} className={btnGhost}>
                취소
              </button>
              <button type="button" onClick={skip} className={btnPrimary}>
                리뷰 보기
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

const textareaCls =
  "w-full rounded-xl border border-line bg-card px-3.5 py-2.5 text-sm leading-relaxed text-fg placeholder:text-faint focus:border-line-strong focus:outline-none";
const btnPrimary =
  "rounded-md bg-ink px-3.5 py-1.5 text-sm font-bold text-ink-fg hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";
const btnSecondary =
  "rounded-md border border-ink bg-card px-3.5 py-1.5 text-sm font-bold text-fg hover:bg-bg disabled:cursor-not-allowed disabled:opacity-50";
const btnGhost =
  "rounded-md border border-line bg-card px-3 py-1.5 text-sm text-muted hover:border-line-strong hover:text-fg disabled:cursor-not-allowed";
