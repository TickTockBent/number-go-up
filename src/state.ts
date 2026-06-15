// Central game state. The entire save fits comfortably under the GDD's 2KB
// budget (§15.3). Fields for systems not yet built (prestige/ascension/etc.) are
// included now so the save schema is stable from the start.

import type { NotationMode } from "./systems/notation";

export const SAVE_VERSION = 1;

export interface GameState {
  saveVersion: number;

  // The number, and the number's biography.
  currentNumber: number;
  totalEverEarned: number;
  /** Number earned since the last prestige/ascension/transcendence reset. Gates prestige. */
  runEarned: number;
  totalClicks: number;

  /** Owned count per upgrade id. Absent id == zero owned. */
  upgradeCounts: Record<string, number>;

  // Prestige layers (§6) — present in the schema, wired in a later milestone.
  prestigeLevel: number;
  ascensionLevel: number;
  transcendenceLevel: number;

  // Settings (§13).
  notationMode: NotationMode;

  /** Wall-clock ms timestamp of the last save, used for offline progress (§9.1). */
  lastSavedAtMs: number;
}

export function createDefaultState(nowMs: number): GameState {
  return {
    saveVersion: SAVE_VERSION,
    currentNumber: 0,
    totalEverEarned: 0,
    runEarned: 0,
    totalClicks: 0,
    upgradeCounts: {},
    prestigeLevel: 0,
    ascensionLevel: 0,
    transcendenceLevel: 0,
    notationMode: "enjoyer", // Default per §3.2 — keeps 7-digit funny numbers visible.
    lastSavedAtMs: nowMs,
  };
}

export function ownedCount(state: GameState, upgradeId: string): number {
  return state.upgradeCounts[upgradeId] ?? 0;
}

/** Adds production to the number, keeping the total-ever and per-run odometers in sync. */
export function addToNumber(state: GameState, amount: number): void {
  if (amount <= 0) return;
  state.currentNumber += amount;
  state.totalEverEarned += amount;
  state.runEarned += amount;
}
