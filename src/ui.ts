// DOM construction and per-frame updates. Vanilla TS, no framework — the UI is
// "two numbers and some buttons" (GDD §14), so the runtime stays tiny.

import { TRADING_CARDS } from "./data/cards";
import { UPGRADE_DEFINITIONS, type UpgradeDefinition } from "./data/upgrades";
import {
  ACHIEVEMENTS,
  CANONICAL_ACHIEVEMENT_COUNT,
  isAchievementUnlocked,
  unlockedCount,
} from "./systems/achievements";
import {
  canAfford,
  clickPower,
  isUnlocked,
  nextCostFor,
  passivePerSecond,
} from "./systems/economy";
import { FUNNY_NUMBERS, type FunnyNumberDefinition } from "./systems/funnyNumbers";
import type { ScreenShakeMode } from "./state";
import { formatCompact, formatNumber, NOTATION_LABELS, type NotationMode } from "./systems/notation";
import {
  ASCENSION_PRESTIGE_THRESHOLD,
  canAscend,
  canPrestige,
  canTranscend,
  PRESTIGE_RUN_EARNED_THRESHOLD,
  prestigeUnlocked,
  ascensionUnlocked,
  transcendenceUnlocked,
  TRANSCENDENCE_ASCENSION_THRESHOLD,
  transcendenceHueDegrees,
} from "./systems/prestige";
import { ownedCount, type GameState } from "./state";

type TabId = "upgrades" | "prestige" | "achievements" | "stats" | "cards" | "settings";

export interface UiCallbacks {
  onClickNumber: (clientX: number, clientY: number) => void;
  onBuyUpgrade: (upgradeId: string) => void;
  onChangeNotation: (mode: NotationMode) => void;
  onResetSave: () => void;
  onPrestige: () => void;
  onAscend: () => void;
  onTranscend: () => void;
  onOpenCards: () => void;
  /** A setting changed; the host reapplies audio volumes, auto-click, and persists. */
  onSettingsChanged: () => void;
}

// Screen-shake thresholds keyed off click power (§4.1).
const SHAKE_SUBTLE_THRESHOLD = 10_000;
const SHAKE_VIOLENT_THRESHOLD = 1_000_000;

export class GameUi {
  private readonly root: HTMLElement;
  private readonly callbacks: UiCallbacks;

  private numberDisplay!: HTMLElement;
  private rateDisplay!: HTMLElement;
  private particleLayer!: HTMLElement;
  private toastLayer!: HTMLElement;
  private tabPanels!: Record<TabId, HTMLElement>;
  private tabButtons!: Record<TabId, HTMLButtonElement>;
  private statValues!: Record<string, HTMLElement>;
  private notationSelect!: HTMLSelectElement;
  private prestigeLayerRows!: Record<PrestigeLayerId, PrestigeLayerRow>;
  private overlayLayer!: HTMLElement;
  private achievementCountEl!: HTMLElement;
  private achievementRows!: Map<string, AchievementRow>;
  private sightingsListEl!: HTMLElement;
  private settingRefreshers: Array<() => void> = [];
  private colorHueRow!: { row: HTMLElement; input: HTMLInputElement };
  private walletIcon!: HTMLElement;
  /** While now < this timestamp, the number reads "CHEATER" (§9.3). */
  private cheaterUntilMs = 0;

  /** Per-upgrade row element refs, built lazily as upgrades unlock. */
  private upgradeRows = new Map<string, UpgradeRow>();
  private upgradeListEl!: HTMLElement;

  private activeTab: TabId = "upgrades";

  // "The Long Stare" tracking: ms the Stats tab has been open with no input.
  private statsTabIdleMs = 0;
  private lastClockMs = performance.now();

  /** Live state reference, refreshed every frame; settings controls read/write it. */
  private currentState!: GameState;
  private ariaLiveRegion!: HTMLElement;

  constructor(root: HTMLElement, callbacks: UiCallbacks) {
    this.root = root;
    this.callbacks = callbacks;
    this.build();
    // Any input anywhere resets the stats-stare timer.
    const resetStare = () => { this.statsTabIdleMs = 0; };
    this.root.addEventListener("pointerdown", resetStare, true);
    window.addEventListener("keydown", resetStare, true);
  }

  getStatsTabIdleMs(): number {
    return this.statsTabIdleMs;
  }

