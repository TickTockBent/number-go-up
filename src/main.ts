// Entry point: loads the save, applies offline progress, runs the fixed-step
// game loop, and wires player input to the UI.

import "./styles.css";
import { buyUpgrade, performClick } from "./game";
import {
  type AchievementContext,
  type AchievementDefinition,
  evaluateAchievements,
  unlockAchievement,
} from "./systems/achievements";
import { AudioEngine } from "./systems/audio";
import { clickPower, passivePerSecond, speedPenaltyFraction } from "./systems/economy";
import { FunnyNumberDetector } from "./systems/funnyNumbers";
import { doAscend, doPrestige, doTranscend } from "./systems/prestige";
import { ownedCount } from "./state";
import { UPGRADES_BY_ID } from "./data/upgrades";
import { formatCompact, type NotationMode } from "./systems/notation";
import {
  applyOfflineProgress,
  clearSave,
  loadState,
  OFFLINE_CAP_MS,
  saveState,
} from "./systems/save";
import { addToNumber, createDefaultState, type GameState } from "./state";
import { GameUi } from "./ui";

const LOGIC_TICK_MS = 50; // 20fps internal tick (§4.2).
const AUTOSAVE_INTERVAL_MS = 5_000;

const appRoot = document.getElementById("app");
if (!appRoot) throw new Error("Missing #app root element.");

let state: GameState = loadState(Date.now());

// --- Achievement context tracking ---
let runStartMs = performance.now(); // Reset on every prestige-layer reset.
let focusedIdleMs = 0; // Time since last click, accrued only while focused.
let returnedFromMaxOffline = false;

// --- Audio (resumed on first gesture per browser autoplay policy) ---
const audio = new AudioEngine();
let autoClickTimer: number | null = null;

function announceAchievement(achievement: AchievementDefinition | null): void {
  if (!achievement) return;
  ui.showToast(`🏆 ${achievement.name} — ${achievement.description}`);
  ui.announce(`Achievement unlocked: ${achievement.name}`);
}

/** Reapplies side-effectful settings (audio, auto-click) and persists. */
function applySettings(): void {
  audio.setVolumes(state.settings.volumes);
  syncAutoClick();
  saveState(state, Date.now());
}

function syncAutoClick(): void {
  const shouldRun = state.settings.autoClick;
  if (shouldRun && autoClickTimer === null) {
    autoClickTimer = window.setInterval(() => {
      performClick(state); // Counts toward click achievements (§13.3).
      audio.playClick();
      focusedIdleMs = 0;
    }, 1000);
  } else if (!shouldRun && autoClickTimer !== null) {
    window.clearInterval(autoClickTimer);
    autoClickTimer = null;
  }
}

const ui = new GameUi(appRoot, {
  onClickNumber: (clientX, clientY) => {
    const power = clickPower(state);
    performClick(state);
    focusedIdleMs = 0; // A click breaks the idle streak.
    ui.spawnClickParticle(clientX, clientY, power, state.notationMode);
    ui.applyClickShake(power, state.settings.screenShake);
    audio.playClick();
  },
  onBuyUpgrade: (upgradeId) => {
    const result = buyUpgrade(state, upgradeId);
    if (!result.success) return;
    if (result.message) ui.showToast(result.message);
    const special = UPGRADES_BY_ID[upgradeId]?.special;
    audio.playBuy(special === "slow" || special === "mystery" || special === "red" ? special : "normal");
  },
  onChangeNotation: (mode: NotationMode) => {
    state.notationMode = mode;
    if (mode === "nerd") announceAchievement(unlockAchievement(state, "notation_nerd"));
    if (mode === "unhinged") announceAchievement(unlockAchievement(state, "unhinged_mode"));
  },
  onResetSave: () => {
    clearSave();
    state = createDefaultState(Date.now());
    runStartMs = performance.now();
    ui.showToast("The number is zero again. It has forgotten you.");
  },
  onPrestige: () => {
    const runElapsedMs = performance.now() - runStartMs;
    const quote = doPrestige(state);
    if (!quote) return;
    runStartMs = performance.now();
    if (runElapsedMs < 60_000) announceAchievement(unlockAchievement(state, "prestige_within_60_seconds"));
    audio.playPrestige();
    audio.prestigeMusicCut();
    ui.showOverlay(quote);
    ui.announce("Prestige. The number resets. The percentage remains.");
  },
  onAscend: () => {
    const quote = doAscend(state);
    if (!quote) return;
    runStartMs = performance.now();
    audio.playAscension();
    audio.prestigeMusicCut();
    ui.showOverlay(quote);
    ui.announce("Ascension. Everything below resets.");
  },
  onTranscend: () => {
    const quote = doTranscend(state);
    if (!quote) return;
    runStartMs = performance.now();
    audio.playTranscendence();
    audio.prestigeMusicCut();
    ui.showOverlay(quote);
    ui.announce("Transcendence. Everything resets. The hue remembers.");
  },
  onOpenCards: () => {
    announceAchievement(unlockAchievement(state, "card_collector"));
  },
  onSettingsChanged: () => {
    applySettings();
  },
});

