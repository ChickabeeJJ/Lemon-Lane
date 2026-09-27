# Architecture

Vanilla TypeScript + Vite. Canvas 2D for the world, DOM for the UI. No runtime dependencies.
The module split follows bible §23.

| Bible module | Code | Responsibility |
| --- | --- | --- |
| PlatformAdapter | `src/platform/PlatformAdapter.ts` | SDK load/init, gameplay events, data storage, ads, user. Local fallback. |
| SaveManager | `src/save/SaveManager.ts`, `src/save/validate.ts` | Envelope, migrations, validation, backup, quarantine, multi-tab conflicts |
| GameState | `src/core/state.ts` | Durable `GameState` (saved) + temporary `SessionState` (never saved) |
| EconomyService | `src/core/economy.ts` | Derived stats, costs, sale values, automated rates, offline income, Sunrise tokens |
| ProductionService / CustomerService / AutomationService | `src/core/sim.ts` | Deterministic `step()` — trees, press, queue, patience, combos, helpers, delivery cart |
| ProgressionService | `src/core/actions.ts`, `src/core/quests.ts` | Atomic purchases, regions, recipes, perks, Sunrise, goals, daily basket |
| EventService | — | Not built yet (see KNOWN_ISSUES) |
| UIController | `src/ui/UI.ts` | HUD, dock, tabbed panels, modals, toasts, keyboard |
| Renderer | `src/render/Renderer.ts`, `draw.ts`, `icons.ts` | Scene composition, FX pool, hit testing, UI icons from the same art code |
| AudioManager | `src/audio/AudioManager.ts` | Synthesized SFX + music; autoplay-safe; platform/ad/tab muting |
| ContentRegistry | `src/content/content.ts` | Every content item and every balance number |
| Orchestration | `src/game/Game.ts` | Fixed-step loop, event → FX/audio/analytics routing, save scheduling, ad flows |

## Data flow

```
input (pointer / keys / buttons)
      │
      ▼
Game.action() ──► core/actions.ts  (validate → deduct → apply, or no change + reason)
      │                │
      │                └─► GameState mutated
      ├─► computeStats() (pure, from levels/regions/perks/recipe)
      ├─► requestSave()  (debounced; immediate-ish for purchases)
      └─► FX / audio / analytics
frame (rAF) ──► fixed 30 Hz step(g, s, dt, ctx) ──► SimEvents ──► Game.onSimEvent ──► Renderer FX, audio, toasts
            └─► Renderer.render(g, s, stats)  (read-only)
UI refresh: cheap fields every frame, panels every 250 ms; panels rebuild only when a structural signature changes.
```

Rules the code keeps:

- **Simulation never touches presentation.** `sim.ts` emits `SimEvent`s; renderer/audio only read.
- **All numbers live in content.** Stats are computed as `(base + Σadd·level) × (1 + Σpct·level)` then clamped by
  `STAT_LIMITS` (soft caps). Upgrades, helpers, perks and regions all declare `effects`, so a new item needs data only.
- **Purchases are atomic** (`core/actions.ts`): validate price and state, deduct, apply, then the caller saves and animates.
  NaN/Infinity/negative balances or costs are rejected.
- **Time is clamped.** `step()` ignores NaN/negative deltas and caps a single call at 10 s; longer gaps are handled as
  offline progress with a summary.

## Save format

```json
{ "schema": 3, "savedAt": 1727430000000, "state": { ...GameState } }
```

Keys: `lemonlane_save` (primary), `lemonlane_save_backup` (previous primary, refreshed at most once a minute),
`lemonlane_save_quarantine` (unreadable or newer-schema data, kept untouched).

Loading: parse primary + backup → quarantine anything with a newer schema (never overwritten) → migrate each through
`MIGRATIONS[n]` (schema n → n+1) → pick newest `savedAt` (ties prefer primary) → `sanitizeState()` validates every field
(finite, clamped, known IDs only, contiguous regions, future timestamps clamped).

Saving: before writing, the stored envelope is re-read; if its `savedAt` is newer than what this session last wrote,
another tab/device wrote since, so the write is refused (`conflict`) and the player is told to reload. Saves happen after
purchases (≈0.3 s debounce), every 15 s, on tab hide and on `pagehide`. Never per frame.

Durable vs temporary: customers, helper timers, combo and animation state are session-only. Lemons, drinks,
fruit growth and press progress are durable so a refresh never loses stock.

To change the schema: bump `SAVE_SCHEMA`, add `MIGRATIONS[old]`, extend `sanitizeState`, add a test in `tests/save.test.ts`.

