// Save / load. Milestone 1 persists to localStorage; the Tauri milestone swaps
// this for a file-backed store + Steam Cloud (§9.2) behind the same interface.

import { createDefaultState, SAVE_VERSION, type GameState } from "../state";

const SAVE_KEY = "number-goes-up:save";

/** Offline accumulation is capped at 8 hours (§4.2 / §9.1). */
export const OFFLINE_CAP_MS = 8 * 60 * 60 * 1000;

export function saveState(state: GameState, nowMs: number): void {
  state.lastSavedAtMs = nowMs;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn("Could not write save:", error);
  }
}

export function loadState(nowMs: number): GameState {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return createDefaultState(nowMs);

  try {
    const parsed = JSON.parse(raw) as Partial<GameState>;
    // Merge onto defaults so older/newer saves missing fields stay valid.
    const merged: GameState = { ...createDefaultState(nowMs), ...parsed };
    merged.saveVersion = SAVE_VERSION;
    merged.upgradeCounts = { ...parsed.upgradeCounts };
    return merged;
  } catch (error) {
    console.warn("Save was corrupt, starting fresh:", error);
    return createDefaultState(nowMs);
  }
}

export function clearSave(): void {
  localStorage.removeItem(SAVE_KEY);
}

export interface OfflineProgress {
  elapsedMs: number;
  numberGained: number;
}

/**
 * Computes offline production since the last save, capped at 8 hours.
 * Mutates state to add the gains and returns a summary for the return toast.
 */
export function applyOfflineProgress(
  state: GameState,
  passivePerSecond: number,
  nowMs: number,
): OfflineProgress {
  const rawElapsed = Math.max(0, nowMs - state.lastSavedAtMs);
  const cappedElapsed = Math.min(rawElapsed, OFFLINE_CAP_MS);
  const numberGained = passivePerSecond * (cappedElapsed / 1000);

  if (numberGained > 0) {
    state.currentNumber += numberGained;
    state.totalEverEarned += numberGained;
    state.runEarned += numberGained;
  }
  return { elapsedMs: cappedElapsed, numberGained };
}
