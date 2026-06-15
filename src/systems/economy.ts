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

/** Each 7th mystery button purchase grants a hidden +0.777% bonus (§5.7). */
export function mysteryHiddenTriggers(state: GameState): number {
  return Math.floor(ownedCount(state, "mystery") / 7);
}

/**
 * Bonus from a prestige-style level using a per-level additive percentage.
 * Returns a multiplier of the form (1 + perLevel × level).
 */
function additiveLevelBonus(level: number, perLevel: number): number {
  return 1 + perLevel * level;
}

/**
 * Global production multiplier applied to BOTH click power and passive output.
 * Everything that scales "all production" lands here, as one product:
 *   - SLOWER BUTTON  ×0.9 per unit          (§5.2)
 *   - FASTER BUTTON  ×1.05 per unit         (§5.4)
 *   - GREEN BUTTON   +0.1% per unit         (§5.3)
 *   - VOID BUTTON    +25% per unit          (§5.5)
 *   - Mystery hidden +0.777% per 7th buy    (§5.7, never displayed)
 *   - Prestige       +2% per level          (§6.1)
 *   - Ascension      ×1.1 per level          (§6.2, also scales the prestige bonus)
 *   - Transcendence  +5% per level          (§6.3)
 * Heavy Wallet (×0.99999, §8.2) joins in the Steam milestone.
 */
export function globalProductionMultiplier(state: GameState): number {
  const slowFactor = Math.pow(0.9, ownedCount(state, "slow"));
  const fasterFactor = Math.pow(1.05, ownedCount(state, "anti_slow"));
  const greenFactor = additiveLevelBonus(ownedCount(state, "green"), 0.001);
  const voidFactor = Math.pow(1.25, ownedCount(state, "void"));
  const mysteryFactor = additiveLevelBonus(mysteryHiddenTriggers(state), 0.00777);

  const prestigeFactor = additiveLevelBonus(state.prestigeLevel, 0.02);
  const ascensionFactor = Math.pow(1.1, state.ascensionLevel);
  const transcendenceFactor = additiveLevelBonus(state.transcendenceLevel, 0.05);

  // Heavy Wallet DLC: a permanent, irremovable ×0.99999 (-0.001%) (§8.2).
  const heavyWalletFactor = state.heavyWalletActive ? 0.99999 : 1;

  return (
    slowFactor *
    fasterFactor *
    greenFactor *
    voidFactor *
    mysteryFactor *
    prestigeFactor *
    ascensionFactor *
    transcendenceFactor *
    heavyWalletFactor
  );
}

/**
 * Speed penalty as a fraction in [0, 1), used only for the escalating SLOWER
 * BUTTON messages — so it measures the slow factor alone, not bonuses that push
 * the global multiplier back above 1.
 */
export function speedPenaltyFraction(state: GameState): number {
  return 1 - Math.pow(0.9, ownedCount(state, "slow"));
}

/** Per-second contribution from "The Game Itself" — 0.01% of the current number per unit (§5.6). */
function recursivePerSecond(state: GameState): number {
  const recursiveCount = ownedCount(state, "recursive");
  if (recursiveCount === 0) return 0;
  return 0.0001 * recursiveCount * state.currentNumber;
}

/** Passive production per second, after upgrades and global multipliers. */
export function passivePerSecond(state: GameState): number {
  let basePerSecond = recursivePerSecond(state);
  for (const definition of UPGRADE_DEFINITIONS) {
    const owned = ownedCount(state, definition.id);
    if (owned === 0 || !definition.effect?.autoPerSecond) continue;
    basePerSecond += definition.effect.autoPerSecond * owned;
  }
  return basePerSecond * globalProductionMultiplier(state);
}

/**
 * Number added per click, after upgrades and global multipliers. With the
 * Click of God owned, each click also adds one full second of production (§5.6).
 */
export function clickPower(state: GameState): number {
  let flatClickPower = 1; // Base click power is 1 (§4.1).
  let clickMultiplier = 1;

  for (const definition of UPGRADE_DEFINITIONS) {
    const owned = ownedCount(state, definition.id);
    if (owned === 0 || !definition.effect) continue;
    if (definition.effect.clickAdd) flatClickPower += definition.effect.clickAdd * owned;
    if (definition.effect.clickMult) clickMultiplier *= Math.pow(definition.effect.clickMult, owned);
  }

  const baseClickGain = flatClickPower * clickMultiplier * globalProductionMultiplier(state);
  const clickOfGodGain = ownedCount(state, "click_3") * passivePerSecond(state);
  return baseClickGain + clickOfGodGain;
}