## Platform: CrazyGames SDK v3

`createPlatform()` injects `https://sdk.crazygames.com/crazygames-sdk-v3.js`, awaits `SDK.init()` before gameplay,
and falls back to `LocalAdapter` if the script can't load, `init` throws, or `SDK.environment === "disabled"`.
`?nosdk` forces the local adapter.

SDK surface used (nothing else):

| Call | Where |
| --- | --- |
| `SDK.init()` | boot |
| `SDK.environment` | boot (disabled → local) |
| `SDK.game.loadingStart()` / `loadingStop()` | boot |
| `SDK.game.gameplayStart()` / `gameplayStop()` | play vs. modal / ad / hidden tab (deduplicated) |
| `SDK.game.happytime()` | region opened, Sunrise, combo ×10 |
| `SDK.game.settings.muteAudio`, `addSettingsChangeListener` | audio mute |
| `SDK.ad.requestAd("rewarded" \| "midgame", { adStarted, adFinished, adError })` | Sunny Rush, offline ×2, post-Sunrise break |
| `SDK.data.getItem / setItem / removeItem` | save storage (falls back to localStorage if the Data module throws) |
| `SDK.user.getUser()` | show the player's username when signed in |

These names were checked against the SDK's published TypeScript typings (the docs site wasn't reachable from the
build environment). Re-check against the official docs before every submission.

Ads: only player-initiated rewarded ads (clearly styled with an **AD** badge, never like an upgrade button) plus one
midgame ad at a natural break right after the Sunrise transition. A reward is granted only on `adFinished`; errors,
timeouts (120 s) or overlapping requests grant nothing and gameplay resumes. Nothing in the core loop depends on ads.
Outside CrazyGames, ad buttons are hidden (never faked).

## Zones and facilities

The world is four 1200-unit-wide zones laid side by side (`ZONES`, index −1…2; home = 0 spans x 0…1200).
The camera (`Renderer.setZone`) eases between zone left edges; sky is fixed, clouds and far hills use parallax.
Each `UpgradeDef` has a `zone`; `FACILITY_IDS` are upgrades that exist as buildings (level 0 = tappable construction
outline, positions in `core/layout.ts` `FACILITY_SPOTS`). Tree slots 0–4 stand beside the stand, 5–10 are Orchard
Grove plots (`treeSpot()`, `treeSlotActive()`). Lucky Wheel logic is in `core/wheel.ts`; selling, the Lemon Chute and
the fountain are in `core/sim.ts`. Perfect Squeeze is in `core/sim.ts` (`squeezeMeter`), Market Demand in
`core/economy.ts` (`demandRecipe`), and the Order Board in `core/contracts.ts`.

## Rendering

Each zone is a fixed 1200×675 logical room scaled with "contain"; sky and ground extend to fill any aspect ratio. Everything is drawn procedurally with the palette in `render/palette.ts` and the
primitives in `render/draw.ts` (cocoa outlines, soft ground shadows, rounded shapes). UI icons are rendered once from the
same functions into cached data URLs. Particles are pooled and capped (90). Reduced-motion disables wobble, sway,
bobbing and particle travel.

## Testing

- `tests/content.test.ts` — content validator (duplicate IDs, references, costs, strings, stats, cosmetic reachability)
- `tests/economy.test.ts` — exact-coin / one-short purchases, NaN balances, locks, seats, region order, Sunrise reset
  and preservation, offline caps
- `tests/save.test.ts` — round trip, corrupt → quarantine, backup recovery, newer schema never overwritten, multi-tab
  conflict, storage errors, migration chain, validation of NaN/Infinity/unknown IDs
- `tests/sim.test.ts` — growth boundary, basket cap, golden lemons pay once, press/counter, serving, patience,
  queue bounds, determinism, delta clamping, goals pay once
- `tests/world.test.ts` — Sell Crate, Lemon Chute, diamond lemons, grove plots, Lucky Wheel cooldown/rewards,
  fountain income, facility locks, save migration 1 → 2
- `tests/loops.test.ts` — Perfect Squeeze timing, Market Demand rotation/bonus, Order Board offers, partial and
  complete delivery, streaks, expiry, Sunrise interaction, migration 2 → 3
- `tests/layout.test.ts` — no overlapping buildings, trees, construction outlines or signs in any zone
- `tests/balance.test.ts` — headless bots (active / casual / automation-first) play the real economy and assert the
  first-ten-minutes pacing and time-to-first-Sunrise
