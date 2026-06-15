// Player actions: clicking the number and buying upgrades. Kept separate from
// the render/loop layer so these stay easy to unit-test later.

import {
  mysteryButtonMessage,
  redButtonMessage,
  slowButtonMessage,
  UPGRADES_BY_ID,
  VOID_BUTTON_MESSAGE,
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
  const newCount = ownedCount(state, upgradeId) + 1;
  state.upgradeCounts[upgradeId] = newCount;

  // Trap buttons get their escalating flavour text (§5.7).
  switch (definition.special) {
    case "red":
      return { success: true, message: redButtonMessage(newCount) };
    case "slow":
      return { success: true, message: slowButtonMessage(speedPenaltyFraction(state)) };
    case "mystery":
      return { success: true, message: mysteryButtonMessage(newCount) };
    case "void":
      // Sacrifice half the current number; the +25% production lives in the
      // global multiplier (§5.5). Total-ever is untouched — the number was earned.
      state.currentNumber *= 0.5;
      return { success: true, message: VOID_BUTTON_MESSAGE };
    default:
      return { success: true };
  }
}
