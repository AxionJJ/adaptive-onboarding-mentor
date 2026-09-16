import { NextResponse } from "next/server";
import { structured } from "@/lib/llm";
import { ApproachSchema, FALLBACK_APPROACH, buildApproachPrompt } from "@/lib/prompts";
import type { ApproachRequest } from "@/lib/types";
import { getTask } from "@/data/tasks";

export const maxDuration = 60;

export async function POST(req: Request) {
  const body = (await req.json()) as ApproachRequest;
  if (!getTask(body.taskId)) {
    return NextResponse.json({ error: "unknown task" }, { status: 400 });
  }
  if (!body.approachText?.trim()) {
    return NextResponse.json({ error: "approachText required" }, { status: 400 });
  }
  const { system, user } = buildApproachPrompt(body);
  const out = await structured(ApproachSchema, system, user);
  return NextResponse.json({ ...(out ?? FALLBACK_APPROACH), fallback: !out });
}
