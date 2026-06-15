// Upgrade definitions, transcribed from the GDD (§5). All tiers (1-6) and every
// trap behaviour are wired. Generic effects (clickAdd / clickMult / autoPerSecond)
// live in `effect`; bespoke math (slow, green, void, recursive, anti-slow, the
// click-of-god, and the mystery button's hidden bonus) is keyed by upgrade id in
// economy.ts. The `special` tag drives UI styling + purchase flavour messages.

export type UpgradeEffect = {
  /** Flat addition to click power, per unit owned. */
  clickAdd?: number;
  /** Multiplier applied to click power, per unit owned (stacks multiplicatively). */
  clickMult?: number;
  /** Flat addition to passive per-second production, per unit owned. */
  autoPerSecond?: number;
};

/** Trap / bespoke upgrades whose math is handled by id in economy.ts. */
export type UpgradeSpecial =
  | "red"
  | "slow"
  | "green"
  | "anti_slow"
  | "mystery"
  | "void"
  | "recursive"
  | "click_god";

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

  // --- Tier 3 — Commitment Issues (§5.3), unlocked at 50K total ---
  {
    id: "auto_5",
    name: "Number Philosopher",
    baseCost: 130_000,
    unlockAtTotalEver: 50_000,
    description: "Ponders the nature of up",
    effectLabel: "+1,400 / s",
    effect: { autoPerSecond: 1_400 },
  },
  {
    id: "click_2",
    name: "Click Multiplier",
    baseCost: 75_000,
    unlockAtTotalEver: 50_000,
    description: "Your clicks now have opinions",
    effectLabel: "×1.5 click power",
    effect: { clickMult: 1.5 },
  },
  {
    id: "green",
    name: "GREEN BUTTON",
    baseCost: 100_000,
    unlockAtTotalEver: 50_000,
    description: "Finally, a button that helps. Barely.",
    effectLabel: "+0.1% all production",
    special: "green",
  },

  // --- Tier 4 — Past the Point of No Return (§5.4), unlocked at 1M total ---
  {
    id: "auto_6",
    name: "Number Deity",
    baseCost: 1_400_000,
    unlockAtTotalEver: 1_000_000,
    description: "Ascended past caring. Numbers still go up.",
    effectLabel: "+7,800 / s",
    effect: { autoPerSecond: 7_800 },
  },
  {
    id: "mystery",
    name: "???",
    baseCost: 9_999_999,
    unlockAtTotalEver: 1_000_000,
    description: "???",
    effectLabel: "Nothing. Different nothing.",
    special: "mystery",
  },
  {
    id: "anti_slow",
    name: "FASTER BUTTON",
    baseCost: 2_000_000,
    unlockAtTotalEver: 1_000_000,
    description: "Partially undoes the slower button. Costs 400x more.",
    effectLabel: "×1.05 all production",
    special: "anti_slow",
  },

  // --- Tier 5 — Why Are You Still Here (§5.5), unlocked at 100M total ---
  {
    id: "auto_7",
    name: "The Concept of Up",
    baseCost: 20_000_000,
    unlockAtTotalEver: 100_000_000,
    description: "It's not a person. It's an idea. The number respects it.",
    effectLabel: "+44,000 / s",
    effect: { autoPerSecond: 44_000 },
  },
  {
    id: "auto_8",
    name: "Number's Number",
    baseCost: 200_000_000,
    unlockAtTotalEver: 100_000_000,
    description: "Your number hired a number. That number goes up too.",
    effectLabel: "+250,000 / s",
    effect: { autoPerSecond: 250_000 },
  },
  {
    id: "void",
    name: "THE VOID BUTTON",
    baseCost: 500_000_000,
    unlockAtTotalEver: 100_000_000,
    description: "Sacrifices half your number. The other half is grateful.",
    effectLabel: "-50% current number, +25% production",
    special: "void",
  },

  // --- Tier 6 — Endgame Content (There Is No Endgame) (§5.6), unlocked at 10B ---
  {
    id: "auto_9",
    name: "Number Singularity",
    baseCost: 5_000_000_000,
    unlockAtTotalEver: 10_000_000_000,
    description: "All numbers are one number now. It goes up.",
    effectLabel: "+1,400,000 / s",
    effect: { autoPerSecond: 1_400_000 },
  },
  {
    id: "recursive",
    name: "The Game Itself",
    baseCost: 50_000_000_000,
    unlockAtTotalEver: 10_000_000_000,
    description: "The game is playing itself. You can leave. You won't.",
    effectLabel: "+0.01% of current number / s",
    special: "recursive",
  },
  {
    id: "click_3",
    name: "Click of God",
    baseCost: 100_000_000_000,
    unlockAtTotalEver: 10_000_000_000,
    description: "Each click adds your full per-second rate. Why click when it's automatic? Because you can.",
    effectLabel: "Click = 1s of production",
    special: "click_god",
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

// MYSTERY BUTTON (§5.7): 7 rotating flavour lines. Every 7th purchase silently
// grants a hidden +0.777% production bonus that is NEVER surfaced anywhere — it
// is derived from floor(count / 7) in economy.ts, so it isn't even stored as its
// own save field. If a player discovers it, we do not confirm or deny.
export const MYSTERY_BUTTON_MESSAGES: string[] = [
  "???",
  "You bought ???. ??? thanks you. Or doesn't. ???",
  "Nothing happened. Probably.",
  "The ??? regards you with whatever ??? has instead of eyes.",
  "You are now 0% closer to understanding. Or are you.",
  "???. The button does not elaborate.",
  "Something almost happened just now. It didn't. Or did it.",
];

/** Flavour line for the Nth mystery button purchased (1-indexed), cycling. */
export function mysteryButtonMessage(mysteryButtonsOwned: number): string {
  const index = (mysteryButtonsOwned - 1) % MYSTERY_BUTTON_MESSAGES.length;
  return MYSTERY_BUTTON_MESSAGES[index];
}

export const VOID_BUTTON_MESSAGE =
  "Half your number is gone. The other half is grateful. Production is up 25%.";
