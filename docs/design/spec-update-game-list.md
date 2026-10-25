## Game list (added 2026-10-24)

The landing screen. Figma: Viewer page, section "Game list" `107:5104`, now the first section. All other Viewer sections moved down 1401px.

### Decisions (asked and answered)
- **Grouping:** by day. TODAY (the Live games card first, then later-today games), UPCOMING, FINAL.
- **Filter:** an All / Following toggle under the search field. It opens on Following once the user follows any player or team.
- **Row:** layout B, which mirrors the scoreboard: away team left, home team right, score in the middle, Mini Diamond between the scores for live games.
- **Live signal:** live games sit together in a dark **Live games** card (scoreboard/bg) at the top of TODAY, styled like the in-game scoreboard. No red pills; red stays for status badges.
- **Discovery:** a search field (teams, leagues, fields). Follow from the results.

### Screens
- **Game list — Following (default)** `107:5105`, 393×852: Hawks games only (J. Ruiz is followed). TODAY has the live Hawks–Marlins game, UPCOMING two games, FINAL two games.
- **Game list — All (full length)** `107:5329`: three live games, two later today, two upcoming, three finals (away win, home win, tie).
- The nav bar has no back button (it's the root screen); the wordmark stays centered and More stays on the right.
- Group labels (Label/Caps, text/secondary) are inset 16px to line up with the team names.

### Components (Components page, section "Game list" `106:5536`)
- **Search Field** `106:5537`: 44px pill, surface/card, border/subtle, icons.download `search` icon in text/tertiary. Property: Placeholder.
- **Game Row** `106:5617`, variants State = Live, Upcoming, Final – Away won, Final – Home won, Final – Tie.
  - Each variant carries its card's fill (Live = scoreboard/bg, others = surface/card), so rows sit seamlessly in their cards.
  - Properties: Away team, Home team, Away followed, Home followed (orange dot in a fixed 6px slot, so names stay aligned), Time (Upcoming), and Live away score, Live home score, Live status (Live only).
  - Final scores and the Upcoming place text are edited directly on the instance. Text properties share one default across variants, which would show wrong scores for the "Home won" and "Tie" variants.
  - Live exposes the nested **Bases** (Mini Diamond) instance; set First, Second and Third per game.
  - The center column's Status text is capped at 140px and truncates; each team side keeps at least 80px.
  - The losing team in a Final is text/secondary.
- **All / Following toggle** reuses **Team Toggle** `66:2371` with label overrides. Renaming it to "Segmented Control" would be clearer, but that's a global change, so it waits for your OK.

### Stress test
- "Stress — Game Row worst cases" `107:8940`: 30-character team names on both sides, 14–12 in extra innings, an empty-bases 0–0, a long Upcoming place, and a 21–20 run-rule Final. It caught the center-column overflow, now fixed.

### Explorations (Archive, `104:6975`)
- Row options A, B and C, plus the three live treatments for B. Kept for reference.

### Open questions
- Empty Following state (follows nothing yet): the list should open on All. Do we want a "Follow a player to see their games here" prompt on Following?
- In the dark Live card, empty bases are dark on dark green, the same as on the in-game scoreboard. Fine for v1, but worth checking contrast once Dark mode work starts.
- No tab bar is designed yet. If the app gets one (Games, Following, Profile), the Following toggle may move.
