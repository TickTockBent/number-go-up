// DOM construction and per-frame updates. Vanilla TS, no framework — the UI is
// "two numbers and some buttons" (GDD §14), so the runtime stays tiny.

import { UPGRADE_DEFINITIONS, type UpgradeDefinition } from "./data/upgrades";
import {
  canAfford,
  isUnlocked,
  nextCostFor,
  passivePerSecond,
} from "./systems/economy";
import { formatCompact, formatNumber, NOTATION_LABELS, type NotationMode } from "./systems/notation";
import { ownedCount, type GameState } from "./state";

type TabId = "upgrades" | "stats" | "settings";

export interface UiCallbacks {
  onClickNumber: (clientX: number, clientY: number) => void;
  onBuyUpgrade: (upgradeId: string) => void;
  onChangeNotation: (mode: NotationMode) => void;
  onResetSave: () => void;
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

  /** Per-upgrade row element refs, built lazily as upgrades unlock. */
  private upgradeRows = new Map<string, UpgradeRow>();
  private upgradeListEl!: HTMLElement;

  private activeTab: TabId = "upgrades";

  constructor(root: HTMLElement, callbacks: UiCallbacks) {
    this.root = root;
    this.callbacks = callbacks;
    this.build();
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
      { id: "stats", label: "Stats" },
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
    this.tabPanels.stats = this.buildStatsPanel();
    this.tabPanels.settings = this.buildSettingsPanel();

    const panelHost = el("div", "panel-host");
    panelHost.append(this.tabPanels.upgrades, this.tabPanels.stats, this.tabPanels.settings);

    this.root.append(stage, this.particleLayer, tabBar, panelHost, this.toastLayer);
    this.setActiveTab(this.activeTab);
  }

  private buildUpgradesPanel(): HTMLElement {
    const panel = el("section", "panel");
    this.upgradeListEl = el("div", "upgrade-list");
    panel.append(this.upgradeListEl);
    return panel;
  }

  private buildStatsPanel(): HTMLElement {
    const panel = el("section", "panel");
    this.statValues = {};
    const rows: Array<{ key: string; label: string }> = [
      { key: "current", label: "Current number" },
      { key: "totalEver", label: "Total ever earned" },
      { key: "perSecond", label: "Per second" },
      { key: "totalClicks", label: "Total clicks" },
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
    for (const id of Object.keys(this.tabPanels) as TabId[]) {
      const isActive = id === tabId;
      this.tabPanels[id].classList.toggle("active", isActive);
      this.tabButtons[id].classList.toggle("active", isActive);
    }
  }

  // --- Per-frame update -----------------------------------------------------

  update(state: GameState): void {
    const flooredNumber = Math.floor(state.currentNumber);
    this.numberDisplay.textContent = formatNumber(flooredNumber, state.notationMode);
    this.applyNumberVisualState(state);

    const perSecond = passivePerSecond(state);
    this.rateDisplay.textContent = `${formatCompact(perSecond)} / s`;

    this.syncUpgradeRows(state);
    this.updateStats(state, perSecond);

    if (this.notationSelect.value !== state.notationMode) {
      this.notationSelect.value = state.notationMode;
    }
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
    this.statValues.totalClicks.textContent = state.totalClicks.toLocaleString("en-US");
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

function el(tag: string, className: string): HTMLElement {
  const element = document.createElement(tag);
  element.className = className;
  return element;
}
