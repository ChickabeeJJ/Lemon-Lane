# Lemon Lane: Sunny Stand

*Plant a little. Sell a little. Grow a lot.*

A cute 2D idle tycoon for [CrazyGames](https://www.crazygames.com). Grow lemons, squeeze drinks, serve
neighborhood customers, hire helpers, open up the lane, discover recipes, collect stickers and awnings,
and celebrate a **Sunrise** that turns this chapter's progress into permanent Sunny Tokens.

The design source of truth is the production bible in [`docs/Lemon_Lane_Master_Bible.docx`](docs/Lemon_Lane_Master_Bible.docx).

## Play locally

```bash
npm install
npm run dev          # http://localhost:5173  (add ?nosdk to skip loading the CrazyGames SDK)
```

| Action | Mouse / touch | Keyboard |
| --- | --- | --- |
| Pick ripe lemons | Tap a tree, or the **Pick** button | `Space` |
| Squeeze the press faster | Tap the press, or **Squeeze** | `S` |
| Serve the next customer | Tap the stand/queue, or **Serve** | `E` / `Enter` |
| Open a panel | Tabs at the bottom | `1`–`7` |
| Close panel / dialog | ✕ | `Esc` |

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck + production build into `dist/` |
| `npm run preview` | Serve the production build |
| `npm test` | All unit, save-safety and balance-simulation tests (Vitest) |
| `npm run validate` | Content validator only (IDs, references, costs, strings) |
| `npm run typecheck` | TypeScript only |

## Shipping to CrazyGames

1. `npm run build`
2. Zip the **contents** of `dist/` (the build uses relative paths, so it works from any sub-path).
3. Upload in the CrazyGames Developer Portal, enable the **Data** module for cloud saves, and test in the
   portal's preview/QA tool. Re-check the SDK docs first — see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md#platform-crazygames-sdk-v3)
   for the exact SDK calls used and [`KNOWN_ISSUES.md`](KNOWN_ISSUES.md) for what still needs verifying there.

## Project map

```
src/
  content/     ContentRegistry: all data + balance (content.ts), types, English strings
  core/        GameState, EconomyService, simulation (production/customers/automation),
               actions (atomic purchases, regions, Sunrise), quests, layout, RNG
  save/        SaveManager (versioned envelope, migrations, backup, conflicts) + validation
  platform/    PlatformAdapter — the only code that touches the CrazyGames SDK
  render/      Canvas renderer, procedural art primitives, UI icon factory, palette
  ui/          DOM UI (HUD, dock, panels, modals, toasts), styles, number formatting
  audio/       Synthesized WebAudio cues + music loop
  analytics/   Local privacy-safe event log
  game/        Game orchestrator: fixed-step loop, events → presentation, saving, ads
tests/         Vitest suites + headless player bots for balance simulation
docs/          Architecture, decision log, the production bible
```

See also [`CHANGELOG.md`](CHANGELOG.md), [`KNOWN_ISSUES.md`](KNOWN_ISSUES.md) and [`docs/DECISIONS.md`](docs/DECISIONS.md).

All art, audio, names and code are original. Art is drawn procedurally in code from a shared palette and
outline rules, and audio is synthesized at runtime, so there are no third-party assets to license.
