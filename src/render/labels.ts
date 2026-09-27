// Text shown on construction signs. Shared by the renderer and the layout tests so both size the same sign.
import { upgradeById } from "../content/content";
import { nameOf } from "../content/strings";
import type { UpgradeId } from "../content/types";
import { upgradeLocked } from "../core/actions";
import { upgradeCost, type StatBlock } from "../core/economy";
import type { GameState } from "../core/state";
import { formatNumber } from "../ui/format";

export function constructionText(g: GameState, stats: StatBlock, id: UpgradeId): { title: string; line2: string } {
  const def = upgradeById.get(id)!;
  const title = nameOf("upgrade", id);
  const line2 = upgradeLocked(g, id) ? `Needs ${nameOf("region", def.region)}` : `Build · ${formatNumber(upgradeCost(g, id, stats))}`;
  return { title, line2 };
}