  private build(): void {
    this.root.innerHTML = "";
    this.root.classList.add("ngu");

    // --- Number stage ---
    const stage = el("div", "stage");
    const numberRow = el("div", "number-row");
    this.walletIcon = el("div", "wallet-icon");
    this.walletIcon.textContent = "💰";
    this.walletIcon.title = "$4.99";
    this.walletIcon.style.display = "none";
    this.numberDisplay = el("button", "number-display");
    this.numberDisplay.setAttribute("aria-label", "The number. Click it.");
    this.numberDisplay.addEventListener("pointerdown", (event) => {
      this.callbacks.onClickNumber(event.clientX, event.clientY);
    });
    numberRow.append(this.walletIcon, this.numberDisplay);
    this.rateDisplay = el("div", "rate-display");
    stage.append(numberRow, this.rateDisplay);

    this.particleLayer = el("div", "particle-layer");
    this.toastLayer = el("div", "toast-layer");

    // --- Tabs ---
    const tabBar = el("nav", "tab-bar");
    this.tabButtons = {} as Record<TabId, HTMLButtonElement>;
    this.tabPanels = {} as Record<TabId, HTMLElement>;

    const tabDefs: Array<{ id: TabId; label: string }> = [
      { id: "upgrades", label: "Upgrades" },
      { id: "prestige", label: "Prestige" },
      { id: "achievements", label: "Achievements" },
      { id: "stats", label: "Stats" },
      { id: "cards", label: "Cards" },
      { id: "settings", label: "Settings" },
    ];
    for (const tab of tabDefs) {
      const button = el("button", "tab-button") as HTMLButtonElement;
      button.textContent = tab.label;
      button.addEventListener("click", () => this.setActiveTab(tab.id));
      this.tabButtons[tab.id] = button;
      tabBar.append(button);
    }

    this.tabPanels.upgrades = this.buildUpgradesPanel();
    this.tabPanels.prestige = this.buildPrestigePanel();
    this.tabPanels.achievements = this.buildAchievementsPanel();
    this.tabPanels.stats = this.buildStatsPanel();
    this.tabPanels.cards = this.buildCardsPanel();
    this.tabPanels.settings = this.buildSettingsPanel();

    const panelHost = el("div", "panel-host");
    panelHost.append(
      this.tabPanels.upgrades,
      this.tabPanels.prestige,
      this.tabPanels.achievements,
      this.tabPanels.stats,
      this.tabPanels.cards,
      this.tabPanels.settings,
    );

    this.overlayLayer = el("div", "overlay-layer");
    this.overlayLayer.style.display = "none";

    // Screen-reader announcements live region (§13.3).
    this.ariaLiveRegion = el("div", "sr-only");
    this.ariaLiveRegion.setAttribute("aria-live", "polite");
    this.ariaLiveRegion.setAttribute("role", "status");

    injectColorblindFilters();

    this.root.append(
      stage,
      this.particleLayer,
      tabBar,
      panelHost,
      this.toastLayer,
      this.overlayLayer,
      this.ariaLiveRegion,
    );
    this.setActiveTab(this.activeTab);
  }

  private buildUpgradesPanel(): HTMLElement {
    const panel = el("section", "panel");
    this.upgradeListEl = el("div", "upgrade-list");
    panel.append(this.upgradeListEl);
    return panel;
  }

  private buildPrestigePanel(): HTMLElement {
    const panel = el("section", "panel");
    this.prestigeLayerRows = {} as Record<PrestigeLayerId, PrestigeLayerRow>;

    const layers: Array<{ id: PrestigeLayerId; title: string; reward: string; onAct: () => void }> = [
      {
        id: "prestige",
        title: "Prestige",
        reward: "+2% all production per level. Resets the number and upgrades. The slow penalty stays.",
        onAct: () => this.callbacks.onPrestige(),
      },
      {
        id: "ascension",
        title: "Ascension",
        reward: "×1.1 all production per level. Resets prestige and the slow penalty too.",
        onAct: () => this.callbacks.onAscend(),
      },
      {
        id: "transcendence",
        title: "Transcendence",
        reward: "+5% all production per level. The number's hue shifts 30°. Resets everything.",
        onAct: () => this.callbacks.onTranscend(),
      },
    ];

    for (const layer of layers) {
      const card = el("div", "prestige-card");
      const title = el("div", "prestige-title");
      const levelEl = el("span", "prestige-level");
      title.append(document.createTextNode(layer.title), levelEl);

      const reward = el("div", "prestige-reward");
      reward.textContent = layer.reward;

      const requirement = el("div", "prestige-requirement");

      const actButton = el("button", "prestige-button") as HTMLButtonElement;
      actButton.textContent = layer.title;
      actButton.addEventListener("click", layer.onAct);

      card.append(title, reward, requirement, actButton);
      panel.append(card);
      this.prestigeLayerRows[layer.id] = { card, levelEl, requirement, actButton };
    }
    return panel;
  }

