// PROTOTYPE, THROWAWAY. The OpenAI side: the real call (adds the key from the environment, like voice-parse's wiring.ts),
// and a wrapper that counts calls, time and token usage for one reader on one press. Nothing here logs a body or a key.

import type { OpenAi } from '../../../supabase/functions/_shared/voice.ts';

export type { OpenAi };

/** Where calls go. Only AI_FIRST_BASE_URL changes it (used to check the real call path against a local stub). */
export const baseUrl = process.env.AI_FIRST_BASE_URL ?? 'https://api.openai.com';

/** The same shape voice-parse uses, with a 30 s limit instead of its 10 s so a slow answer is measured, not cut. */
export const realOpenAi = (key: string): OpenAi => (path, init) => fetch(`${baseUrl}${path}`, {
  ...init,
  headers: { ...init.headers, authorization: `Bearer ${key}` },
  signal: AbortSignal.timeout(30_000),
});

export type Meter = { calls: number; ms: number; inTokens: number; cachedTokens: number; outTokens: number; errors: string[] };

/** Only the error's code or type is kept, never its message (a 401 message can echo part of a key). */
const errorCode = (body: unknown): string => {
  const error = (body as { error?: { code?: unknown; type?: unknown } } | null)?.error;
  const code = typeof error?.code === 'string' ? error.code : typeof error?.type === 'string' ? error.type : '';
  return code ? ` ${code.slice(0, 60)}` : '';
};

export function metered(inner: OpenAi): { openai: OpenAi; meter: Meter } {
  const meter: Meter = { calls: 0, ms: 0, inTokens: 0, cachedTokens: 0, outTokens: 0, errors: [] };
  const openai: OpenAi = async (path, init) => {
    meter.calls += 1;
    const start = performance.now();
    try {
      const response = await inner(path, init);
      meter.ms += performance.now() - start;
      const body = await response.clone().json().catch(() => null) as {
        usage?: { input_tokens?: number; output_tokens?: number; input_tokens_details?: { cached_tokens?: number } };
      } | null;
      if (!response.ok) meter.errors.push(`HTTP ${response.status}${errorCode(body)}`);
      meter.inTokens += body?.usage?.input_tokens ?? 0;
      meter.cachedTokens += body?.usage?.input_tokens_details?.cached_tokens ?? 0;
      meter.outTokens += body?.usage?.output_tokens ?? 0;
      return response;
    } catch (thrown) {
      meter.ms += performance.now() - start;
      meter.errors.push(thrown instanceof Error ? thrown.name : 'network error');
      throw thrown;
    }
  };
  return { openai, meter };
}

/** Published price, dollars per 1M tokens. Override with PRICE_IN, PRICE_OUT and PRICE_CACHED if it has changed. */
export const price = {
  model: 'gpt-6-luna, Standard tier, short context',
  source: 'developers.openai.com/api/docs/pricing, read 2026-10-28 (the page was summarized by a fetch tool: eyeball it)',
  in: Number(process.env.PRICE_IN ?? 0.10),
  out: Number(process.env.PRICE_OUT ?? 0.50),
  cached: Number(process.env.PRICE_CACHED ?? 0.01),
};

export const dollars = (tokens: { inTokens: number; cachedTokens: number; outTokens: number }) =>
  ((tokens.inTokens - tokens.cachedTokens) * price.in + tokens.cachedTokens * price.cached + tokens.outTokens * price.out) / 1_000_000;
