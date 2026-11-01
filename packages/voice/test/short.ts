// The eval files' short spelling of a model answer: readable in a diff, and lossless for everything decide() reads.
//
//   { "batter": "Parker", "bip": { "o": "double", "b": "2", "r": ["1>home"] } }
//   { "pitcher": "Soto", "batter": "Ruiz", "p": ["hit_by_pitch"] }
//   { "p": ["ball"], "ev": ["passed_ball:2>3", "passed_ball:1>2"] }
//   { "p": ["ball"], "fr": ["1:Soto"] }                       (a runner named who was forced along by ball four)
//   { "bip": { "o": "out", "t": "fly", "f": ["CF:Lee"], "b": "out", "r": ["3>home:Ruiz"] } }
//   { "result": "question", "readings": [ { ...reading }, { ...reading } ] }
//   { "fix": true, "bip": { "o": "double", "b": "2" } }
//   { "result": "not_a_play" }    { "result": "unclear" }
//
// A runner, fielder or runner event may end in ":<name>" or ":#<number>". Batter and pitcher take "<name>" or "#<number>".

export type ShortReading = {
  batter?: string;
  /** Batters of earlier at-bats in the press, in order: ["Shah"]. */
  earlier?: string[];
  pitcher?: string;
  p?: string[];
  /** `first`: the batter was out before any runner. */
  bip?: { o: string; t?: string; f?: string[]; b: string; r?: string[]; first?: true };
  ev?: string[];
  /** Runner events after the ball in play, by the base after it: "stolen_base:1>2:Soto". */
  after?: string[];
  /** Runners named who were only forced along by a walk or hit by pitch: "1:Soto". */
  fr?: string[];
  /** Names the scorer took back. */
  back?: string[];
};

export type Short = ShortReading & {
  result?: 'play' | 'question' | 'not_a_play' | 'unclear';
  fix?: true;
  readings?: [ShortReading, ShortReading];
};

const named = (said: string | undefined) => !said ? { name: null, number: null }
  : said.startsWith('#') ? { name: null, number: said.slice(1) } : { name: said, number: null };

/** "1>home:Ruiz" as { from: "1", to: "home", name: "Ruiz", number: null }. */
function move(text: string) {
  const [path, said] = text.split(':');
  const [from, to] = path!.split('>');
  return { from, to, ...named(said) };
}

/** "caught_stealing:1>out:Diaz" or with fielders after a "|": "caught_stealing:1>out:Diaz|C:Ortiz,SS". */
function event(text: string) {
  const [main, fielders] = text.split('|');
  const [kind, ...rest] = main!.split(':');
  return { event: kind, ...move(rest.join(':')), fielders: (fielders ? fielders.split(',') : []).map(fielder) };
}

function fielder(text: string) {
  const [position, said] = text.split(':');
  return { position, ...named(said) };
}

function reading(short: ShortReading) {
  return {
    batter: named(short.batter),
    earlier_batters: (short.earlier ?? []).map(named),
    pitcher: named(short.pitcher),
    pitches: short.p ?? [],
    ball_in_play: short.bip ? {
      outcome: short.bip.o,
      trajectory: short.bip.t ?? null,
      fielders: (short.bip.f ?? []).map(fielder),
      batter_to: short.bip.b,
      runners: (short.bip.r ?? []).map(move),
      batter_out_first: short.bip.first ?? false,
    } : null,
    runner_events: (short.ev ?? []).map(event),
    runner_events_after: (short.after ?? []).map(event),
    forced_runners: (short.fr ?? []).map((text) => { const [from, said] = text.split(':'); return { from, ...named(said) }; }),
    taken_back: (short.back ?? []).map(named),
  };
}

/** The full answer JSON the model would have sent, notes included, not yet read: the eval runner passes it through readAnswer. */
export function expandShort(short: Short): unknown {
  const result = short.result ?? 'play';
  const readings = result === 'question' ? (short.readings ?? []).map(reading) : result === 'play' ? [reading(short)] : [];
  return { result, fix_last: short.fix ?? false, readings, unsure: [] };
}
