// LLM 어댑터 (OpenAI). 제공사/모델을 바꾸려면 이 파일만 고친다.
// 모든 호출은 구조화 JSON만 반환한다. 실패하면 null → 호출자가 폴백을 쓴다.

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { z } from "zod";

export const MODEL = process.env.LLM_MODEL ?? "gpt-5.6";

// timeout 단위는 ms. 리뷰 호출이 가장 길다. 재시도 1회 → 최악 40초 (라우트 maxDuration 60).
// 키가 없으면 생성자가 던지므로 지연 생성한다 (빌드 시 키 없이도 통과해야 함).
let client: OpenAI | null = null;
function getClient(): OpenAI {
  client ??= new OpenAI({ timeout: 20_000, maxRetries: 1 });
  return client;
}

export function llmConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

// gpt-5 / o 계열은 추론 강도를 낮춰서 짧은 JSON 판정을 빨리 받는다.
const REASONING_MODEL = /^(gpt-5|o\d)/.test(MODEL);

export async function structured<S extends z.ZodTypeAny>(
  schema: S,
  system: string,
  user: string,
): Promise<z.infer<S> | null> {
  if (!llmConfigured()) return null;
  try {
    const res = await getClient().responses.parse({
      model: MODEL,
      input: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      text: { format: zodTextFormat(schema, "result") },
      ...(REASONING_MODEL ? { reasoning: { effort: "low" as const } } : {}),
    });
    return (res.output_parsed as z.infer<S> | null) ?? null;
  } catch (error) {
    if (error instanceof OpenAI.AuthenticationError) {
      console.error("[llm] invalid API key");
    } else if (error instanceof OpenAI.RateLimitError) {
      console.error("[llm] rate limited");
    } else if (error instanceof OpenAI.APIError) {
      console.error(`[llm] API error ${error.status}: ${error.message}`);
    } else {
      console.error("[llm] request failed", error);
    }
    return null;
  }
}
