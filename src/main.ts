// Entry point: loads the save, applies offline progress, runs the fixed-step
// game loop, and wires player input to the UI.

import "./styles.css";
import { buyUpgrade, performClick } from "./game";
import { clickPower, passivePerSecond } from "./systems/economy";
import { FunnyNumberDetector } from "./systems/funnyNumbers";
import { doAscend, doPrestige, doTranscend } from "./systems/prestige";
import { formatCompact, type NotationMode } from "./systems/notation";
import {
  applyOfflineProgress,
  clearSave,
  loadState,
  saveState,
} from "./systems/save";
import { addToNumber, createDefaultState, type GameState } from "./state";
import { GameUi } from "./ui";

const LOGIC_TICK_MS = 50; // 20fps internal tick (§4.2).
const AUTOSAVE_INTERVAL_MS = 5_000;

const appRoot = document.getElementById("app");
if (!appRoot) throw new Error("Missing #app root element.");

let state: GameState = loadState(Date.now());

const ui = new GameUi(appRoot, {
  onClickNumber: (clientX, clientY) => {
    const power = clickPower(state);
    performClick(state);
    ui.spawnClickParticle(clientX, clientY, power, state.notationMode);
    ui.applyClickShake(power);
  },
  onBuyUpgrade: (upgradeId) => {
    const result = buyUpgrade(state, upgradeId);
    if (result.success && result.message) ui.showToast(result.message);
  },
  onChangeNotation: (mode: NotationMode) => {
    state.notationMode = mode;
  },
  onResetSave: () => {
    clearSave();
    state = createDefaultState(Date.now());
    ui.showToast("The number is zero again. It has forgotten you.");
  },
  onPrestige: () => {
    const quote = doPrestige(state);
    if (quote) ui.showOverlay(quote);
  },
  onAscend: () => {
    const quote = doAscend(state);
    if (quote) ui.showOverlay(quote);
  },
  onTranscend: () => {
    const quote = doTranscend(state);
    if (quote) ui.showOverlay(quote);
  },
});

// Offline progress on load (§9.1). Only show the toast if meaningful time passed.
const offline = applyOfflineProgress(state, passivePerSecond(state), Date.now());
if (offline.numberGained >= 1) {
  ui.showToast(
    `While you were gone, the number went up by ${formatCompact(offline.numberGained)}. It didn't miss you.`,
  );
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

  const funnyNumber = funnyNumberDetector.poll(state.currentNumber, nowMs);
  if (funnyNumber) {
    state.funnyNumberSightings[funnyNumber.pattern] =
      (state.funnyNumberSightings[funnyNumber.pattern] ?? 0) + 1;
    ui.spawnFunnyPopup(funnyNumber, state.notationMode);
    // Audio stinger (§7.4) is wired in the audio milestone.
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
