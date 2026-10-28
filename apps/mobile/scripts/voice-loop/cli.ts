/** Prints `message` to stderr and stops. Exit 2 means the command was used wrong, not that a measurement failed. */
export function fail(message: string): never {
  console.error(message);
  process.exit(2);
}

/** The OpenAI key for this one command, from the environment only. Checked first, before any clip is read. */
export function apiKey(): string {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) fail('OPENAI_API_KEY is not set. Pass it for this one command, for example:\n  OPENAI_API_KEY=<your key> pnpm --filter @sandlot/mobile voice-batch');
  return key;
}

/** A whole number of at least `min` from a flag's text. */
export function whole(text: string, flag: string, min = 0): number {
  const value = Number(text);
  if (!Number.isInteger(value) || value < min) fail(`${flag} needs a whole number of at least ${min}, not "${text}".`);
  return value;
}
