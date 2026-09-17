// LLM 어댑터 (OpenAI). 제공사/모델을 바꾸려면 이 파일만 고친다.
// 모든 호출은 구조화 JSON만 반환한다. 실패하면 null → 호출자가 폴백을 쓴다.

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { z } from "zod";

export const MODEL = process.env.LLM_MODEL ?? "gpt-5.4-mini";

// 모델은 키의 모델 목록에 있는 것만 쓴다 (2026-09-17 확인: gpt-5.5, gpt-5.4, gpt-5.4-mini 있음. "gpt-5.6"은 없음).
// 기본은 가장 싼 gpt-5.4-mini (2026-09-18 하네스 10/10 목표 판정, p50 3초). 올리려면 Vercel env LLM_MODEL.
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
      // 429는 속도 제한뿐 아니라 크레딧 소진(insufficient_quota)도 포함한다. code로 구분.
      console.error(`[llm] 429 ${error.code ?? "rate_limit"}: ${error.message}`);
    } else if (error instanceof OpenAI.APIError) {
      console.error(`[llm] API error ${error.status} ${error.code ?? ""}: ${error.message}`);
    } else {
      console.error("[llm] request failed", error);
    }
    return null;
  }
}
