// Production and cost math (GDD §4.3, §5).

import {
  COST_GROWTH_PER_UNIT,
  UPGRADE_DEFINITIONS,
  UPGRADES_BY_ID,
  type UpgradeDefinition,
} from "../data/upgrades";
import { ownedCount, type GameState } from "../state";

/**
 * Cost of the next unit of an upgrade: baseCost × 1.15^(owned). Exponential
 * scaling produces the "just one more" psychology the GDD calls for.
 */
export function nextCost(definition: UpgradeDefinition, owned: number): number {
  return Math.ceil(definition.baseCost * Math.pow(COST_GROWTH_PER_UNIT, owned));
}

export function nextCostFor(state: GameState, upgradeId: string): number {
  const definition = UPGRADES_BY_ID[upgradeId];
  return nextCost(definition, ownedCount(state, upgradeId));
}

export function canAfford(state: GameState, upgradeId: string): boolean {
  return state.currentNumber >= nextCostFor(state, upgradeId);
}

export function isUnlocked(state: GameState, definition: UpgradeDefinition): boolean {
  return state.totalEverEarned >= definition.unlockAtTotalEver;
}

export function unlockedUpgrades(state: GameState): UpgradeDefinition[] {
  return UPGRADE_DEFINITIONS.filter((definition) => isUnlocked(state, definition));
}

/**
 * Global production multiplier applied to BOTH click power and passive output.
 * Currently only the SLOWER BUTTON contributes (×0.9 per unit, multiplicative —
 * §5.2). Prestige/ascension/transcendence/heavy-wallet multipliers slot in here
 * as those systems come online.
 */
export function globalProductionMultiplier(state: GameState): number {
  const slowCount = ownedCount(state, "slow");
  return Math.pow(0.9, slowCount);
}

/** Speed penalty as a fraction in [0, 1), for the escalating slow messages. */
export function speedPenaltyFraction(state: GameState): number {
  return 1 - globalProductionMultiplier(state);
}

/** Number added per click, after upgrades and global multipliers. */
export function clickPower(state: GameState): number {
  let flatClickPower = 1; // Base click power is 1 (§4.1).
  let clickMultiplier = 1;

  for (const definition of UPGRADE_DEFINITIONS) {
    const owned = ownedCount(state, definition.id);
    if (owned === 0 || !definition.effect) continue;
    if (definition.effect.clickAdd) flatClickPower += definition.effect.clickAdd * owned;
    if (definition.effect.clickMult) clickMultiplier *= Math.pow(definition.effect.clickMult, owned);
  }

  return flatClickPower * clickMultiplier * globalProductionMultiplier(state);
}

/** Passive production per second, after upgrades and global multipliers. */
export function passivePerSecond(state: GameState): number {
  let basePerSecond = 0;
  for (const definition of UPGRADE_DEFINITIONS) {
    const owned = ownedCount(state, definition.id);
    if (owned === 0 || !definition.effect?.autoPerSecond) continue;
    basePerSecond += definition.effect.autoPerSecond * owned;
  }
  return basePerSecond * globalProductionMultiplier(state);
}
