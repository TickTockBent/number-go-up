// Central game state. The entire save fits comfortably under the GDD's 2KB
// budget (§15.3). Fields for systems not yet built (prestige/ascension/etc.) are
// included now so the save schema is stable from the start.

import type { NotationMode } from "./systems/notation";

export const SAVE_VERSION = 1;

export type ScreenShakeMode = "on" | "off" | "max";
export type ColorblindMode = "none" | "protanopia" | "deuteranopia" | "tritanopia";

/** Player settings (GDD §13). */
export interface GameSettings {
  offlineProgress: boolean;
  screenShake: ScreenShakeMode;
  funnyPopups: boolean;
  /** Manual number-hue override in degrees; null = derive from transcendence. Locked unless transcended. */
  numberColorHue: number | null;
  volumes: { master: number; music: number; sfx: number; stinger: number };
  // Accessibility (§13.3)
  reducedMotion: boolean;
  highContrast: boolean;
  screenReader: boolean;
  autoClick: boolean;
  colorblindMode: ColorblindMode;
}

export function createDefaultSettings(): GameSettings {
  return {
    offlineProgress: true,
    screenShake: "on",
    funnyPopups: true,
    numberColorHue: null,
    volumes: { master: 0.8, music: 0.6, sfx: 0.9, stinger: 1.0 },
    reducedMotion: false,
    highContrast: false,
    screenReader: false,
    autoClick: false,
    colorblindMode: "none",
  };
}

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

  // Prestige layers (§6).
  prestigeLevel: number;
  ascensionLevel: number;
  transcendenceLevel: number;

  /**
   * Lifetime sighting count per funny-number pattern (§7.5). This is the one
   * stat that never resets — not on prestige, ascension, or transcendence.
   */
  funnyNumberSightings: Record<string, number>;

  /** Achievement ids that have been unlocked. Persists across all resets (§10). */
  unlockedAchievements: Record<string, boolean>;

  // Settings (§13).
  notationMode: NotationMode;
  settings: GameSettings;

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
    funnyNumberSightings: {},
    unlockedAchievements: {},
    notationMode: "enjoyer", // Default per §3.2 — keeps 7-digit funny numbers visible.
    settings: createDefaultSettings(),
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
