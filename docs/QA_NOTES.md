# QA pass & where the club-management vision stands

An expert-tester pass through the game as it stands after the League →
persistent roster → wages/Sump School → season-dungeon rework. Three
parts: what got fixed, what the design docs asked for that still isn't
built, and what's worth cleaning up or expanding next. See
[PLAYTEST.md](PLAYTEST.md) for the user-facing "what's in" status and
[ROADMAP.md](ROADMAP.md) for the phase-by-phase build log.

## 1) Bugs and softlocks found this pass

All four are fixed and covered by new tests (see PLAYTEST.md's "Fixed
this pass" section for the player-facing description). Noting the
*mechanism* here for whoever touches this code next:

1. **Stranded level-ups on a full clear** (`main.ts`) — the win-handling
   branch checked `won && !run.state.over` before routing to Aftermath;
   a full-clear win has `state.over === true` by the time that check
   runs, so it always skipped straight to `finishRun()`. Any level-ups
   earned on the season's climactic final fight had nowhere to be
   assigned. Fixed by always routing a win through Aftermath, and
   teaching its "Onward" button to call `finishRun()` instead of
   `phase = "descent"` when `run.state.over` is true.
2. **Financial gridlock** (`guild.ts`) — wages could leave a club with
   an incomplete roster and too little gold to ever afford even the
   Sump School's flat 60g fee, with no way to earn more (a run needs a
   full roster to start). `checkDisbandment()` only ran right after a
   fixture, so a gridlock caused by a *building purchase* (spending
   gold with an already-short roster) went uncaught until the player
   noticed they were stuck. Fixed with a new branch in
   `checkDisbandment()`, and made the check proactive — called from
   `renderSettlement()` on every load, not just post-fixture.
3. **Rebuild-into-rebuild loop** — `disbandAndRebuild()`'s
   `gold = round(gold * 0.2)` could leave a nearly-broke club rebuilt
   into the exact same gridlock it just escaped. Fixed with a floor:
   `max(20% of old gold, ACADEMY_COST * partySize)` — the same
   bootstrap guarantee a founding club gets.
4. **False-positive wipeout check** — making disbandment proactive (fix
   #2) meant a *freshly founded or rebuilt* club (roster empty by
   design, nobody signed yet) would immediately trip the "roster wiped
   out" branch and bounce to the Disbandment screen in a loop. Fixed
   with `Guild.fixturesThisIncarnation`, incremented in `recordRun()`
   and reset in `disbandAndRebuild()` — the wipeout check only applies
   once a club has actually fielded a fixture.

### Areas checked and found sound (no bug, noted so it isn't re-litigated)

- Voluntary retire at an extraction floor never strands level-ups — a
  non-final floor's combat always resolves through Aftermath before the
  descent screen offers an extraction candidate, and extraction floors
  have no encounter of their own.
- A total party wipe never routes through Aftermath, by design — there
  is nothing to level up.
