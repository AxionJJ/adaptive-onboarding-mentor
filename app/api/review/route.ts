import { NextResponse } from "next/server";
import { structured } from "@/lib/llm";
import { FALLBACK_REVIEW, ReviewSchema, buildReviewPrompt } from "@/lib/prompts";
import type { ReviewRequest } from "@/lib/types";
import { getTask } from "@/data/tasks";

export const maxDuration = 60;

export async function POST(req: Request) {
  const body = (await req.json()) as ReviewRequest;
  if (!getTask(body.taskId)) {
    return NextResponse.json({ error: "unknown task" }, { status: 400 });
  }
  if (!body.code?.trim()) {
    return NextResponse.json({ error: "code required" }, { status: 400 });
  }
  const { system, user } = buildReviewPrompt({
    ...body,
    helpRequested: body.helpRequested ?? [],
  });
  const out = await structured(ReviewSchema, system, user);
  return NextResponse.json({ ...(out ?? FALLBACK_REVIEW), fallback: !out });
}
