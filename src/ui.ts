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

  /** Per-upgrade row element refs, built lazily as upgrades unlock. */
  private upgradeRows = new Map<string, UpgradeRow>();
  private upgradeListEl!: HTMLElement;

  private activeTab: TabId = "upgrades";

  // "The Long Stare" tracking: ms the Stats tab has been open with no input.
  private statsTabIdleMs = 0;
  private lastClockMs = performance.now();

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
    this.numberDisplay = el("button", "number-display");
    this.numberDisplay.setAttribute("aria-label", "The number. Click it.");
    this.numberDisplay.addEventListener("pointerdown", (event) => {
      this.callbacks.onClickNumber(event.clientX, event.clientY);
    });
    this.rateDisplay = el("div", "rate-display");
    stage.append(this.numberDisplay, this.rateDisplay);

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

    this.root.append(stage, this.particleLayer, tabBar, panelHost, this.toastLayer, this.overlayLayer);
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

    const resetRow = el("div", "setting-row");
    const resetButton = el("button", "danger-button") as HTMLButtonElement;
    resetButton.textContent = "Reset Save";
    resetButton.addEventListener("click", () => {
      if (confirm("Reset everything? The number goes back to zero. It won't remember you.")) {
        this.callbacks.onResetSave();
      }
    });
    resetRow.append(resetButton);

    panel.append(notationRow, resetRow);
    return panel;
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
    // Advance the "Long Stare" clock while the Stats tab sits open and idle.
    const nowMs = performance.now();
    const deltaMs = nowMs - this.lastClockMs;
    this.lastClockMs = nowMs;
    if (this.activeTab === "stats") this.statsTabIdleMs += deltaMs;

    const flooredNumber = Math.floor(state.currentNumber);
    this.numberDisplay.textContent = formatNumber(flooredNumber, state.notationMode);
    this.applyNumberVisualState(state);

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

    // Transcendence shifts the number's hue 30° per level (§6.3).
    const hueDegrees = transcendenceHueDegrees(state);
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

  /** Screen shake scaled to click power (§4.1). */
  applyClickShake(clickPowerValue: number): void {
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
