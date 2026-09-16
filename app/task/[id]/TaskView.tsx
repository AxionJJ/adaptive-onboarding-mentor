"use client";

// S2 — 태스크 화면. 한 화면에 [침묵][안내][질문] 세 배지가 동시에 보이는 게 핵심이다.

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { LevelBadge } from "@/components/LevelBadge";
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
    // 안내/질문 영역만 힌트 호출. 침묵은 호출하지 않는다.
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
        body: JSON.stringify({
          taskId,
          domain,
          level,
          recentEvents: s.domains[domain].events.slice(-2),
        }),
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
      setError("접근 방법 평가에 실패했어요. 그냥 코드 수정으로 넘어가도 됩니다.");
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
      setError("리뷰 요청에 실패했어요. 다시 시도하거나 아래 [완료로 넘어가기]를 눌러 주세요.");
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
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <Header step={`${task.id} 진행 중`} />

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_22rem]">
        {/* ---------- 왼쪽: 태스크 + 레포 + 입력 ---------- */}
        <div className="min-w-0 space-y-6">
          <section>
            <p className="font-mono text-xs text-zinc-400">{task.id}</p>
            <h1 className="mt-1 text-xl font-semibold">{task.title}</h1>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600">{task.description}</p>
          </section>

          <section className="rounded-lg border border-zinc-200 bg-white">
            <div className="flex gap-1 overflow-x-auto border-b border-zinc-200 px-2 pt-2">
              {task.relevantFiles.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setTab(p)}
                  className={`shrink-0 rounded-t-md px-3 py-1.5 font-mono text-xs ${
                    tab === p ? "bg-zinc-100 font-semibold text-zinc-900" : "text-zinc-500 hover:text-zinc-800"
                  }`}
                >
                  {p.split("/").pop()}
                </button>
              ))}
            </div>
            <pre className="max-h-72 overflow-auto p-4 font-mono text-xs leading-relaxed text-zinc-700">
              {file?.content ?? ""}
            </pre>
          </section>

          <section className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold">1) 접근 방법</h2>
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
            <p className="text-xs text-zinc-500">
              어디를 왜 고칠지 먼저 씁니다. AI는 사용자가 먼저 말해야 반응합니다.
            </p>
            <textarea
              value={approach}
              onChange={(e) => setApproach(e.target.value)}
              rows={3}
              placeholder="예: RefundService.refund에서 ..."
              className={textareaCls}
            />
            {approachResult && (
              <ul className="space-y-1 rounded-md bg-zinc-50 p-3 text-sm">
                {DOMAINS.map((d) => (
                  <li key={d} className="flex gap-2">
                    <span className={approachResult[d].understood ? "text-emerald-600" : "text-amber-600"}>
                      {approachResult[d].understood ? "✓" : "○"}
                    </span>
                    <span className="w-16 shrink-0 text-zinc-500">{DOMAIN_LABELS[d]}</span>
                    <span className="text-zinc-700">{approachResult[d].note}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold">2) 코드 수정</h2>
              <div className="flex gap-2">
                <button type="button" onClick={() => setCode(SAMPLE_CODE)} className={btnGhost}>
                  샘플 채우기
                </button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={submitting || !code.trim()}
                  className={btnPrimary}
                >
                  {submitting ? "리뷰어 3명이 보는 중..." : "제출"}
                </button>
              </div>
            </div>
            <p className="font-mono text-xs text-zinc-500">{task.targetFile}</p>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              rows={18}
              spellCheck={false}
              className={`${textareaCls} font-mono text-xs leading-relaxed`}
            />
          </section>

          {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        </div>

        {/* ---------- 오른쪽: 리뷰어 패널 ---------- */}
        <aside className="space-y-3 lg:sticky lg:top-6 lg:self-start">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">리뷰어</h2>
          {DOMAINS.map((d) => {
            const level = state.domains[d].level;
            const h = hints[d];
            const asked = helpRequested.includes(d);
            const canAsk = level !== "guide";
            return (
              <div key={d} className="rounded-lg border border-zinc-200 bg-white p-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">{PERSONAS[d].name}</p>
                    <p className="text-xs text-zinc-400">{DOMAIN_LABELS[d]}</p>
                  </div>
                  <LevelBadge level={asked ? "guide" : level} />
                </div>

                <div className="mt-3 min-h-6 text-sm leading-relaxed text-zinc-700">
                  {level === "silent" && !asked ? (
                    <p className="text-zinc-400">직접 찾아보세요.</p>
                  ) : h.loading ? (
                    <p className="text-zinc-400">{PERSONAS[d].name}가 보는 중...</p>
                  ) : h.error ? (
                    <p className="text-red-600">힌트를 불러오지 못했어요.</p>
                  ) : (
                    <p>{h.text}</p>
                  )}
                </div>

                {canAsk && (
                  <button
                    type="button"
                    onClick={() => askForHelp(d)}
                    disabled={asked}
                    className={`mt-3 w-full ${btnGhost} disabled:opacity-60`}
                  >
                    {asked ? "물어봤음 (기록에 남습니다)" : `${PERSONAS[d].name}에게 물어보기`}
                  </button>
                )}
              </div>
            );
          })}
          <p className="text-xs leading-relaxed text-zinc-400">
            물어보면 안내를 받되, 그 요청이 기록에 남아 다음 지원량에 반영됩니다.
          </p>
        </aside>
      </div>

      {/* ---------- 하단: 건너뛰기 ---------- */}
      <div className="mt-10 border-t border-zinc-200 pt-6 text-center">
        <button
          type="button"
          onClick={() => setSkipOpen(true)}
          className="text-sm text-zinc-500 underline-offset-4 hover:text-zinc-800 hover:underline"
        >
          완료로 넘어가기 (직접 안 해도 됩니다)
        </button>
      </div>

      {skipOpen && (
        <div
          className="fixed inset-0 z-20 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          onClick={() => setSkipOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold">이번 태스크를 어떻게 마쳤다고 할까요?</h3>
            <p className="mt-1 text-xs text-zinc-500">선택에 따라 결과가 달라집니다. 두 번 눌러보셔도 됩니다.</p>
            <ul className="mt-4 space-y-2">
              {SKIP_CHOICES.map((c) => (
                <li key={c.id}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-md border border-zinc-200 px-3 py-2 hover:bg-zinc-50">
                    <input
                      type="radio"
                      name="skip"
                      value={c.id}
                      checked={skipChoice === c.id}
                      onChange={() => setSkipChoice(c.id)}
                    />
                    <span>{c.label}</span>
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
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm leading-relaxed focus:border-zinc-500 focus:outline-none";
const btnPrimary =
  "rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50";
const btnSecondary =
  "rounded-md border border-zinc-800 px-3 py-1.5 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50";
const btnGhost =
  "rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed";
