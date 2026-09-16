// LLM 어댑터. 제공사/모델을 바꾸려면 이 파일만 고친다.
// 모든 호출은 구조화 JSON만 반환한다. 실패하면 null → 호출자가 폴백을 쓴다.

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";

export const MODEL = process.env.LLM_MODEL ?? "claude-opus-5";

// TS SDK의 timeout 단위는 ms. 리뷰 호출이 가장 길다. 재시도 1회 → 최악 40초 (라우트 maxDuration 60).
const client = new Anthropic({ timeout: 20_000, maxRetries: 1 });

export function llmConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

export async function structured<S extends z.ZodTypeAny>(
  schema: S,
  system: string,
  user: string,
): Promise<z.infer<S> | null> {
  if (!llmConfigured()) return null;
  try {
    const res = await client.messages.parse({
      model: MODEL,
      max_tokens: 4096,
      system,
      messages: [{ role: "user", content: user }],
      output_config: { format: zodOutputFormat(schema), effort: "low" },
    });
    if (res.stop_reason === "refusal") return null;
    return res.parsed_output ?? null;
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      console.error("[llm] invalid API key");
    } else if (error instanceof Anthropic.RateLimitError) {
      console.error("[llm] rate limited");
    } else if (error instanceof Anthropic.APIError) {
      console.error(`[llm] API error ${error.status}: ${error.message}`);
    } else {
      console.error("[llm] request failed", error);
    }
    return null;
  }
}
