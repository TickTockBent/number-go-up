// Steam Trading Cards (GDD §11). In-game these are just a static showcase —
// you can't actually collect them here (§10.5 "Card Collector").

export type CardRarity = "common" | "uncommon" | "rare" | "legendary" | "cursed";

export interface TradingCard {
  face: string;
  rarity: CardRarity;
  background: string;
  /** Requires the Heavy Wallet DLC to obtain (§11.2). */
  dlc?: boolean;
}

export const TRADING_CARDS: TradingCard[] = [
  { face: "3", rarity: "common", background: "#2a2f36" },
  { face: "14", rarity: "common", background: "#2a2f36" },
  { face: "42", rarity: "uncommon", background: "#12244a" },
  { face: "69", rarity: "uncommon", background: "#4a1230" },
  { face: "7", rarity: "rare", background: "#3a2e08" },
  { face: "100", rarity: "common", background: "#2a2f36" },
  { face: "∞", rarity: "legendary", background: "#2a0a4a" },
  { face: "0", rarity: "cursed", background: "#3a0606" },
  { face: "$4.99", rarity: "common", background: "#33363a", dlc: true },
];
