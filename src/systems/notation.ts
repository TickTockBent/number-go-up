// Number notation modes (GDD §3.2). The chosen mode determines which "funny
// numbers" stay visible, so this is gameplay-relevant, not cosmetic.

export type NotationMode = "normal" | "enjoyer" | "unhinged" | "nerd";

export const NOTATION_LABELS: Record<NotationMode, string> = {
  normal: "Normal Person",
  enjoyer: "Number Enjoyer",
  unhinged: "Unhinged",
  nerd: "Nerd",
};

// Abbreviation suffixes, each step is ×1000. Beyond this list we fall back to
// scientific notation so the display never silently breaks.
const ABBREVIATION_SUFFIXES = [
  "", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc",
];

function withCommas(integerValue: number): string {
  return Math.floor(integerValue).toLocaleString("en-US");
}

function abbreviate(value: number, decimals = 2): string {
  if (value < 1000) return String(Math.floor(value));
  const magnitudeTier = Math.floor(Math.log10(value) / 3);
  if (magnitudeTier >= ABBREVIATION_SUFFIXES.length) {
    return scientific(value);
  }
  const scaledValue = value / Math.pow(1000, magnitudeTier);
  return `${scaledValue.toFixed(decimals)}${ABBREVIATION_SUFFIXES[magnitudeTier]}`;
}

function scientific(value: number): string {
  if (value < 10_000) return String(Math.floor(value));
  return value.toExponential(2).replace("e+", "e");
}

/**
 * Formats the main number for display according to the active notation mode.
 * `value` is the raw number; callers pass the floored integer for funny-number
 * fidelity, but this function floors defensively too.
 */
export function formatNumber(value: number, mode: NotationMode): string {
  if (!Number.isFinite(value)) return "Infinity";
  const safeValue = Math.max(0, Math.floor(value));

  switch (mode) {
    case "normal":
      // Abbreviated past 5 digits (§3.2 switches at 10,000).
      return safeValue < 10_000 ? withCommas(safeValue) : abbreviate(safeValue);
    case "enjoyer":
      // Full digits with commas up to 9,999,999, then abbreviate (switches at 8 digits).
      return safeValue < 10_000_000 ? withCommas(safeValue) : abbreviate(safeValue);
    case "unhinged":
      // Full digits, always, no commas. The font shrinks elsewhere; here we just
      // hand back every digit. You asked for this.
      return String(safeValue);
    case "nerd":
      return scientific(safeValue);
  }
}

/** Smaller readouts (per-second rate, costs) — always abbreviated for sanity. */
export function formatCompact(value: number): string {
  if (!Number.isFinite(value)) return "Infinity";
  if (value < 1000) {
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
  }
  return abbreviate(value);
}
