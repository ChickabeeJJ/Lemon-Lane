# Lemon Lane — notes for Claude

Source of truth: `docs/Lemon_Lane_Master_Bible.docx` (bible). Architecture: `docs/ARCHITECTURE.md`.

## Commands
- `npm test` — all tests (content validator, economy, saves, sim, balance bots). Run before every commit.
- `npm run build` — typecheck + production build. `npm run dev` then open `/?nosdk` to skip the SDK.

## Rules (from bible §26, condensed)
- Inspect before changing; don't rewrite working systems.
- Never invent CrazyGames SDK methods. All SDK calls stay in `src/platform/PlatformAdapter.ts`.
- Never fake cloud saves, profiles, leaderboards or ads. Hide a control rather than fake it; no dead buttons.
- Balance numbers live in `src/content/content.ts`, never in rendering/UI code. New content = data + strings.
- Purchases go through `src/core/actions.ts` (validate → deduct → apply). Simulation (`src/core/sim.ts`) never touches presentation.
- Saves: bump `SAVE_SCHEMA` + add a migration + a test for any durable-state change.
- Every visible upgrade needs a visible world change (`src/render/`), using the shared palette and draw primitives.
- Record decisions in `docs/DECISIONS.md`, changes in `CHANGELOG.md`, gaps in `KNOWN_ISSUES.md`.
