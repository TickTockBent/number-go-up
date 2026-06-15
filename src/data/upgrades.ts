// Upgrade definitions, transcribed from the GDD (§5).
//
// Milestone 1 wires Tiers 1-2 (including the RED and SLOWER trap buttons).
// Later tiers and the remaining trap behaviours (mystery / void / recursive /
// green / anti-slow) land in milestone 2, so they are intentionally NOT defined
// here yet — every upgrade in this file is fully functional.

export type UpgradeEffect = {
  /** Flat addition to click power, per unit owned. */
  clickAdd?: number;
  /** Multiplier applied to click power, per unit owned (stacks multiplicatively). */
  clickMult?: number;
  /** Flat addition to passive per-second production, per unit owned. */
  autoPerSecond?: number;
  /** Global production multiplier applied per unit owned (affects click + passive). */
  globalProductionMult?: number;
};

/** Trap upgrades have bespoke behaviour handled outside the generic effect math. */
export type UpgradeSpecial = "red" | "slow";

export interface UpgradeDefinition {
  id: string;
  name: string;
  baseCost: number;
  /** Total-ever-earned threshold at which this upgrade becomes visible. */
  unlockAtTotalEver: number;
  /** Short line shown under the upgrade name. */
  description: string;
  /** Plain-language summary of the mechanical effect, shown on the buy row. */
  effectLabel: string;
  effect?: UpgradeEffect;
  special?: UpgradeSpecial;
}

export const COST_GROWTH_PER_UNIT = 1.15; // §4.3 — standard incremental scaling.

export const UPGRADE_DEFINITIONS: UpgradeDefinition[] = [
  // --- Tier 1 — The Basics (§5.1) ---
  {
    id: "click_1",
    name: "CLICK HARDER",
    baseCost: 10,
    unlockAtTotalEver: 0,
    description: "Makes number go up when you click",
    effectLabel: "+1 click power",
    effect: { clickAdd: 1 },
  },
  {
    id: "auto_1",
    name: "Number Watcher",
    baseCost: 15,
    unlockAtTotalEver: 0,
    description: "Watches the number. It goes up.",
    effectLabel: "+1 / s",
    effect: { autoPerSecond: 1 },
  },
  {
    id: "auto_2",
    name: "Number Encourager",
    baseCost: 100,
    unlockAtTotalEver: 0,
    description: "Tells the number it's doing great",
    effectLabel: "+5 / s",
    effect: { autoPerSecond: 5 },
  },
  {
    id: "auto_3",
    name: "Number Therapist",
    baseCost: 1_100,
    unlockAtTotalEver: 0,
    description: "Helps number process its feelings about going up",
    effectLabel: "+47 / s",
    effect: { autoPerSecond: 47 },
  },

  // --- Tier 2 — Getting Suspicious (§5.2), unlocked at 500 total ---
  {
    id: "auto_4",
    name: "Number Influencer",
    baseCost: 12_000,
    unlockAtTotalEver: 500,
    description: "Posts motivational quotes about going up",
    effectLabel: "+260 / s",
    effect: { autoPerSecond: 260 },
  },
  {
    id: "red",
    name: "RED BUTTON",
    baseCost: 666,
    unlockAtTotalEver: 500,
    description: "Does nothing. It's red though.",
    effectLabel: "Nothing.",
    special: "red",
  },
  {
    id: "slow",
    name: "SLOWER BUTTON",
    baseCost: 5_000,
    unlockAtTotalEver: 500,
    description: "-10% speed. Permanent. You're paying for this.",
    effectLabel: "×0.9 all production",
    special: "slow",
  },
];

export const UPGRADES_BY_ID: Record<string, UpgradeDefinition> = Object.fromEntries(
  UPGRADE_DEFINITIONS.map((definition) => [definition.id, definition]),
);

// Escalating purchase messages for the RED BUTTON (§5.7).
export const RED_BUTTON_MESSAGES: string[] = [
  "You bought the red button. It does nothing. You knew this.",
  "Another red button. Still nothing.",
  "You keep buying red buttons. This says something about you.",
  "The red buttons are starting to notice you back.",
  "The red buttons have formed a union. Their demand: more red buttons.",
  "At this point the red buttons are buying YOU.",
];

// After the scripted messages run out, rotate through these (§5.7, item 7+).
export const RED_BUTTON_ROTATING_MESSAGES: string[] = [
  "Red.",
  "Button.",
  "Red button.",
  "You.",
  "Red you.",
  "Button red you button.",
];

/** Returns the flavour message for the Nth red button purchased (1-indexed). */
export function redButtonMessage(redButtonsOwned: number): string {
  if (redButtonsOwned <= RED_BUTTON_MESSAGES.length) {
    return RED_BUTTON_MESSAGES[redButtonsOwned - 1];
  }
  const rotatingIndex = (redButtonsOwned - RED_BUTTON_MESSAGES.length - 1) % RED_BUTTON_ROTATING_MESSAGES.length;
  return RED_BUTTON_ROTATING_MESSAGES[rotatingIndex];
}

// Escalating SLOWER BUTTON messages, keyed by total speed penalty (§5.7).
export function slowButtonMessage(speedPenaltyFraction: number): string {
  const penaltyPercent = Math.round(speedPenaltyFraction * 100);
  if (speedPenaltyFraction >= 0.9) return "The number has stopped believing in movement.";
  if (speedPenaltyFraction >= 0.8) return `${penaltyPercent}% slower. The number is technically still moving. Technically.`;
  if (speedPenaltyFraction >= 0.6) return `${penaltyPercent}% slower. The number has filed a restraining order.`;
  if (speedPenaltyFraction >= 0.4) return `${penaltyPercent}% speed penalty. The number can barely move. It stares at you.`;
  if (speedPenaltyFraction >= 0.2) return `${penaltyPercent}% slower. The number is starting to resent you.`;
  return `Everything is now ${penaltyPercent}% slower. You paid for this.`;
}
