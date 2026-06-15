# NUMBER GOES UP

There is a number. It goes up.

A $0.99 self-aware idle/incremental game for Steam. Design doc:
[`docs/NUMBER_GOES_UP_GDD.md`](docs/NUMBER_GOES_UP_GDD.md).

## Stack

- **Frontend:** vanilla TypeScript + [Vite](https://vitejs.dev/). No UI framework —
  the whole game is "two numbers and some buttons," so the runtime stays tiny
  (~50 KB JS / ~16 KB gzipped).
- **Shell:** [Tauri v2](https://tauri.app/) (`src-tauri/`) for the native Steam build.
- **Audio:** fully procedural WebAudio — no sample assets ship with the game.

## Run it (browser)

```bash
npm install
npm run dev        # http://localhost:5173
```

The browser build is the whole game; Tauri is only the native wrapper.

### Test hooks

- `?dlc=heavywallet` — simulates owning the Heavy Wallet DLC (the mock Steam
  client reads this so the §8 flow is testable without a real entitlement).
- Edit the `number-goes-up:save` localStorage entry to trip the save-corruption
  easter egg ("CHEATER" for 60s + the *Caught Red-Handed* achievement).
- Set the number to `Infinity` in the save to unlock *You Win?*.

### Smoke test

`smoke-test.mjs` boots the game headless and exercises the core loop (click,
buy, tab nav, achievements, Heavy Wallet, notation), failing on any console
error. It needs Playwright and a Chromium/Chrome on the machine:

```bash
node smoke-test.mjs    # requires `playwright` available + a system Chrome
```

It's a manual QA tool, not wired into `npm test` — Playwright is intentionally
not a project dependency (it pulls browser binaries).

## Run it (native, Tauri)

```bash
npm run tauri dev      # needs the Rust toolchain + Tauri system deps
```

> **Status:** the Tauri shell is scaffolded (`src-tauri/`) but has **not** been
> native-built here — that needs the platform WebView dependencies
> (`libwebkit2gtk-4.1`, `libgtk-3`, etc. on Linux) and app icons under
> `src-tauri/icons/`. Add those before `npm run tauri build`.

## Steam integration

`src/systems/steam.ts` defines a `SteamClient` interface. The shipped
`MockSteamClient` no-ops achievements and reports no DLC, so everything runs
without Steam. Real Steamworks (achievements, cloud saves, DLC detection) is
wired through Tauri commands in `src-tauri/src/lib.rs` once the `steamworks`
crate, Steam SDK redistributables, and an app id are available.

## Project layout

```
src/
  main.ts              # entry: load, offline, fixed-step loop, input wiring
  game.ts              # player actions (click, buy)
  state.ts             # GameState + settings + defaults
  ui.ts                # all DOM construction + per-frame updates
  data/                # upgrades, trading cards
  systems/             # economy, notation, prestige, funny numbers,
                       #   achievements, audio, save, steam
src-tauri/             # Tauri v2 native shell
docs/                  # the GDD
```
