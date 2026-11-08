import type { Reply } from './voice.ts';

export const jsonResponse = ({ status, body }: Reply): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

type JsonBody = { ok: true; body: unknown } | { ok: false; reply: Reply };
const failed = (status: number, error: string): JsonBody => ({ ok: false, reply: { status, body: { error } } });

export async function readJson(request: Request, maxBytes: number): Promise<JsonBody> {
  const declared = request.headers.get('content-length');
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > maxBytes)) {
    await request.body?.cancel().catch(() => {});
    return failed(413, 'too_long');
  }
  if (!request.body) return failed(400, 'invalid');
  const reader = request.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let bytes = 0;
  let text = '';
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel().catch(() => {});
        return failed(413, 'too_long');
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
    return { ok: true, body: JSON.parse(text) };
  } catch {
    await reader.cancel().catch(() => {});
    return failed(400, 'invalid');
  } finally {
    reader.releaseLock();
  }
}
