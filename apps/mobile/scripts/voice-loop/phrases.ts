// How the phone's own parser reads what the transcriber might return for the test clips, including what is left when a
// player's name is dropped ("Walks.") or crowd chatter comes along ("Come on, ..."):
//   node --experimental-strip-types scripts/voice-loop/phrases.ts
import { readLocally } from '@sandlot/voice';

for (const t of ['Nguyen walks.', 'Come on, Nguyen walks.', 'Come on ball, Diaz', 'Ball.', 'Darcy singles, Soto to third.', 'Come on, Darcy singles, Soto to third.', 'Soto hits Ruiz, Ruiz takes first.', 'Walks.']) {
  console.log(JSON.stringify(t).padEnd(42), readLocally(t)?.kind ?? 'ai');
}
