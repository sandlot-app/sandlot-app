// Which token this phone sends. The seed script makes this phone's anonymous user a game's scorer, so once the phone
// has signed in it keeps that identity: a failed refresh signs it out rather than making a new anonymous user.

type Session = { access_token: string; user: { id: string } };
type Answer = { session: Session | null; error: unknown };

/** The parts of the Supabase auth client this needs, so the rule can be tested without one. */
export type AuthPort = {
  getSession(): Promise<Answer>;
  refreshSession(): Promise<Answer>;
  signInAnonymously(): Promise<Answer>;
  /** True for an error that means no answer came back, rather than a refusal. */
  retryable(error: unknown): boolean;
};
export type KeyValue = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> };

export type TokenResult = { token: string } | { failure: 'offline' | 'signed_out' };

const identityKey = 'sandlot.phone-user';

export async function resolveToken(auth: AuthPort, storage: KeyValue, fresh: boolean): Promise<TokenResult> {
  const remember = async (session: Session) => {
    await storage.setItem(identityKey, session.user.id);
    return { token: session.access_token };
  };
  const current = fresh ? await auth.refreshSession() : await auth.getSession();
  if (current.session) return remember(current.session);
  if (current.error && auth.retryable(current.error)) return { failure: 'offline' };
  if (await storage.getItem(identityKey)) return { failure: 'signed_out' };
  const signedIn = await auth.signInAnonymously();
  if (signedIn.session) return remember(signedIn.session);
  return { failure: signedIn.error && auth.retryable(signedIn.error) ? 'offline' : 'signed_out' };
}
