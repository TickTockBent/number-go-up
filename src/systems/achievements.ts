// Achievements (GDD §10). The §10 tables specify 60; the GDD insists on a
// canonical 67 ("chosen on purpose" — the 6-7 meme). The 7-achievement gap is
// filled with well-motivated additions, tagged `designerAdded` below so they're
// easy to find and rewrite: 2 progression milestones plus 5 upgrades that the
// GDD shipped without their own achievement (green/faster/void/recursive/god).

import { UPGRADE_DEFINITIONS } from "../data/upgrades";
import { numberContainsPattern } from "./funnyNumbers";
import { ownedCount, type GameState } from "../state";

export type AchievementCategory = "progression" | "funny" | "trap" | "prestige" | "meta";

export interface AchievementContext {
  /** Slow-only penalty fraction, for the SLOWER BUTTON tier achievements. */
  speedPenalty: number;
  /** ms since the last click, accumulated only while the window is focused. */
  focusedIdleMs: number;
  /** ms the Stats tab has been open with no input. */
  statsTabIdleMs: number;
  /** ms since the current run (since last reset / load) began. */
  runElapsedMs: number;
  /** Set true once the player returns from a full 8h offline accumulation. */
  returnedFromMaxOffline: boolean;
}

export interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
  hidden: boolean;
  category: AchievementCategory;
  /** Per-tick predicate. Omitted for event-driven achievements (unlocked imperatively). */
  check?: (state: GameState, context: AchievementContext) => boolean;
  /** Not part of the canonical 67 (pure easter egg). */
  bonus?: boolean;
  /** Filled a gap the GDD left; flagged for easy review. */
  designerAdded?: boolean;
}

const reach = (threshold: number) => (state: GameState) => state.totalEverEarned >= threshold;
const contains = (pattern: string) => (state: GameState) => numberContainsPattern(state.currentNumber, pattern);
const owns = (upgradeId: string, count: number) => (state: GameState) => ownedCount(state, upgradeId) >= count;

