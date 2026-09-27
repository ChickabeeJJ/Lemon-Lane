# Changelog

## 0.2.0 — Explore the lane

### Added
- **Four explorable zones** — Orchard Grove ◀ Lemon Stand ▶ Market Square ▶ Lemon Fair. Walk with the on-screen
  arrows, `←`/`→` or `A`/`D`, or the zone dots; the camera glides between zones with parallax clouds and hills.
  Arrows show a **!** when something is buildable or ready in that direction.
- **Facilities you build in the world**: tap a construction outline (or use the Upgrades panel, now grouped by zone).
  - Orchard Grove: **Tree Plots** (up to 6 extra trees), **Sprinkler** (growth), **Beehive** (golden + diamond lemons).
  - Market Square: **Sell Crate** (sell raw lemons; `Q` / Sell button), **Lemon Chute** (auto-sells overflow when the
    basket is full), **Juice Factory** (much faster press).
  - Lemon Fair: **Lucky Wheel** (free timed spin: coins, jackpot, lemons, drinks, instant ripening, Sunny Rush),
    **Lemonade Fountain** (passive income, also offline), **Golden Lemon Statue** (income multiplier).
- **Diamond lemons**: very rare, worth 40 drinks.
- New goals that walk players through every zone, with hints; Lucky Wheel status on the Goals tab.
- **New loading screen**: sunburst, drifting clouds, hills, bouncing logo, animated mascot cat, lemonade progress bar
  with a spinning lemon slice, staged messages and rotating tips.
- **Redesigned Mochi Cat**: chibi proportions, glossy eyes with highlights, rounded ears with pink insides, cheek fluff,
  ω mouth, whiskers, pink nose, collar with a swinging bell, swishing striped tail, ear twitches, a paw wave when
  delighted, droopy ears when disappointed, and four coats (orange tabby, calico, grey tabby, cream).

### Changed
- Save schema 1 → 2 (migration remaps goal progress by ID; fruit gains an optional diamond flag; wheel timer added).
- Pip costs 150 (was 90) and raw lemons are priced to keep drinks the better use when customers are waiting.
- Tests: 80 (new world/facility/wheel/migration suite).

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
- Tests: content validator, economy, save safety, simulation, formatting, and balance bots.
- Docs: README, architecture, decision log, known issues.