- `applyLevelUp` always has at least one always-selectable option (the
  character's own known class needs no admission requirement), so the
  "assign every level before moving on" gate on Aftermath can never
  itself become unsatisfiable.
- The arena-generation connectivity fix (an earlier pass this session)
  still holds under the new season-scaled depths — the "generated
  arenas never softlock" test runs across `depth 1–10 × every floor
  kind`, which now includes depths up to 13 from the top-tier dungeon
  spec.
- Disbandment's existing "broke + 3 straight losses" trigger can't
  under-fire silently: since gridlock (fix #2) and wipeout are both now
  checked on every Settlement load, and severe debt and the loss-streak
  check both still run at `finishRun()` time, there's no state where a
  club is unplayable but `checkDisbandment()` returns null.

## 2) Gap analysis — what the club-management docs asked for that isn't built

Ranked roughly by how much a player would miss it.

**Not built at all:**
- **Staff system** (scout / medic / trainer with mechanical effects) —
  explicitly deferred when wages + Sump School were scoped in. The
  buildings partially cover this ground today (Infirmary = medic,
  Recruitment Hall = scout), but there's no standalone staff layer with
  its own hiring/salary/synergy decisions.
- **Per-division rulesets beyond the fee %** — roster caps, salary
  caps, youth quotas, risk limits per level. Right now every division
  differs only by fee percentage and dungeon difficulty/length. This
  was explicitly named and explicitly deferred.
- **Trading / transfers between clubs** — rivals are lightly simulated
  (a hidden strength value, a rolled fixture each round) but have no
  actual roster of individual characters, so there's nothing to trade
  *for*. Building this for real means giving rival clubs real rosters,
  which is a substantial simulation upgrade, not a small feature.
- **Youth development over time** — the Sump School produces weaker
  prospects today, but they don't *develop*; there's no "raw academy
  kid who improves over seasons" arc. Combat-based leveling covers
  growth once someone's on the roster, so this gap is really about the
  *pre-signing* story, not growth itself.
- **Bench rotation / lineup selection** — every signed roster member up
  to `partySize` always fields, every fixture. There's no way to rest
  an injured/low-level character while keeping them on the books, or
  to carry bench depth beyond exactly `partySize`. The Market and Sump
  School both refuse to sign past a full roster, reinforcing this.
- **Club identity flavor** — captain, morale, spending-culture tags,
  preferred approach (aggressive/cautious/etc.) from the original
  sports-club brief. Purely cosmetic-but-meaningful texture that never
  got built; the club today is fully described by its numbers.

**Partially built / reframed rather than dropped:**
- **"Injuries"** from the brief became permadeath + death saves
  instead — there's no persistent, non-fatal injury that follows a
  survivor between fixtures. This was a deliberate earlier scope call
  (see PLAYTEST.md's "what's out" list), not an oversight, but it's
  worth naming here since the club-management docs specifically asked
  for it.
- **"Club infrastructure, not generic guild upgrades"** — the 8
  buildings are club-themed (Recruitment Hall, Sump School, etc.) and
  now cost real money + real tenure, which covers the *spirit* of the
  ask. What's still missing is buildings that unlock genuinely new
  *systems* (a scouting network revealing hidden stats before signing,
  a sponsor deal for passive income) rather than tuning existing knobs.

**Deliberately not pursued (with reasoning already on record):**
- Rival clubs changing division on their own — only the player is ever
  promoted/relegated; simulating a full moving pyramid was scoped out
  when the pyramid was built, to keep ~240 clubs' worth of bookkeeping
  tractable.
- Roster caps that vary by division — the same `RUN_CONFIG.partySize`
  applies everywhere; a real per-division cap needs the ruleset system
  above to hang off of.

## 3) Cleanup performed

- Removed `DRAFT_POOL_SIZE`/`PARTY_SIZE` from `descent.ts` — dead
  exports left over from before the persistent roster, unreferenced
  anywhere.
- Removed the `pick` option from `characterCard()` in `main.ts` — it
  only ever rendered `.ucard--pick` styling for the old draft-pool
  cards, which no longer exist; nothing has passed `pick: true` since
  the draft was retired. (The `.ucard--pick` CSS class itself is kept
  — the descent screen's floor-choice cards use it directly.)

### Looked at, left alone (on purpose)

- `Run.pool` / `rollPool()` / `pickRecruit()` / `mulligan()` /
  `adReroll()` in `descent.ts` — genuinely unreachable from the live
  UI now, but every dev shortcut and the sim test suite lean on this
  machinery to stand up a playable run quickly. Removing it would mean
  rebuilding an equivalent test harness for no player-facing benefit.
- Buildings persisting through disbandment — a rebuilt club keeps every
  building it ever bought, only losing roster/gold/league position.
  Not something asked to change; flagged here only so it reads as a
  deliberate design choice (infrastructure survives a financial
  collapse) rather than an oversight if it comes up later.

## 4) Ideas for expanding the game

Roughly ordered from "next, natural extension of what exists" to
"bigger swing."

**Natural next steps:**
- **Lineup selection.** Let the roster hold more than `partySize`
  members (raise the Market/Sump School cap independently of party
  size) and add a start-of-fixture screen to pick who's actually
  fielded. This is the one piece of "bench" from the original brief
  that's cheap to build on what already exists, and it's the natural
  answer to "I have 5 signed but can only field 3."
- **A season fixture list**, shown on the Settlement screen: "Fixture
  3 of 6" with a preview of what's coming, rather than only finding out
  the season boundary when it happens. Makes the season structure
  legible before it matters, not just after.
- **Career/legend stats on the recap and Ledger** — best-ever
  standings finish, most career clears, a "club records" panel. The
  data already exists (`careerClears`, `careerGoldEarned`,
  `seasonsPlayed` on every `ClubStanding`); it just isn't surfaced
  anywhere yet beyond the live table.
- **A staff building** (one new building, not a whole new system):
  hire ONE specialist slot — scout (better Market rolls), medic
  (better death-save odds beyond what Infirmary gives), or trainer
  (a flat XP bump) — as a single, well-scoped first cut at the deferred
  staff system.

**Bigger swings:**
- **Real rival rosters.** Give each rival club an actual small roster
  of named characters (even without full combat simulation for them)
  so trading and scouting rivals becomes meaningful, and so a promotion
  match-up has faces attached to it, not just a strength number.
- **Per-division rulesets.** Once rival rosters exist, division-specific
  roster caps / salary caps / youth quotas become meaningful constraints
  rather than just flavor text — worth sequencing after real rosters,
  not before.
- **A youth pipeline with real development.** Sump School prospects
  gain a "seasons on the books" counter and a chance to jump a tier of
  quality at certain thresholds, giving patient youth investment an
  actual payoff curve instead of a one-time roll.
- **A rewarded-ad economy, for real.** The reroll-behind-an-ad stub
  still exists from the original design bible and was never built out;
  now that the Market/Sump School are the only recruiting paths, an ad
  gate on "one free Market reroll" or "peek at a prospect's hidden
  stats" is a natural monetization point that fits the shipped systems
  instead of the retired draft.