export const ACHIEVEMENTS: AchievementDefinition[] = [
  // --- §10.1 Progression (+ 2 designer-added milestones) ---
  { id: "the_first_number", name: "The First Number", description: "The number went up.", hidden: false, category: "progression", check: reach(1) },
  { id: "two_figures", name: "Two Figures", description: "The number has a friend now.", hidden: false, category: "progression", check: reach(10), designerAdded: true },
  { id: "three_digits", name: "Three Digits", description: "The number has opinions now.", hidden: false, category: "progression", check: reach(100) },
  { id: "kilo", name: "Kilo", description: "One thousand numbers, standing on each other's shoulders.", hidden: false, category: "progression", check: reach(1_000) },
  { id: "the_k_word", name: "The K Word", description: "\"K\" appeared after your number. You've made it.", hidden: false, category: "progression", check: reach(10_000) },
  { id: "six_figures", name: "Six Figures", description: "Your number makes more than most people.", hidden: false, category: "progression", check: reach(100_000) },
  { id: "millionaire", name: "Millionaire", description: "The number is a millionaire. It will not share.", hidden: false, category: "progression", check: reach(1_000_000) },
  { id: "eight_digits", name: "8 Digits", description: "Welcome to \"Number Enjoyer\" territory. All the jokes live here.", hidden: false, category: "progression", check: reach(10_000_000) },
  { id: "billionaire", name: "Billionaire", description: "The number could buy Twitter. It chooses not to.", hidden: false, category: "progression", check: reach(1_000_000_000) },
  { id: "trillionaire", name: "Trillionaire", description: "Congress would like a word.", hidden: false, category: "progression", check: reach(1_000_000_000_000) },
  { id: "quadrillionaire", name: "Quadrillionaire", description: "Past trillions. The commas have given up.", hidden: false, category: "progression", check: reach(1e15), designerAdded: true },

  // --- §10.2 Funny Numbers (all hidden) ---
  { id: "nice", name: "Nice", description: "The number hit 69. Nice.", hidden: true, category: "funny", check: contains("69") },
  { id: "if_you_know", name: "If You Know", description: "67.", hidden: true, category: "funny", check: contains("67") },
  { id: "blaze_it", name: "Blaze It", description: "The number is enlightened.", hidden: true, category: "funny", check: contains("420") },
  { id: "calculator_humor", name: "Calculator Humor", description: "The number said boobs.", hidden: true, category: "funny", check: contains("80085") },
  { id: "advanced_calculator_humor", name: "Advanced Calculator Humor", description: "The number said boobies.", hidden: true, category: "funny", check: contains("8008135") },
  { id: "flip_your_phone", name: "Flip Your Phone", description: "₈₀₀₈₅₁₃€", hidden: true, category: "funny", check: contains("5318008") },
  { id: "number_of_the_beast", name: "Number of the Beast", description: "The number went to a dark place.", hidden: true, category: "funny", check: contains("666") },
  { id: "jackpot", name: "Jackpot", description: "777. The number got lucky.", hidden: true, category: "funny", check: contains("777") },
  { id: "what_does_the_scouter_say", name: "What Does the Scouter Say", description: "IT'S OVER 9000", hidden: true, category: "funny", check: contains("9001") },
  { id: "leet", name: "Leet", description: "1337 h4x0r", hidden: true, category: "funny", check: contains("1337") },
  { id: "the_answer", name: "The Answer", description: "42. But what's the question?", hidden: true, category: "funny", check: contains("42") },
  { id: "we_got_a_2319", name: "WE GOT A 2319", description: "Put it back where it came from or so help me.", hidden: true, category: "funny", check: contains("2319") },
  { id: "the_fusion", name: "The Fusion", description: "42069. Two memes fused into one. The number has peaked.", hidden: true, category: "funny", check: contains("42069") },
  { id: "yeah_baby", name: "Yeah Baby", description: "1738. That's all we can legally say.", hidden: true, category: "funny", check: contains("1738") },
  { id: "not_found", name: "Not Found", description: "404. The number went looking for itself and couldn't find it.", hidden: true, category: "funny", check: contains("404") },

  // --- §10.3 Trap Upgrades (+ 5 designer-added upgrade achievements) ---
  { id: "its_red", name: "It's Red", description: "Bought the red button. It does nothing.", hidden: false, category: "trap", check: owns("red", 1) },
  { id: "red_collection", name: "Red Collection", description: "You own 5 red buttons. They do 5 nothings.", hidden: false, category: "trap", check: owns("red", 5) },
  { id: "red_enthusiast", name: "Red Enthusiast", description: "10 red buttons. Your number is red now.", hidden: false, category: "trap", check: owns("red", 10) },
  { id: "red_identity", name: "Red Identity", description: "25 red buttons. You don't remember what green looked like.", hidden: true, category: "trap", check: owns("red", 25) },
  { id: "all_red_everything", name: "All Red Everything", description: "50 red buttons. There is only red.", hidden: true, category: "trap", check: owns("red", 50) },
  { id: "self_sabotage", name: "Self-Sabotage", description: "Bought the slower button. On purpose. With your own numbers.", hidden: false, category: "trap", check: owns("slow", 1) },
  { id: "terminal_velocity_reverse", name: "Terminal Velocity (Reverse)", description: "Reached 50% speed penalty. The number respects your commitment to suffering.", hidden: true, category: "trap", check: (_s, c) => c.speedPenalty >= 0.5 },
  { id: "asymptotic_agony", name: "Asymptotic Agony", description: "Reached 90% speed penalty. The number is technically still moving.", hidden: true, category: "trap", check: (_s, c) => c.speedPenalty >= 0.9 },
  { id: "zenos_paradox", name: "Zeno's Paradox", description: "Reached 99% speed penalty. The number will never reach its destination.", hidden: true, category: "trap", check: (_s, c) => c.speedPenalty >= 0.99 },
  { id: "mystery_q", name: "???", description: "???", hidden: false, category: "trap", check: owns("mystery", 1) },
  { id: "mystery_q7", name: "???????", description: "???????", hidden: true, category: "trap", check: owns("mystery", 7) },
  { id: "the_secret_no_one_knows", name: "The Secret No One Knows", description: "You'll never see this description because you'll never earn this achievement.", hidden: true, category: "trap", check: owns("mystery", 49) },
  { id: "green_thumb", name: "Green Thumb", description: "Bought the green button. The one button that helps. You found it.", hidden: false, category: "trap", check: owns("green", 1), designerAdded: true },
  { id: "speed_demon", name: "Speed Demon", description: "Bought the faster button. Undoing the slow you paid for, at a markup.", hidden: false, category: "trap", check: owns("anti_slow", 1), designerAdded: true },
  { id: "the_void_stares_back", name: "The Void Stares Back", description: "Fed half your number to nothing. Nothing said thanks.", hidden: true, category: "trap", check: owns("void", 1), designerAdded: true },
  { id: "recursion", name: "Recursion", description: "The game plays itself now. You're still here. Why.", hidden: true, category: "trap", check: owns("recursive", 1), designerAdded: true },
  { id: "click_of_god", name: "Click of God", description: "Each click is now a full second of production. You will still click manually. We know you.", hidden: true, category: "trap", check: owns("click_3", 1), designerAdded: true },

  // --- §10.4 Prestige ---
  { id: "samsara", name: "Samsara", description: "The cycle begins.", hidden: false, category: "prestige", check: (s) => s.prestigeLevel >= 1 },
  { id: "prestige_5", name: "Prestige 5", description: "Five times the number has died and been reborn.", hidden: false, category: "prestige", check: (s) => s.prestigeLevel >= 5 },
  { id: "double_digits", name: "Double Digits", description: "10 prestige levels. The percentage grows.", hidden: false, category: "prestige", check: (s) => s.prestigeLevel >= 10 },
  { id: "the_meta_reset", name: "The Meta-Reset", description: "Ascended for the first time. Your prestiges are gone.", hidden: false, category: "prestige", check: (s) => s.ascensionLevel >= 1 },
  { id: "ascension_5", name: "Ascension 5", description: "The number has forgotten what ground level looks like.", hidden: false, category: "prestige", check: (s) => s.ascensionLevel >= 5 },
  { id: "beyond_beyond", name: "Beyond Beyond", description: "Transcended for the first time. Why.", hidden: true, category: "prestige", check: (s) => s.transcendenceLevel >= 1 },
  { id: "full_spectrum", name: "Full Spectrum", description: "Transcended 12 times. The hue rotated all the way around. You're back to green.", hidden: true, category: "prestige", check: (s) => s.transcendenceLevel >= 12 },
  // Event-driven (unlocked at prestige time with the run timer):
  { id: "prestige_within_60_seconds", name: "Prestige Within 60 Seconds", description: "Reached the prestige threshold in under 60 seconds.", hidden: true, category: "prestige" },

  // --- §10.5 Meta / Behavioral ---
  { id: "first_click", name: "First Click", description: "You clicked the number. This is the whole game.", hidden: false, category: "meta", check: (s) => s.totalClicks >= 1 },
  { id: "thousand_clicks", name: "Thousand Clicks", description: "Your finger is tired. The number is not.", hidden: false, category: "meta", check: (s) => s.totalClicks >= 1_000 },
  { id: "ten_thousand_clicks", name: "Ten Thousand Clicks", description: "Have you considered an auto-clicker? We won't judge.", hidden: true, category: "meta", check: (s) => s.totalClicks >= 10_000 },
  { id: "idle_hands", name: "Idle Hands", description: "Let the game run for 10 minutes without clicking.", hidden: true, category: "meta", check: (_s, c) => c.focusedIdleMs >= 600_000 },
  { id: "idle_master", name: "Idle Master", description: "Let the game run for 1 hour without clicking.", hidden: true, category: "meta", check: (_s, c) => c.focusedIdleMs >= 3_600_000 },
  { id: "alt_tabbed", name: "Alt-Tabbed", description: "The game was in the background for 8 hours (the offline cap).", hidden: true, category: "meta", check: (_s, c) => c.returnedFromMaxOffline },
  { id: "the_long_stare", name: "The Long Stare", description: "Stared at the stats page for 2 minutes straight.", hidden: true, category: "meta", check: (_s, c) => c.statsTabIdleMs >= 120_000 },
  { id: "two_buttons", name: "Two Buttons", description: "Bought both the slower button and the faster button. The net effect is almost nothing.", hidden: true, category: "meta", check: (s) => ownedCount(s, "slow") >= 1 && ownedCount(s, "anti_slow") >= 1 },
  { id: "speedrun", name: "Speedrun", description: "Reached 1 million in under 5 minutes.", hidden: true, category: "meta", check: (s, c) => s.runEarned >= 1_000_000 && c.runElapsedMs < 300_000 },
  { id: "the_full_experience", name: "The Full Experience", description: "Bought every unique upgrade type at least once.", hidden: true, category: "meta", check: (s) => UPGRADE_DEFINITIONS.every((d) => ownedCount(s, d.id) >= 1) },
  // Event-driven (unlocked by their systems):
  { id: "card_collector", name: "Card Collector", description: "Viewed the trading cards tab. You can't actually collect them here.", hidden: false, category: "meta" },
  { id: "notation_nerd", name: "Notation Nerd", description: "Switched to Scientific notation. The number is now less fun.", hidden: true, category: "meta" },
  { id: "unhinged_mode", name: "Unhinged Mode", description: "Enabled \"Unhinged\" notation. The number will consume your screen.", hidden: true, category: "meta" },
  { id: "heavy_wallet", name: "Heavy Wallet", description: "Purchased the Heavy Wallet DLC. All numbers are now 0.001% worse. Forever.", hidden: false, category: "meta" },
  { id: "caught_red_handed", name: "Caught Red-Handed", description: "Nice try.", hidden: true, category: "meta" },
  // The capstone — unlocked when all other canonical achievements are done.
  { id: "sixty_seven_achievements", name: "67 Achievements", description: "You've unlocked all 67 achievements. That number was chosen on purpose.", hidden: true, category: "meta" },

  // --- Bonus easter egg (not part of the 67) (§15.2) ---
  { id: "you_win", name: "You Win?", description: "You set the number to infinity. Is this winning? The number can't go up from here.", hidden: true, category: "meta", bonus: true, check: (s) => !Number.isFinite(s.currentNumber) },
];

