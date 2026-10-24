// Sends the engine's sample plays to sync-events for the first connection test in docs/contract.md.
// Needs SUPABASE_URL and SUPABASE_ANON_KEY.
//
//   deno run -A supabase/scripts/send-samples.ts whoami
//   deno run -A supabase/scripts/send-samples.ts < samples.json
//
// The scorer is an anonymous user. Its refresh token is kept in supabase/.temp, so every run
// signs in as the same scorer, and a second send returns the first send's acknowledgments.

type UploadRequest = { sessionId: string; events: { seq: number }[] };
type Session = { access_token: string; refresh_token: string; user: { id: string } };

const url = Deno.env.get('SUPABASE_URL');
const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
if (!url || !anonKey) {
  console.error('Set SUPABASE_URL and SUPABASE_ANON_KEY. Locally, `supabase status` prints both.');
  Deno.exit(2);
}

const tokenFile = new URL('../.temp/send-samples.json', import.meta.url);

function fail(message: string): never {
  console.error(message);
  Deno.exit(1);
}

async function auth(path: string, body: unknown): Promise<Session> {
  const res = await fetch(`${url}/auth/v1/${path}`, {
    method: 'POST',
    headers: { apikey: anonKey!, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) fail(`Sign-in failed with ${res.status}: ${await res.text()}`);
  return res.json();
}

async function readTokens(): Promise<Record<string, string>> {
  try {
    return JSON.parse(await Deno.readTextFile(tokenFile));
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return {};
    throw error;
  }
}

async function signIn(createScorer: boolean): Promise<Session> {
  const tokens = await readTokens();
  const saved = tokens[url!];
  if (!saved && !createScorer) {
    fail('No saved scorer. Run `whoami` first and seed the test game with the ID it prints.');
  }
  const session = saved
    ? await auth('token?grant_type=refresh_token', { refresh_token: saved })
    : await auth('signup', { data: {} });
  tokens[url!] = session.refresh_token;
  await Deno.mkdir(new URL('.', tokenFile), { recursive: true });
  await Deno.writeTextFile(tokenFile, JSON.stringify(tokens, null, 2) + '\n');
  return session;
}

if (Deno.args[0] === 'whoami') {
  console.log((await signIn(true)).user.id);
} else {
  const requests: UploadRequest[] = JSON.parse(await new Response(Deno.stdin.readable).text());
  const { access_token } = await signIn(false);
  for (const request of requests) {
    const res = await fetch(`${url}/functions/v1/sync-events`, {
      method: 'POST',
      headers: { authorization: `Bearer ${access_token}`, apikey: anonKey, 'content-type': 'application/json' },
      body: JSON.stringify(request),
    });
    const seqs = request.events.map((e) => e.seq);
    console.log(`seq ${seqs[0]}-${seqs.at(-1)}  ${res.status}  ${await res.text()}`);
    if (!res.ok) Deno.exit(1);
  }
}
