import { NextResponse } from "next/server";
import { structured } from "@/lib/llm";
import { FALLBACK_HINT, HintSchema, buildHintPrompt } from "@/lib/prompts";
import type { HintRequest, HintResponse } from "@/lib/types";
import { getTask } from "@/data/tasks";

export const maxDuration = 60;

export async function POST(req: Request) {
  const body = (await req.json()) as HintRequest;
  if (!getTask(body.taskId)) {
    return NextResponse.json({ error: "unknown task" }, { status: 400 });
  }
  if (body.level === "silent") {
    return NextResponse.json<HintResponse>({ text: "" });
  }
  const { system, user } = buildHintPrompt(body);
  const out = await structured(HintSchema, system, user);
  const text = out?.text?.trim() || FALLBACK_HINT[body.domain][body.level];
  return NextResponse.json<HintResponse & { fallback: boolean }>({
    text,
    fallback: !out,
  });
}
