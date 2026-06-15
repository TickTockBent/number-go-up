// Save / load. Milestone 1 persists to localStorage; the Tauri milestone swaps
// this for a file-backed store + Steam Cloud (§9.2) behind the same interface.

import { createDefaultSettings, createDefaultState, SAVE_VERSION, type GameState } from "../state";

const SAVE_KEY = "number-goes-up:save";

/** Offline accumulation is capped at 8 hours (§4.2 / §9.1). */
export const OFFLINE_CAP_MS = 8 * 60 * 60 * 1000;

interface SaveEnvelope {
  checksum: string;
  data: GameState;
}

/**
 * FNV-1a hash over the gameplay-significant fields only. It's not anti-cheat —
 * it exists solely to power the "Caught Red-Handed" easter egg (§9.3, §15.2).
 * Settings, sightings, achievements, and timestamps are excluded so toggling
 * options never trips it; editing the NUMBER does.
 */
export function computeChecksum(state: GameState): string {
  const significant = JSON.stringify({
    n: state.currentNumber,
    t: state.totalEverEarned,
    r: state.runEarned,
    c: state.totalClicks,
    u: state.upgradeCounts,
    p: state.prestigeLevel,
    a: state.ascensionLevel,
    x: state.transcendenceLevel,
  });
  let hash = 0x811c9dc5;
  for (let charIndex = 0; charIndex < significant.length; charIndex++) {
    hash ^= significant.charCodeAt(charIndex);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16);
}

export function saveState(state: GameState, nowMs: number): void {
  state.lastSavedAtMs = nowMs;
  const envelope: SaveEnvelope = { checksum: computeChecksum(state), data: state };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(envelope));
  } catch (error) {
    console.warn("Could not write save:", error);
  }
}

export interface LoadResult {
  state: GameState;
  /** True when the stored checksum doesn't match the loaded data (§9.3). */
  tampered: boolean;
}

export function loadState(nowMs: number): LoadResult {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return { state: createDefaultState(nowMs), tampered: false };

  try {
    const outer = JSON.parse(raw) as Partial<SaveEnvelope> & Partial<GameState>;
    // Support both the checksummed envelope and legacy flat saves.
    const hasEnvelope = typeof outer.checksum === "string" && outer.data != null;
    const parsed = (hasEnvelope ? outer.data : outer) as Partial<GameState>;

    // Merge onto defaults so older/newer saves missing fields stay valid.
    const merged: GameState = { ...createDefaultState(nowMs), ...parsed };
    merged.saveVersion = SAVE_VERSION;
    merged.upgradeCounts = { ...parsed.upgradeCounts };
    merged.funnyNumberSightings = { ...parsed.funnyNumberSightings };
    merged.unlockedAchievements = { ...parsed.unlockedAchievements };
    // Deep-merge settings so new options pick up defaults on older saves.
    const defaultSettings = createDefaultSettings();
    merged.settings = {
      ...defaultSettings,
      ...parsed.settings,
      volumes: { ...defaultSettings.volumes, ...parsed.settings?.volumes },
    };

    const tampered = hasEnvelope ? computeChecksum(merged) !== outer.checksum : false;
    return { state: merged, tampered };
  } catch (error) {
    console.warn("Save was corrupt, starting fresh:", error);
    return { state: createDefaultState(nowMs), tampered: false };
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
