// Funny number detection (GDD §7). The system watches the floored integer's
// digit string and fires a popup when a known pattern appears as a substring.

export interface FunnyNumberDefinition {
  /** Digit substring to match, e.g. "8008135". */
  pattern: string;
  color: string;
  label: string;
  /** Popup font size in px. */
  size: number;
  /** Tie-break priority once pattern length is equal (§7.2). */
  priority: number;
  /** Optional audio stinger id, consumed by the audio engine (§7.4). */
  sound?: string;
}

// Registry from §7.3, highest-impact first. Order here is cosmetic; selection is
// by (length, priority).
export const FUNNY_NUMBERS: FunnyNumberDefinition[] = [
  { pattern: "5318008", color: "#ff69b4", label: "flip your phone", size: 24, priority: 13, sound: "calc" },
  { pattern: "8008135", color: "#ff69b4", label: "BOOBIES", size: 42, priority: 12, sound: "calc" },
  { pattern: "42069", color: "#ff00ff", label: "ASCENDED", size: 44, priority: 12, sound: "chirp" },
  { pattern: "80085", color: "#ff69b4", label: "BOOBS", size: 38, priority: 10, sound: "calc" },
  { pattern: "9001", color: "#ff8800", label: "OVER 9000", size: 34, priority: 9, sound: "scream" },
  { pattern: "1337", color: "#00ffff", label: "LEET", size: 36, priority: 8, sound: "chirp" },
  { pattern: "2319", color: "#cc44ff", label: "WE GOT A 2319", size: 26, priority: 7, sound: "klaxon" },
  { pattern: "666", color: "#ff2222", label: "666", size: 40, priority: 7, sound: "reverse" },
  { pattern: "777", color: "#ffffff", label: "777", size: 40, priority: 7, sound: "chirp" },
  { pattern: "8008", color: "#ff69b4", label: "BOOB", size: 34, priority: 6, sound: "calc" },
  { pattern: "420", color: "#33cc33", label: "420", size: 36, priority: 6, sound: "lofi" },
  { pattern: "1738", color: "#ffdd00", label: "YEAH BABY", size: 32, priority: 6, sound: "chirp" },
  { pattern: "404", color: "#888888", label: "NOT FOUND", size: 32, priority: 5, sound: "chirp" },
  { pattern: "1234", color: "#ffaa00", label: "1234!", size: 32, priority: 4, sound: "chirp" },
  { pattern: "69", color: "#ff66cc", label: "69", size: 34, priority: 3, sound: "nice" },
  { pattern: "67", color: "#44ff88", label: "67", size: 30, priority: 2, sound: "chirp" },
];

export const FUNNY_NUMBER_COOLDOWN_MS = 2500; // §7.2 global cooldown.

/** Does the floored integer of `value` contain `pattern` as a substring? */
export function numberContainsPattern(value: number, pattern: string): boolean {
  if (!Number.isFinite(value)) return false;
  return String(Math.floor(value)).includes(pattern);
}

/**
 * Highest-priority funny number present in `integerString`, or null. Selection
 * is by pattern length first, then assigned priority (§7.2).
 */
export function detectFunnyNumber(integerString: string): FunnyNumberDefinition | null {
  let best: FunnyNumberDefinition | null = null;
  for (const candidate of FUNNY_NUMBERS) {
    if (!integerString.includes(candidate.pattern)) continue;
    if (
      best === null ||
      candidate.pattern.length > best.pattern.length ||
      (candidate.pattern.length === best.pattern.length && candidate.priority > best.priority)
    ) {
      best = candidate;
    }
  }
  return best;
}

/**
 * Stateful detector that enforces the 2.5s global cooldown. Call `poll` each
 * frame with the current number; it returns a definition to fire, or null.
 */
export class FunnyNumberDetector {
  private lastFireMs = -Infinity;

  poll(currentNumber: number, nowMs: number): FunnyNumberDefinition | null {
    if (nowMs - this.lastFireMs < FUNNY_NUMBER_COOLDOWN_MS) return null;
    const match = detectFunnyNumber(String(Math.floor(currentNumber)));
    if (!match) return null;
    this.lastFireMs = nowMs;
    return match;
  }
}
