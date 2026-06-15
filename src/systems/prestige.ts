// The three nested prestige loops (GDD §6). Each layer resets the one below it.
//
// Design choices the GDD leaves open (resolved on-brand, the number doesn't care):
//  - Each prestige/ascension/transcendence action grants exactly +1 level. The
//    achievements reference discrete levels ("prestige level 5/10"), which this
//    matches cleanly.
//  - Prestige availability is gated on number earned THIS run (`runEarned`), so
//    the loop is repeatable, while `totalEverEarned` (which drives upgrade-tier
//    unlocks) persists until Transcendence wipes it.

import type { GameState } from "../state";

export const PRESTIGE_RUN_EARNED_THRESHOLD = 10_000; // §6.1
export const ASCENSION_PRESTIGE_THRESHOLD = 10; // §6.2 (prestige level 10)
export const TRANSCENDENCE_ASCENSION_THRESHOLD = 5; // §6.3 (ascension level 5)

export const PRESTIGE_QUOTES: string[] = [
  "The number has been reset. It remembers nothing. But you do.",
  "Was it worth it? Yes. The number goes up faster now.",
  "Prestige Level Up. The void is 2% more generous.",
  "You sacrificed everything. You gained almost nothing. Perfect.",
  "The number is reborn. It doesn't know it died.",
  "Reset complete. The number has forgotten its past life.",
  "All that progress, gone. But the PERCENTAGE. The percentage remains.",
  "Samsara. The cycle continues. The number goes up.",
  "The number before was a different number. This is a new number. It doesn't know you yet.",
  "Somewhere in the code, a variable was set to zero. That's all prestige is.",
];

export const ASCENSION_QUOTES: string[] = [
  "You have ascended beyond prestige. The number doesn't know what that means. It goes up.",
  "Your prestiges are gone. You are left with a multiplier and a sense of loss.",
  "Ascension complete. The meta-number acknowledges you.",
  "The number goes up faster now, but at what cost? Exactly 0 cost. Ascension is free.",
  "You reset the reset. The number respects the recursion.",
];

export const TRANSCENDENCE_QUOTES: string[] = [
  "Up.", "Number.", "Again.", "Why.", "Up.", "Still.", "Here.", "Going.", "Up.",
];

function randomFrom(pool: string[]): string {
  return pool[Math.floor(Math.random() * pool.length)];
}

// --- Availability ---------------------------------------------------------

export function canPrestige(state: GameState): boolean {
  return state.runEarned >= PRESTIGE_RUN_EARNED_THRESHOLD;
}

export function canAscend(state: GameState): boolean {
  return state.prestigeLevel >= ASCENSION_PRESTIGE_THRESHOLD;
}

export function canTranscend(state: GameState): boolean {
  return state.ascensionLevel >= TRANSCENDENCE_ASCENSION_THRESHOLD;
}

/** True once the player has ever reached the layer, so the UI can reveal it. */
export function prestigeUnlocked(state: GameState): boolean {
  return state.prestigeLevel > 0 || canPrestige(state);
}
export function ascensionUnlocked(state: GameState): boolean {
  return state.ascensionLevel > 0 || canAscend(state);
}
export function transcendenceUnlocked(state: GameState): boolean {
  return state.transcendenceLevel > 0 || canTranscend(state);
}

// --- Resets ---------------------------------------------------------------

/** Wipes all upgrade counts except the ids listed (used to preserve slow). */
function clearUpgradesExcept(state: GameState, keepIds: string[]): void {
  const kept: Record<string, number> = {};
  for (const id of keepIds) {
    const count = state.upgradeCounts[id];
    if (count) kept[id] = count;
  }
  state.upgradeCounts = kept;
}

function resetRun(state: GameState): void {
  state.currentNumber = 0;
  state.runEarned = 0;
}

/**
 * Prestige (§6.1). Resets the number, all upgrades, and the red button count —
 * but the slow penalty PERSISTS (reconciled §5.7 / §6.1). +2% all production
 * per prestige level. Returns the overlay quote, or null if not available.
 */
export function doPrestige(state: GameState): string | null {
  if (!canPrestige(state)) return null;
  state.prestigeLevel += 1;
  clearUpgradesExcept(state, ["slow"]); // Slow survives prestige.
  resetRun(state);
  return randomFrom(PRESTIGE_QUOTES);
}

/**
 * Ascension (§6.2). Everything prestige resets, plus prestige levels return to
 * zero and the slow penalty finally resets. ×1.1 all production per ascension
 * level (this also scales the prestige bonus, via the single global product).
 */
export function doAscend(state: GameState): string | null {
  if (!canAscend(state)) return null;
  state.ascensionLevel += 1;
  state.prestigeLevel = 0;
  clearUpgradesExcept(state, []); // Slow resets here.
  resetRun(state);
  return randomFrom(ASCENSION_QUOTES);
}

/**
 * Transcendence (§6.3). Resets everything — ascension and prestige levels,
 * upgrades, the number, AND total-ever (so upgrade tiers re-lock). Only the
 * transcendence counter, funny-number sightings, and achievement progress
 * survive. +5% all production per level; the number's hue shifts 30°/level.
 */
export function doTranscend(state: GameState): string | null {
  if (!canTranscend(state)) return null;
  state.transcendenceLevel += 1;
  state.ascensionLevel = 0;
  state.prestigeLevel = 0;
  clearUpgradesExcept(state, []);
  resetRun(state);
  state.totalEverEarned = 0; // "Everything. All of it." (§6.3)
  return randomFrom(TRANSCENDENCE_QUOTES);
}

/** Hue rotation (degrees) for the number display at the current transcendence level (§6.3). */
export function transcendenceHueDegrees(state: GameState): number {
  return (state.transcendenceLevel * 30) % 360;
}