  private buildAchievementsPanel(): HTMLElement {
    const panel = el("section", "panel");
    this.achievementCountEl = el("div", "achievement-count");
    panel.append(this.achievementCountEl);

    this.achievementRows = new Map();
    const list = el("div", "achievement-list");
    for (const achievement of ACHIEVEMENTS) {
      if (achievement.bonus) continue; // Easter egg stays off the list.
      const row = el("div", "achievement-row");
      const name = el("div", "achievement-name");
      const desc = el("div", "achievement-desc");
      row.append(name, desc);
      list.append(row);
      this.achievementRows.set(achievement.id, { row, name, desc });
    }
    panel.append(list);
    return panel;
  }

  private buildCardsPanel(): HTMLElement {
    // Static showcase of the base-game trading cards (§11.1). Opening this tab
    // is what unlocks "Card Collector" — handled in setActiveTab.
    const panel = el("section", "panel");
    const intro = el("div", "cards-intro");
    intro.textContent = "Steam Trading Cards. You can't collect them here. You just look.";
    const grid = el("div", "cards-grid");
    for (const card of TRADING_CARDS) {
      const cardEl = el("div", "trading-card");
      cardEl.classList.add(`card-${card.rarity}`);
      cardEl.style.setProperty("--card-bg", card.background);
      const face = el("div", "trading-card-face");
      face.textContent = card.face;
      const rarity = el("div", "trading-card-rarity");
      rarity.textContent = card.rarity;
      cardEl.append(face, rarity);
      grid.append(cardEl);
    }
    panel.append(intro, grid);
    return panel;
  }

  private buildStatsPanel(): HTMLElement {
    const panel = el("section", "panel");
    this.statValues = {};
    const rows: Array<{ key: string; label: string }> = [
      { key: "current", label: "Current number" },
      { key: "totalEver", label: "Total ever earned" },
      { key: "perSecond", label: "Per second" },
      { key: "clickPower", label: "Per click" },
      { key: "totalClicks", label: "Total clicks" },
      { key: "prestige", label: "Prestige level" },
      { key: "ascension", label: "Ascension level" },
      { key: "transcendence", label: "Transcendence level" },
      { key: "achievements", label: "Achievements" },
    ];
    for (const row of rows) {
      const statRow = el("div", "stat-row");
      const label = el("span", "stat-label");
      label.textContent = row.label;
      const value = el("span", "stat-value");
      this.statValues[row.key] = value;
      statRow.append(label, value);
      panel.append(statRow);
    }

    // Funny number sightings — the stat that never resets (§7.5).
    const sightingsHeader = el("div", "stat-section-header");
    sightingsHeader.textContent = "FUNNY NUMBER SIGHTINGS";
    panel.append(sightingsHeader);
    this.sightingsListEl = el("div", "sightings-list");
    panel.append(this.sightingsListEl);

    return panel;
  }

