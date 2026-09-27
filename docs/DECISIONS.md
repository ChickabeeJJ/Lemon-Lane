# Decision Log

Format follows bible §41: decision, context, alternatives, consequences.

### D-001 — Vanilla TypeScript + Canvas 2D + DOM UI, no engine
- **Context:** Small first load (CrazyGames), full control over save/platform code, easy for another developer.
- **Alternatives:** Phaser/Pixi (bigger bundle, more abstractions than a single-screen lane needs).
- **Consequences:** ~115 KB JS (≈37 KB gzip) with zero runtime deps. UI is accessible HTML (real buttons, text numbers).

### D-002 — Procedural art instead of bitmap assets
- **Context:** Bible demands one coherent, handcrafted style and forbids inconsistent generated art; no artist yet.
- **Decision:** Every character, station and prop is drawn from shared primitives (palette, cocoa outline, soft shadow).
  UI icons render from the same functions.
- **Consequences:** Perfectly consistent style, tiny download, instant visual upgrades by level tier. Final
  illustrated art can later replace draw functions one by one behind the same anchors.

### D-003 — Generic stat/effect system
- **Decision:** Upgrades, helpers, perks, regions and recipe traits declare `effects` on named stats;
  `computeStats()` folds them with soft caps.
- **Consequences:** New content is data-only; UI previews ("Growth ×1.12 → ×1.24") come for free and stay truthful.

### D-004 — Pip is hireable in Tiny Yard
- **Context:** Bible §10 lists "first helper" under Sunny Lane, but §28 wants a helper introduced by minute 3.
- **Decision:** Pip (auto-pick) is in Tiny Yard; Roo (auto-serve) arrives with Sunny Lane.
- **Consequences:** Balance sim: Pip ≈ 1 min, Sunny Lane ≈ 5–6 min for active players.

### D-005 — One active recipe at a time
- **Context:** Bible wants recipes to be a speed-vs-value choice without spreadsheet homework.
- **Decision:** The press makes the chosen recipe; customers with that favorite pay a bonus; recipe traits add a
  secondary effect (premium orders, combo cap, offline value, golden chance).
- **Alternatives:** Multi-recipe menus with per-order production (more UI, more rules).

### D-006 — Discovered recipes survive Sunrise but need their lane spot reopened
- **Context:** Bible §12 keeps discovered recipes; keeping them instantly usable would trivialize the next chapter.
- **Consequences:** No re-purchase cost; pacing of each chapter stays meaningful.

### D-007 — Festival Spirit boosts goal and daily rewards
- **Context:** Bible perk "stronger event rewards", but events are not built yet. A perk with no effect would be a dead control.
- **Decision:** It boosts goal + daily basket rewards now; revisit when events ship.

### D-008 — Save conflicts refuse to write
- **Decision:** If storage holds a newer `savedAt` than this session wrote, never overwrite; tell the player to reload.
- **Consequences:** Two open tabs can't clobber each other; worst case is losing unsaved seconds in the older tab.

### D-009 — Offline income from automated steady state only
- **Decision:** `automatedRates()` computes min(growth, Pip picks, press, arrivals, Roo serves) × average sale; manual
  play is excluded, boosts never apply offline; capped by `offlineCapHours` and scaled by `offlineEfficiency`.
- **Consequences:** Honest, deterministic, testable; encourages hiring helpers (the idle fantasy).

### D-010 — Analytics stay local
- **Context:** Bible lists events, but no analytics backend exists and inventing one would be fake integration.
- **Decision:** Events with minimal, non-personal payloads go to an in-memory log (`window.__lemonLane.analytics`).

### D-011 — Explorable zones instead of a single fixed screen
- **Context:** Player feedback asked for arrows to move around the world and unlock new facilities (the
  "Sell Lemons"-style tycoon loop). Bible §4 prefers a stable camera for spatial memory.
- **Decision:** Keep each zone's camera fixed and identical in scale; arrows move between four fixed zone "rooms"
  (no free scrolling). The stand stays the home zone; customers never leave it.
- **Consequences:** Spatial memory survives (every zone always looks the same), expansion gets physical space.

### D-012 — Facilities are upgrades with a zone
- **Decision:** `UpgradeDef.zone` places an upgrade in the world; level 0 renders a tappable construction outline.
  No separate facility system, so costs, effects, previews, saves and validation are shared.

### D-013 — Selling raw lemons
- **Decision:** Raw lemons sell for 25% of a drink's per-lemon value × Sell Crate multiplier. Drinks stay better when
  customers are waiting; selling wins when customers are the bottleneck — a real choice, not a replacement.

### D-014 — Lucky Wheel is free and timed
- **Decision:** No ads or purchases on the wheel; rewards scale with income; applied atomically at spin time
  (the animation is presentation only, so a refresh mid-spin never loses or duplicates a prize).
