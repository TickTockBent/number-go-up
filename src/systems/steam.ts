// Steam integration seam (GDD §8, §11, §15.2). Real Steamworks calls require
// the Steam SDK, an app id, and a running Steam client — none of which exist in
// a browser or a fresh checkout. So the game talks to this interface, and ships
// with a MockSteamClient that no-ops achievements and reports no DLC.
//
// The Tauri milestone provides a TauriSteamClient that forwards these calls to
// Rust `#[tauri::command]`s backed by the `steamworks` crate. Until then the
// mock keeps everything runnable and testable.

export const HEAVY_WALLET_DLC_ID = "heavy_wallet";

export interface SteamClient {
  /** True when running against a real Steam client. */
  isAvailable(): boolean;
  /** Push an achievement unlock to Steam (idempotent on Steam's side). */
  unlockAchievement(achievementId: string): void;
  /** Whether a DLC is owned/installed (e.g. the Heavy Wallet). */
  isDlcInstalled(dlcId: string): boolean;
}

/**
 * Default client for non-Steam runs. Achievements go to the console so they're
 * observable in dev. DLC ownership is false — EXCEPT a `?dlc=heavywallet` query
 * param, which simulates ownership so the Heavy Wallet flow can be tested in the
 * browser without a real entitlement. Real Steam builds never read the query.
 */
export class MockSteamClient implements SteamClient {
  isAvailable(): boolean {
    return false;
  }

  unlockAchievement(achievementId: string): void {
    console.debug(`[steam:mock] achievement unlocked → ${achievementId}`);
  }

  isDlcInstalled(dlcId: string): boolean {
    if (dlcId === HEAVY_WALLET_DLC_ID) {
      return new URLSearchParams(window.location.search).get("dlc") === "heavywallet";
    }
    return false;
  }
}

/** Resolves the active Steam client. Swapped for TauriSteamClient under Tauri+Steam. */
export function getSteamClient(): SteamClient {
  // Future: if (window.__TAURI__) return new TauriSteamClient();
  return new MockSteamClient();
}