// Resume audio on the first user gesture (autoplay policy); apply saved settings.
window.addEventListener("pointerdown", () => audio.resume(), { once: true });
window.addEventListener("keydown", () => audio.resume(), { once: true });
audio.setVolumes(state.settings.volumes);
syncAutoClick();

// Offline progress on load (§9.1), unless disabled in settings (§13.1).
if (state.settings.offlineProgress) {
  const offline = applyOfflineProgress(state, passivePerSecond(state), Date.now());
  if (offline.numberGained >= 1) {
    ui.showToast(
      `While you were gone, the number went up by ${formatCompact(offline.numberGained)}. It didn't miss you.`,
    );
    audio.playOfflinePing();
  }
  // Returning from the full 8h cap arms the "Alt-Tabbed" achievement (§10.5).
  if (offline.elapsedMs >= OFFLINE_CAP_MS) returnedFromMaxOffline = true;
}

// --- Fixed-step loop ------------------------------------------------------
const funnyNumberDetector = new FunnyNumberDetector();
let accumulatedMs = 0;
let lastFrameMs = performance.now();
let msSinceAutosave = 0;

function frame(nowMs: number): void {
  const deltaMs = Math.min(nowMs - lastFrameMs, 1000); // Clamp huge gaps (tab was hidden).
  lastFrameMs = nowMs;
  accumulatedMs += deltaMs;
  msSinceAutosave += deltaMs;

  while (accumulatedMs >= LOGIC_TICK_MS) {
    stepLogic(LOGIC_TICK_MS / 1000);
    accumulatedMs -= LOGIC_TICK_MS;
  }

  if (state.settings.funnyPopups) {
    const funnyNumber = funnyNumberDetector.poll(state.currentNumber, nowMs);
    if (funnyNumber) {
      state.funnyNumberSightings[funnyNumber.pattern] =
        (state.funnyNumberSightings[funnyNumber.pattern] ?? 0) + 1;
      ui.spawnFunnyPopup(funnyNumber, state.notationMode);
      audio.playStinger(funnyNumber.sound);
      ui.announce(`Funny number: ${funnyNumber.label}`);
    }
  }

  // Adaptive music follows the production rate and corruption state (§12.1).
  audio.updateMusic(passivePerSecond(state), speedPenaltyFraction(state), ownedCount(state, "red"));

  // Idle achievements only accrue while the window is actually focused (§10.5).
  if (document.visibilityState === "visible" && document.hasFocus()) {
    focusedIdleMs += deltaMs;
  }

  const achievementContext: AchievementContext = {
    speedPenalty: speedPenaltyFraction(state),
    focusedIdleMs,
    statsTabIdleMs: ui.getStatsTabIdleMs(),
    runElapsedMs: nowMs - runStartMs,
    returnedFromMaxOffline,
  };
  for (const unlocked of evaluateAchievements(state, achievementContext)) {
    announceAchievement(unlocked);
  }

  if (msSinceAutosave >= AUTOSAVE_INTERVAL_MS) {
    saveState(state, Date.now());
    msSinceAutosave = 0;
  }

  ui.update(state);
  requestAnimationFrame(frame);
}

function stepLogic(deltaSeconds: number): void {
  const production = passivePerSecond(state) * deltaSeconds;
  addToNumber(state, production);
}

requestAnimationFrame(frame);

// Save on the way out so offline progress is accurate (§9.1).
window.addEventListener("beforeunload", () => saveState(state, Date.now()));
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") saveState(state, Date.now());
});