  private buildSettingsPanel(): HTMLElement {
    const panel = el("section", "panel");

    // --- Gameplay (§13.1) ---
    panel.append(this.settingsHeader("Gameplay"));

    const notationRow = el("div", "setting-row");
    const notationLabel = el("label", "setting-label");
    notationLabel.textContent = "Notation Mode";
    this.notationSelect = el("select", "setting-select") as HTMLSelectElement;
    for (const mode of Object.keys(NOTATION_LABELS) as NotationMode[]) {
      const option = document.createElement("option");
      option.value = mode;
      option.textContent = NOTATION_LABELS[mode];
      this.notationSelect.append(option);
    }
    this.notationSelect.addEventListener("change", () => {
      this.callbacks.onChangeNotation(this.notationSelect.value as NotationMode);
    });
    notationRow.append(notationLabel, this.notationSelect);
    panel.append(notationRow);

    panel.append(
      this.toggleRow("Offline Progress", (s) => s.settings.offlineProgress, (s, v) => { s.settings.offlineProgress = v; }),
      this.selectRow<"on" | "off" | "max">(
        "Screen Shake",
        [["on", "On"], ["off", "Off"], ["max", "MAXIMUM"]],
        (s) => s.settings.screenShake,
        (s, v) => { s.settings.screenShake = v; },
      ),
      this.toggleRow("Funny Number Popups", (s) => s.settings.funnyPopups, (s, v) => { s.settings.funnyPopups = v; }),
    );

    // Number colour override — locked unless transcended (§13.1).
    this.colorHueRow = this.sliderRow(
      "Number Hue Override",
      0, 360, 1,
      (s) => s.settings.numberColorHue ?? 0,
      (s, v) => { s.settings.numberColorHue = v; },
    );
    const hueToggle = el("button", "mini-button") as HTMLButtonElement;
    hueToggle.textContent = "auto";
    hueToggle.addEventListener("click", () => {
      if (!this.currentState) return;
      this.currentState.settings.numberColorHue = this.currentState.settings.numberColorHue === null ? 0 : null;
      this.callbacks.onSettingsChanged();
    });
    this.colorHueRow.row.append(hueToggle);
    panel.append(this.colorHueRow.row);

    // --- Audio (§13.2) ---
    panel.append(this.settingsHeader("Audio"));
    panel.append(
      this.volumeRow("Master Volume", "master"),
      this.volumeRow("Music Volume", "music"),
      this.volumeRow("SFX Volume", "sfx"),
      this.volumeRow("Funny Stinger Volume", "stinger"),
    );

    // --- Accessibility (§13.3) ---
    panel.append(this.settingsHeader("Accessibility"));
    panel.append(
      this.toggleRow("Reduced Motion", (s) => s.settings.reducedMotion, (s, v) => { s.settings.reducedMotion = v; }),
      this.toggleRow("High Contrast", (s) => s.settings.highContrast, (s, v) => { s.settings.highContrast = v; }),
      this.toggleRow("Screen Reader Announcements", (s) => s.settings.screenReader, (s, v) => { s.settings.screenReader = v; }),
      this.toggleRow("Auto-Click (1/s)", (s) => s.settings.autoClick, (s, v) => { s.settings.autoClick = v; }),
      this.selectRow<"none" | "protanopia" | "deuteranopia" | "tritanopia">(
        "Colorblind Mode",
        [["none", "None"], ["protanopia", "Protanopia"], ["deuteranopia", "Deuteranopia"], ["tritanopia", "Tritanopia"]],
        (s) => s.settings.colorblindMode,
        (s, v) => { s.settings.colorblindMode = v; },
      ),
    );

    // --- Save ---
    panel.append(this.settingsHeader("Save"));
    const resetRow = el("div", "setting-row");
    const resetButton = el("button", "danger-button") as HTMLButtonElement;
    resetButton.textContent = "Reset Save";
    resetButton.addEventListener("click", () => {
      if (confirm("Reset everything? The number goes back to zero. It won't remember you.")) {
        this.callbacks.onResetSave();
      }
    });
    resetRow.append(resetButton);
    panel.append(resetRow);

    return panel;
  }

  private settingsHeader(text: string): HTMLElement {
    const header = el("div", "stat-section-header");
    header.textContent = text.toUpperCase();
    return header;
  }

  private toggleRow(
    label: string,
    get: (state: GameState) => boolean,
    set: (state: GameState, value: boolean) => void,
  ): HTMLElement {
    const row = el("div", "setting-row");
    const labelEl = el("span", "setting-label");
    labelEl.textContent = label;
    const button = el("button", "toggle-button") as HTMLButtonElement;
    const refresh = () => {
      if (!this.currentState) return;
      button.textContent = get(this.currentState) ? "On" : "Off";
      button.classList.toggle("on", get(this.currentState));
    };
    button.addEventListener("click", () => {
      if (!this.currentState) return;
      set(this.currentState, !get(this.currentState));
      refresh();
      this.callbacks.onSettingsChanged();
    });
    this.settingRefreshers.push(refresh);
    row.append(labelEl, button);
    return row;
  }

