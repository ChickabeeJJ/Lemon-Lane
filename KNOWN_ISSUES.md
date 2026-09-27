# Known Issues & Not Yet Built

Honest status for 0.1.0. Items here block a CrazyGames **Full Launch** unless marked otherwise.

## Must verify on CrazyGames before submission
- **Not yet tested inside the CrazyGames preview/QA tool.** The SDK was unreachable from the build environment, so only
  the local fallback path has been run. The SDK calls in use were checked against the SDK's published TypeScript
  typings, not the live docs. Re-check every call listed in `docs/ARCHITECTURE.md`.
- **Data module**: must be enabled for the game in the Developer Portal. If `SDK.data` throws, the game falls back to
  localStorage (progress then stays on that device). Guest → account migration relies on the Data module's own behavior.
- **Ad flows** (Sunny Rush, offline ×2, post-Sunrise midgame) are untested with real ads, including the mute/pause timing.
- The in-game "sign in" prompt isn't offered; the username is shown only if the player is already signed in.

## Not built yet (bible scope)
- **Events** (§15: Rainy Day, Picnic Weekend, …) and the EventService. Festival Spirit boosts goals/daily instead (D-007).
- **Localization** beyond English (the string table and key checks are in place).
- **Banner ads** (§21 "responsive banner only when allowed").
- Recipe "discovery chance" and helper outfits / hats / tablecloths / other cosmetic families; only awnings exist.
- Weather (Orchard Hill "weather", Sun Umbrella "weather resilience" is patience only).
- Remote analytics (events are logged locally only — D-010).
- Launch assets: cover art, icon, screenshots, store description.

## Rough edges
- **Portrait phones**: each 16:9 zone is fitted to the screen width, so it's small in portrait. Landscape plays best.
  The Pick / Squeeze / Serve buttons work the same everywhere.
- On narrow phones the tab label "Upgrades" is clipped slightly.
- On very wide screens a sliver of the neighbouring zone shows at the edges.
- Lemons picked in the Orchard Grove fly to the basket at the stand, off-screen to the right.
- Music is a short synthesized loop; final audio should be composed.
- Art is procedural. It's consistent, but focal assets (characters, stand) would benefit from hand-illustrated versions
  following the same palette and anchors.
- Facility pacing (Juice Factory, Golden Statue, Beehive) is only covered by the bots' cheapest-first buying.
- Balance is tuned with bots for roughly the first hour (first Sunrise ≈ 1 h for an automation-first bot). Late-game
  (post-second Sunrise, Moonlit Market) pacing hasn't been simulated in depth.
- Long idle sessions and very large numbers are covered by formatting and clamping tests, but they haven't been
  profiled on low-end mobile hardware.