export const ACHIEVEMENTS_BY_ID: Record<string, AchievementDefinition> = Object.fromEntries(
  ACHIEVEMENTS.map((a) => [a.id, a]),
);

/** Canonical achievements counting toward the "67" (everything except bonuses). */
export const CANONICAL_ACHIEVEMENTS = ACHIEVEMENTS.filter((a) => !a.bonus);
export const CANONICAL_ACHIEVEMENT_COUNT = CANONICAL_ACHIEVEMENTS.length; // === 67

export function isAchievementUnlocked(state: GameState, id: string): boolean {
  return state.unlockedAchievements[id] === true;
}

export function unlockedCount(state: GameState): number {
  return CANONICAL_ACHIEVEMENTS.filter((a) => isAchievementUnlocked(state, a.id)).length;
}

/**
 * Unlocks an achievement if not already unlocked. Returns the definition when a
 * NEW unlock happened (so callers can toast it), else null.
 */
export function unlockAchievement(state: GameState, id: string): AchievementDefinition | null {
  if (isAchievementUnlocked(state, id)) return null;
  const definition = ACHIEVEMENTS_BY_ID[id];
  if (!definition) return null;
  state.unlockedAchievements[id] = true;
  return definition;
}

/**
 * Evaluates all per-tick achievement predicates plus the "all 67" capstone.
 * Returns the list of achievements newly unlocked this tick.
 */
export function evaluateAchievements(state: GameState, context: AchievementContext): AchievementDefinition[] {
  const newlyUnlocked: AchievementDefinition[] = [];

  for (const definition of ACHIEVEMENTS) {
    if (!definition.check || isAchievementUnlocked(state, definition.id)) continue;
    if (definition.check(state, context)) {
      state.unlockedAchievements[definition.id] = true;
      newlyUnlocked.push(definition);
    }
  }

  // Capstone: all canonical achievements except the capstone itself.
  if (!isAchievementUnlocked(state, "sixty_seven_achievements")) {
    const everythingElse = CANONICAL_ACHIEVEMENTS.every(
      (a) => a.id === "sixty_seven_achievements" || isAchievementUnlocked(state, a.id),
    );
    if (everythingElse) {
      state.unlockedAchievements.sixty_seven_achievements = true;
      newlyUnlocked.push(ACHIEVEMENTS_BY_ID.sixty_seven_achievements);
    }
  }

  return newlyUnlocked;
}
