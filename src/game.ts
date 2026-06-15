// Player actions: clicking the number and buying upgrades. Kept separate from
// the render/loop layer so these stay easy to unit-test later.

import {
  redButtonMessage,
  slowButtonMessage,
  UPGRADES_BY_ID,
} from "./data/upgrades";
import {
  clickPower,
  nextCostFor,
  speedPenaltyFraction,
} from "./systems/economy";
import { addToNumber, ownedCount, type GameState } from "./state";

export interface PurchaseResult {
  success: boolean;
  /** Flavour message to surface as a toast (trap buttons only). */
  message?: string;
}

/** Click the number. Returns the amount added so the UI can spawn a +N particle. */
export function performClick(state: GameState): number {
  const amountGained = clickPower(state);
  addToNumber(state, amountGained);
  state.totalClicks += 1;
  return amountGained;
}

export function buyUpgrade(state: GameState, upgradeId: string): PurchaseResult {
  const definition = UPGRADES_BY_ID[upgradeId];
  if (!definition) return { success: false };

  const cost = nextCostFor(state, upgradeId);
  if (state.currentNumber < cost) return { success: false };

  state.currentNumber -= cost;
  state.upgradeCounts[upgradeId] = ownedCount(state, upgradeId) + 1;

  // Trap buttons get their escalating flavour text (§5.7).
  if (definition.special === "red") {
    return { success: true, message: redButtonMessage(state.upgradeCounts[upgradeId]) };
  }
  if (definition.special === "slow") {
    return { success: true, message: slowButtonMessage(speedPenaltyFraction(state)) };
  }
  return { success: true };
}
