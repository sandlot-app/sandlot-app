// Prints the version pins, rules and setup of the phone's demo game, for supabase/scripts/seed-test-game.sql:
//   psql "$SUPABASE_DB_URL" -v scorer=<phone ID> -v pins="$(pnpm -s --filter @sandlot/mobile demo-pins)" -f supabase/scripts/seed-test-game.sql
// The phone shows its ID under Start live game until a seeded game names it the scorer.
import { demoPins } from '../src/sync/server-game.ts';

console.log(JSON.stringify(demoPins()));
