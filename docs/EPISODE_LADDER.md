# Episode Ladder

Game of Thrones daily timeline mode. Five difficulties each day, each with five events and four attempts, sharing the daily game number used by Character and Quote.

## Branch Status

Kept on `feature/episode-ladder`, separate from the announcements/admin and streak artwork release on `development`.
Do not merge this branch into `development` until that release is in production and Ladder is ready for staging.
Before merging, reconcile shared routing, SEO, startup registration, and profile history mode filters with the newer
development code. Keep Character/Quote-only aggregate statistics while allowing Ladder in recent game history.
No deployment or database changes are performed by creating this branch.

## Rules

- Arrange events in episode order. New puzzles always use five different episodes, so minute/second timing does not affect their solution. Flashbacks follow the episode in which viewers see them, not story chronology. Minute/second values remain stored for potential future modes and existing puzzles keep their original ordering.
- Green means the exact position and locks that event. Yellow means one position away; gray means farther away.
- Drag an unlocked card directly, use its grip on touch screens, or focus the card and use Up/Down keys. The actual card moves without a browser drag ghost. Locked slots are skipped when rearranging.
- The solution and episode timestamps are returned only when the game ends. Shares contain only difficulty, attempt count, and feedback squares.
- The selector starts on Easy and allows switching difficulties. Results offer the next difficulty; finished difficulties turn grey and remain available to review. Each difficulty keeps its own attempts and locked positions.
- Difficulty is the exact total number of skipped episodes between the five selected episodes: Easy 15, Medium 10, Hard 6, Expert 4, Impossible 0. The four gaps vary randomly while always adding up to that total; zero-length gaps are allowed at every difficulty. For example, Expert can use gaps `1,1,1,1` or `0,2,0,2`.
- Impossible uses five consecutive episodes. Starting at S4E3 ends at S4E7. Episode indices span season boundaries, so a season's final episode can be adjacent to the next season's premiere.

## Routes And Access

- Current: `/got/game/episode_ladder`
- Archive game: `/got/game/episode_ladder/{gameId}`
- Archive list: `/got/archive/episode_ladder`
- API: `GET /api/universes/got/episode-ladder/current?difficulty=1` or `/{gameId}?difficulty=1`
- Check order: `POST /api/universes/got/episode-ladder/{gameId}/attempts` with `difficulty` and `attempts`
- Import a guest victory: authenticated `POST /api/universes/got/episode-ladder/{gameId}/import`
- Premium practice: `/got/random/episode_ladder`
- Start random round: authenticated `GET /api/universes/got/episode-ladder/random?difficulty=1`
- Check random order: authenticated `POST /api/universes/got/episode-ladder/random/attempts` with `roundToken` and `order`

Current and previous three games are free. Older games require verified Premium access on the backend. Comments reuse the existing signed-in/completed-game authorization.

## Persistence

The scheduler prepares all five difficulties for the current day. A request can fill in missing difficulties for a released daily game. Generation stores five events per difficulty, their answer positions, and a fixed shuffle in one transaction. A per-game PostgreSQL advisory lock prevents concurrent requests from creating different puzzles. Existing puzzles are never regenerated, and no new `GOTGames` row is created by this feature.

Generation fixes the first/last episode distance to `total gaps + 4`, randomly selects three distinct interior episodes with enabled events, and picks one event from each selected episode. This provides varied spacing without depending on within-episode chronology. Daily selection remains deterministic for a given game/difficulty/catalog; random rounds use fresh randomness. If catalog coverage cannot satisfy the exact gap budget, generation fails cleanly instead of relaxing the rule or reusing an episode. All five budgets must be satisfiable to create a new daily set. No schema change is required for the gap rules; they apply only to newly generated puzzles and practice rounds.

Signed-in histories are authoritative in `GOTEpisodeLadderProgress`, keyed by user, daily game, and difficulty. Submission replays every attempt, rejects changed locked positions, and permits only one added attempt. A per-user/game transaction lock protects concurrent tabs and duplicate requests. The response's status is always calculated by the server, not accepted from the client. API difficulty values are validated from 1 through 5, defaulting to Easy when omitted.

The existing `UniverseGameResults.episode_ladder_attempts` row summarizes the best completed difficulty for compatibility with account history, archives, and comments. A win takes precedence over a loss; the highest difficulty breaks ties. Completing any difficulty unlocks that day's Ladder comments. The five difficulties do not create five competing daily summary rows.

Guests keep their history in browser storage and send it back for validation. Like existing guest play, clearing browser storage can reset their history. Guest wins can migrate after sign-in; incomplete guest games do not migrate. Failed imports remain available for retry. The existing Character/Quote result outbox is not blocked by imports.

Daily Ladder results appear in recent account history and archive outcomes. They do not change Character streaks, streak savers, or the existing Character/Quote profile totals and leaderboards.

## Random Practice

Premium members can open Random Game from the Ladder navigation. Each round selects five enabled events directly from the catalog using fresh randomness and the same difficulty rules. It does not look up a daily/archive game or insert any game, result, play, or comment records. It never writes browser progress, migrates guest results, changes streaks, or sends competitive analytics. The internal game ID is zero and is never displayed or submitted to daily endpoints.

The answer and accepted attempts are encrypted/authenticated with ASP.NET Core Data Protection and bound to the verified Supabase user. Premium is checked when starting a round and on every attempt. Correct positions remain locked; answer timestamps are hidden until completion. Tokens expire six hours after round creation. Refreshing the page starts a new round.

The next round for the selected difficulty preloads in memory. Next Random Game or Enter on the completed result advances after the reveal finishes. Switching difficulties keeps each practice round and draft order in memory until refresh; replacing a round does not reset other difficulties. No daily sharing/comments are attached to practice rounds.

Practice requires the Ladder schema and Premium status, but no Stripe configuration when Premium is enabled manually for staging. If a deployment loses its Data Protection keys, open practice rounds must restart. Multiple backend replicas need a shared persistent Data Protection key ring to accept one another's tokens. Replaying an older practice token can branch a temporary round, but cannot write results or affect competition.

## Staging And Content

Apply the original manually supplied `Characterdle-StagingEpisodeLadder.sql` and optional test seed first, then run [episode-ladder-difficulties.sql](sql/episode-ladder-difficulties.sql) once in staging before starting the updated backend. The second script preserves existing puzzles and copies account attempts to their original numeric difficulty. It adds composite puzzle keys and the private per-difficulty progress table with RLS and cascading account deletion. The application does not apply schema changes automatically. Do not run the old backend against the updated schema.

The current seed is fictional test content, not verified show events. Replace/disable test events and curate real events before release. Prefer disabling catalog events over deleting rows referenced by a saved puzzle. Editing the chronology of an already-selected event does not recalculate that puzzle's stored answer positions, so do content cleanup before public play begins.

## Validation

```sh
dotnet test Characterdle.Server.Tests/Characterdle.Server.Tests.csproj
cd characterdle.client
npm test
npm run build
```

Frontend tests use Node's built-in TypeScript stripping (Node 22.18+). On a sandbox that prevents child-process creation, run `node --experimental-strip-types --test --test-isolation=none tests/episodeLadder.test.ts`.

Before promoting staging, manually check a signed-in game across two tabs/devices, a guest win followed by sign-in, a free account blocked from an old archive, and comments after a completed Ladder. Also test several random rounds with a Premium staging account, confirm daily progress stays unchanged, and confirm a free account cannot load or submit random rounds. Validate these with real staging services; isolated automated tests do not replace that end-to-end check.
