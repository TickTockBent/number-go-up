// Tauri v2 entry point. The game itself is entirely the web frontend; this shell
// just hosts it in a native window. The Steam bridge will live here as
// `#[tauri::command]`s that the TS `SteamClient` calls via `invoke`.
//
// Sketch of the eventual Steam commands (kept as a comment until the steamworks
// crate + Steam SDK are wired up):
//
//   #[tauri::command]
//   fn steam_unlock_achievement(id: String) { /* client.user_stats().set_achievement(&id) ... */ }
//
//   #[tauri::command]
//   fn steam_is_dlc_installed(app_id: u32) -> bool { /* client.apps().is_dlc_installed(...) */ }

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // .invoke_handler(tauri::generate_handler![steam_unlock_achievement, steam_is_dlc_installed])
        .run(tauri::generate_context!())
        .expect("error while running NUMBER GOES UP");
}