  private selectRow<T extends string>(
    label: string,
    options: Array<[T, string]>,
    get: (state: GameState) => T,
    set: (state: GameState, value: T) => void,
  ): HTMLElement {
    const row = el("div", "setting-row");
    const labelEl = el("span", "setting-label");
    labelEl.textContent = label;
    const select = el("select", "setting-select") as HTMLSelectElement;
    for (const [value, text] of options) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = text;
      select.append(option);
    }
    select.addEventListener("change", () => {
      if (!this.currentState) return;
      set(this.currentState, select.value as T);
      this.callbacks.onSettingsChanged();
    });
    this.settingRefreshers.push(() => {
      if (this.currentState) select.value = get(this.currentState);
    });
    row.append(labelEl, select);
    return row;
  }

  private sliderRow(
    label: string,
    min: number,
    max: number,
    step: number,
    get: (state: GameState) => number,
    set: (state: GameState, value: number) => void,
  ): { row: HTMLElement; input: HTMLInputElement } {
    const row = el("div", "setting-row");
    const labelEl = el("span", "setting-label");
    labelEl.textContent = label;
    const input = el("input", "setting-slider") as HTMLInputElement;
    input.type = "range";
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.addEventListener("input", () => {
      if (!this.currentState) return;
      set(this.currentState, Number(input.value));
      this.callbacks.onSettingsChanged();
    });
    this.settingRefreshers.push(() => {
      if (this.currentState) input.value = String(get(this.currentState));
    });
    row.append(labelEl, input);
    return { row, input };
  }

  private volumeRow(label: string, key: keyof GameState["settings"]["volumes"]): HTMLElement {
    return this.sliderRow(
      label, 0, 1, 0.01,
      (s) => s.settings.volumes[key],
      (s, v) => { s.settings.volumes[key] = v; },
    ).row;
  }

  private setActiveTab(tabId: TabId): void {
    this.activeTab = tabId;
    this.statsTabIdleMs = 0; // Switching tabs resets the stare timer.
    if (tabId === "cards") this.callbacks.onOpenCards();
    for (const id of Object.keys(this.tabPanels) as TabId[]) {
      const isActive = id === tabId;
      this.tabPanels[id].classList.toggle("active", isActive);
      this.tabButtons[id].classList.toggle("active", isActive);
    }
  }

  // --- Per-frame update -----------------------------------------------------

  update(state: GameState): void {
    this.currentState = state;

    // Advance the "Long Stare" clock while the Stats tab sits open and idle.
    const nowMs = performance.now();
    const deltaMs = nowMs - this.lastClockMs;
    this.lastClockMs = nowMs;
    if (this.activeTab === "stats") this.statsTabIdleMs += deltaMs;

    this.applyAccessibilityClasses(state);
    if (this.activeTab === "settings") this.refreshSettingsControls(state);

    const flooredNumber = Math.floor(state.currentNumber);
    // Save-corruption easter egg: the number reads "CHEATER" for 60s while
    // production silently continues underneath (§9.3).
    this.numberDisplay.textContent = nowMs < this.cheaterUntilMs
      ? "CHEATER"
      : formatNumber(flooredNumber, state.notationMode);
    this.applyNumberVisualState(state);
    this.walletIcon.style.display = state.heavyWalletActive ? "" : "none";

    const perSecond = passivePerSecond(state);
    this.rateDisplay.textContent = `${formatCompact(perSecond)} / s`;

    this.syncUpgradeRows(state);
    this.updatePrestige(state);
    this.updateStats(state, perSecond);
    this.updateAchievements(state);

    if (this.notationSelect.value !== state.notationMode) {
      this.notationSelect.value = state.notationMode;
    }
  }

  private applyAccessibilityClasses(state: GameState): void {
    const settings = state.settings;
    this.root.classList.toggle("reduced-motion", settings.reducedMotion);
    this.root.classList.toggle("high-contrast", settings.highContrast);
    for (const mode of ["protanopia", "deuteranopia", "tritanopia"] as const) {
      this.root.classList.toggle(`cb-${mode}`, settings.colorblindMode === mode);
    }
  }

  private refreshSettingsControls(state: GameState): void {
    for (const refresh of this.settingRefreshers) refresh();
    this.notationSelect.value = state.notationMode;
    // Hue override is locked until the player has transcended at least once (§13.1).
    const locked = state.transcendenceLevel < 1;
    const auto = state.settings.numberColorHue === null;
    this.colorHueRow.input.disabled = locked || auto;
    this.colorHueRow.row.classList.toggle("locked", locked);
  }

  /** Announce milestones/events to the ARIA live region when enabled (§13.3). */
  announce(message: string): void {
    if (!this.currentState?.settings.screenReader) return;
    this.ariaLiveRegion.textContent = message;
  }

  private updateAchievements(state: GameState): void {
    this.achievementCountEl.textContent =
      `${unlockedCount(state)} / ${CANONICAL_ACHIEVEMENT_COUNT} unlocked`;

    for (const achievement of ACHIEVEMENTS) {
      if (achievement.bonus) continue;
      const row = this.achievementRows.get(achievement.id);
      if (!row) continue;
      const unlocked = isAchievementUnlocked(state, achievement.id);
      row.row.classList.toggle("unlocked", unlocked);
      // Hidden + still locked shows "???" (§10).
      if (unlocked) {
        row.name.textContent = achievement.name;
        row.desc.textContent = achievement.description;
      } else if (achievement.hidden) {
        row.name.textContent = "???";
        row.desc.textContent = "Hidden. Keep going.";
      } else {
        row.name.textContent = achievement.name;
        row.desc.textContent = achievement.description;
      }
    }
  }

  private updatePrestige(state: GameState): void {
    const prestige = this.prestigeLayerRows.prestige;
    prestige.card.classList.toggle("locked", !prestigeUnlocked(state));
    prestige.levelEl.textContent = ` — Lv ${state.prestigeLevel}`;
    prestige.actButton.disabled = !canPrestige(state);
    prestige.requirement.textContent = canPrestige(state)
      ? "Ready. The number doesn't care, but it'll go up 2% faster."
      : `Earn ${formatCompact(PRESTIGE_RUN_EARNED_THRESHOLD)} this run (${formatCompact(state.runEarned)} so far).`;

    const ascension = this.prestigeLayerRows.ascension;
    ascension.card.classList.toggle("locked", !ascensionUnlocked(state));
    ascension.levelEl.textContent = ` — Lv ${state.ascensionLevel}`;
    ascension.actButton.disabled = !canAscend(state);
    ascension.requirement.textContent = canAscend(state)
      ? "Ready. Your prestiges are forfeit. So is the slow penalty."
      : `Requires prestige level ${ASCENSION_PRESTIGE_THRESHOLD} (currently ${state.prestigeLevel}).`;

    const transcendence = this.prestigeLayerRows.transcendence;
    transcendence.card.classList.toggle("locked", !transcendenceUnlocked(state));
    transcendence.levelEl.textContent = ` — Lv ${state.transcendenceLevel}`;
    transcendence.actButton.disabled = !canTranscend(state);
    transcendence.requirement.textContent = canTranscend(state)
      ? "Ready. Everything goes. Only the hue remembers."
      : `Requires ascension level ${TRANSCENDENCE_ASCENSION_THRESHOLD} (currently ${state.ascensionLevel}).`;
  }

  /** Make the number read "CHEATER" for the given duration (§9.3). */
  triggerCheaterMode(durationMs: number): void {
    this.cheaterUntilMs = performance.now() + durationMs;
  }

  /** Heavy Wallet "ACCEPT YOUR FATE" overlay (§8.1) — a single, inescapable button. */
  showHeavyWalletOverlay(onAccept: () => void): void {
    this.overlayLayer.innerHTML = "";
    const title = el("div", "overlay-quote");
    title.textContent = "HEAVY WALLET EQUIPPED";
    const body = el("div", "overlay-body");
    body.textContent =
      "All number production has been permanently reduced by 0.001%. " +
      "This cannot be undone. This cannot be uninstalled. " +
      "You paid $4.99 for this. The base game was $0.99. Thank you for your support.";
    const accept = el("button", "overlay-accept") as HTMLButtonElement;
    accept.textContent = "ACCEPT YOUR FATE";
    accept.addEventListener("click", () => {
      this.overlayLayer.style.display = "none";
      onAccept();
    });
    this.overlayLayer.append(title, body, accept);
    this.overlayLayer.style.display = "flex";
  }

  /** Full-screen prestige quote overlay (§6.1). Click anywhere to dismiss. */
  showOverlay(quote: string): void {
    this.overlayLayer.innerHTML = "";
    const quoteEl = el("div", "overlay-quote");
    quoteEl.textContent = quote;
    const hint = el("div", "overlay-hint");
    hint.textContent = "tap to continue";
    this.overlayLayer.append(quoteEl, hint);
    this.overlayLayer.style.display = "flex";
    this.overlayLayer.classList.add("flash");
    const dismiss = () => {
      this.overlayLayer.style.display = "none";
      this.overlayLayer.classList.remove("flash");
      this.overlayLayer.removeEventListener("pointerdown", dismiss);
    };
    this.overlayLayer.addEventListener("pointerdown", dismiss);
  }

  /** Red-button corruption + unhinged font scaling (§3.3). */
  private applyNumberVisualState(state: GameState): void {
    const redCount = ownedCount(state, "red");
    this.numberDisplay.classList.toggle("corrupt-red", redCount >= 6);
    this.root.classList.toggle("ui-red-tint", redCount >= 20);
    this.root.classList.toggle("ui-all-red", redCount >= 50);

    if (state.notationMode === "unhinged") {
      // Shrink as digit count grows; no lower bound is the point (§3.2).
      const digitCount = this.numberDisplay.textContent?.length ?? 1;
      const fontPx = Math.max(8, 96 - Math.max(0, digitCount - 7) * 4);
      this.numberDisplay.style.fontSize = `${fontPx}px`;
    } else {
      this.numberDisplay.style.fontSize = "";
    }

    // Number hue: a manual override (unlocked after transcending) wins; otherwise
    // transcendence shifts the hue 30° per level (§6.3 / §13.1).
    const overrideHue = state.settings.numberColorHue;
    const hueDegrees = overrideHue !== null && state.transcendenceLevel >= 1
      ? overrideHue
      : transcendenceHueDegrees(state);
    this.numberDisplay.style.filter = hueDegrees > 0 ? `hue-rotate(${hueDegrees}deg)` : "";
  }

  private syncUpgradeRows(state: GameState): void {
    for (const definition of UPGRADE_DEFINITIONS) {
      const unlocked = isUnlocked(state, definition);
      const existingRow = this.upgradeRows.get(definition.id);

      if (unlocked && !existingRow) {
        const row = this.buildUpgradeRow(definition);
        this.upgradeRows.set(definition.id, row);
        this.upgradeListEl.append(row.container);
      }
      if (!unlocked) continue;

      const row = this.upgradeRows.get(definition.id)!;
      const owned = ownedCount(state, definition.id);
      const cost = nextCostFor(state, definition.id);
      const affordable = canAfford(state, definition.id);

      row.countEl.textContent = owned > 0 ? `×${owned}` : "";
      row.costEl.textContent = formatCompact(cost);
      row.buyButton.disabled = !affordable;
      row.container.classList.toggle("affordable", affordable);
    }
  }

  private buildUpgradeRow(definition: UpgradeDefinition): UpgradeRow {
    const container = el("div", "upgrade-row");
    if (definition.special) container.classList.add(`trap-${definition.special}`);

    const info = el("div", "upgrade-info");
    const nameEl = el("div", "upgrade-name");
    nameEl.textContent = definition.name;
    const countEl = el("span", "upgrade-count");
    nameEl.append(countEl);

    const descEl = el("div", "upgrade-desc");
    descEl.textContent = definition.description;

    const effectEl = el("div", "upgrade-effect");
    effectEl.textContent = definition.effectLabel;
    info.append(nameEl, descEl, effectEl);

    const buyButton = el("button", "buy-button") as HTMLButtonElement;
    const costEl = el("span", "buy-cost");
    buyButton.append(document.createTextNode("Buy "), costEl);
    buyButton.addEventListener("click", () => this.callbacks.onBuyUpgrade(definition.id));

    container.append(info, buyButton);
    return { container, countEl, costEl, buyButton };
  }

  private updateStats(state: GameState, perSecond: number): void {
    this.statValues.current.textContent = formatNumber(Math.floor(state.currentNumber), state.notationMode);
    this.statValues.totalEver.textContent = formatNumber(Math.floor(state.totalEverEarned), state.notationMode);
    this.statValues.perSecond.textContent = formatCompact(perSecond);
    this.statValues.clickPower.textContent = formatCompact(clickPower(state));
    this.statValues.totalClicks.textContent = state.totalClicks.toLocaleString("en-US");
    this.statValues.prestige.textContent = String(state.prestigeLevel);
    this.statValues.ascension.textContent = String(state.ascensionLevel);
    this.statValues.transcendence.textContent = String(state.transcendenceLevel);
    this.statValues.achievements.textContent = `${unlockedCount(state)} / ${CANONICAL_ACHIEVEMENT_COUNT}`;
    this.updateSightings(state);
  }

  private updateSightings(state: GameState): void {
    this.sightingsListEl.innerHTML = "";
    for (const funnyNumber of FUNNY_NUMBERS) {
      const count = state.funnyNumberSightings[funnyNumber.pattern] ?? 0;
      const row = el("div", "sighting-row");
      const label = el("span", "sighting-label");
      label.textContent = funnyNumber.label;
      label.style.color = funnyNumber.color;
      const value = el("span", "sighting-value");
      value.textContent = count.toLocaleString("en-US");
      row.append(label, value);
      this.sightingsListEl.append(row);
    }
  }

  // --- Effects --------------------------------------------------------------

  /** Spawns a "+N" particle that drifts up and fades (§4.1). */
  spawnClickParticle(clientX: number, clientY: number, amount: number, notationMode: NotationMode): void {
    const particle = el("div", "click-particle");
    particle.textContent = `+${formatNumber(Math.max(1, Math.floor(amount)), notationMode)}`;
    const jitterX = (Math.random() - 0.5) * 40;
    particle.style.left = `${clientX + jitterX}px`;
    particle.style.top = `${clientY}px`;
    this.particleLayer.append(particle);
    particle.addEventListener("animationend", () => particle.remove());
  }

  /** Spawns a funny-number popup at a random position with a burst animation (§7.2). */
  spawnFunnyPopup(funnyNumber: FunnyNumberDefinition, notationMode: NotationMode): void {
    const popup = el("div", "funny-popup");
    popup.textContent = funnyNumber.label;
    popup.style.color = funnyNumber.color;
    popup.style.fontSize = `${funnyNumber.size}px`;
    popup.style.textShadow = `0 0 16px ${funnyNumber.color}`;

    // Random position (§7.2): 10-70% horizontal, 15-45% vertical, ±25° rotation.
    const horizontalPercent = 10 + Math.random() * 60;
    const verticalPercent = 15 + Math.random() * 30;
    const rotationDegrees = (Math.random() - 0.5) * 50;
    popup.style.left = `${horizontalPercent}%`;
    popup.style.top = `${verticalPercent}%`;
    popup.style.setProperty("--rot", `${rotationDegrees}deg`);

    // In abbreviated/scientific modes the digits aren't visible, so the popup is
    // smaller and hints to switch (§7.1).
    if (notationMode === "normal" || notationMode === "nerd") {
      popup.classList.add("hidden-in-notation");
      const hint = el("span", "funny-hint");
      hint.textContent = " [hidden in notation]";
      popup.append(hint);
    }

    this.particleLayer.append(popup);
    popup.addEventListener("animationend", () => popup.remove());
  }

  /** Screen shake scaled to click power (§4.1), honouring the Screen Shake setting (§13.1). */
  applyClickShake(clickPowerValue: number, mode: ScreenShakeMode): void {
    if (mode === "off") return;
    if (mode === "max") {
      this.triggerShake("shake-violent");
      return;
    }
    if (clickPowerValue >= SHAKE_VIOLENT_THRESHOLD) {
      this.triggerShake("shake-violent");
    } else if (clickPowerValue >= SHAKE_SUBTLE_THRESHOLD) {
      this.triggerShake("shake-subtle");
    }
  }

  private triggerShake(className: string): void {
    this.root.classList.remove("shake-subtle", "shake-violent");
    // Force reflow so re-adding the class restarts the animation.
    void this.root.offsetWidth;
    this.root.classList.add(className);
  }

  showToast(message: string): void {
    const toast = el("div", "toast");
    toast.textContent = message;
    this.toastLayer.append(toast);
    toast.addEventListener("animationend", () => toast.remove());
  }
}

