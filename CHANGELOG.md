# Changelog

## 0.1.0 — First playable vertical slice

Built from the Lemon Lane Master Bible, following its build order (§27) through step 13, plus parts of 15–18.

### Added
- Responsive canvas lane with a stable camera, layered sky / neighborhood / foreground, and phone/desktop layouts
  (side panel on wide screens, bottom sheet in portrait).
- **PlatformAdapter** for CrazyGames HTML5 SDK v3 (init, loading + gameplay events, happytime, data module saves,
  rewarded/midgame ads, username) with a local fallback that fakes nothing.
- **SaveManager**: versioned envelope, migration chain, full validation, backup, quarantine for unreadable/newer data,
  multi-tab conflict protection, debounced + periodic + on-hide saves.
- Core loop: lemons grow (blossom → green → ripe, golden lemons), pick by tapping trees, basket capacity, juice press
  (auto + tap to squeeze), counter capacity, customer queue with patience, orders, premium orders, tips, favorites, combos.
- 12 station upgrades, each with visible world changes, a readable before → after preview, and data-driven effects.
- 8 helpers (Pip auto-picks, Roo auto-serves, six passive helpers) with visible characters and helper seats.
- 8 lane regions that preview themselves with a signpost and transform the scene when opened.
- 8 recipes with distinct glassware, speed/value trade-offs and traits.
- 8 customer types with distinct silhouettes and gentle reactions.
- Sunrise prestige with token formula, 10 permanent perks and a warm transition.
- Goal chain (22 authored goals with tutorial hints, then endless generated goals) and a daily basket.
- Collections (customer stickers, recipe cards, lane spots → Collection Stars) and six awning cosmetics.
- Offline earnings summary with optional rewarded ×2; Sunny Rush rewarded boost.
- Synthesized audio (SFX + music), music/SFX/reduced-motion settings, keyboard shortcuts, platform mute support.
- Local analytics log for the bible's event list.
- Tests: content validator, economy, save safety, simulation, formatting, and balance bots (65 tests).
- Docs: README, architecture, decision log, known issues.