interface UpgradeRow {
  container: HTMLElement;
  countEl: HTMLElement;
  costEl: HTMLElement;
  buyButton: HTMLButtonElement;
}

type PrestigeLayerId = "prestige" | "ascension" | "transcendence";

interface PrestigeLayerRow {
  card: HTMLElement;
  levelEl: HTMLElement;
  requirement: HTMLElement;
  actButton: HTMLButtonElement;
}

interface AchievementRow {
  row: HTMLElement;
  name: HTMLElement;
  desc: HTMLElement;
}

function el(tag: string, className: string): HTMLElement {
  const element = document.createElement(tag);
  element.className = className;
  return element;
}

// Colour-vision-deficiency simulation matrices (§13.3). Injected once as SVG
// filters; CSS classes (.cb-*) reference them via filter: url(#...).
const COLORBLIND_MATRICES: Record<string, string> = {
  protanopia: "0.567 0.433 0 0 0  0.558 0.442 0 0 0  0 0.242 0.758 0 0  0 0 0 1 0",
  deuteranopia: "0.625 0.375 0 0 0  0.7 0.3 0 0 0  0 0.3 0.7 0 0  0 0 0 1 0",
  tritanopia: "0.95 0.05 0 0 0  0 0.433 0.567 0 0  0 0.475 0.525 0 0  0 0 0 1 0",
};

function injectColorblindFilters(): void {
  if (document.getElementById("ngu-cb-filters")) return;
  const svgNs = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNs, "svg");
  svg.setAttribute("id", "ngu-cb-filters");
  svg.setAttribute("aria-hidden", "true");
  svg.style.position = "absolute";
  svg.style.width = "0";
  svg.style.height = "0";
  for (const [mode, matrix] of Object.entries(COLORBLIND_MATRICES)) {
    const filter = document.createElementNS(svgNs, "filter");
    filter.setAttribute("id", `cb-${mode}`);
    const colorMatrix = document.createElementNS(svgNs, "feColorMatrix");
    colorMatrix.setAttribute("type", "matrix");
    colorMatrix.setAttribute("values", matrix);
    filter.append(colorMatrix);
    svg.append(filter);
  }
  document.body.append(svg);
}
