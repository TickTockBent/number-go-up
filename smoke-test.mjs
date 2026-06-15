// Headless runtime smoke test. Boots the built game in Chromium, exercises the
// core systems, and fails on any console error or thrown exception. Not a unit
// suite — a "does it actually run without exploding" check.
import { chromium } from "playwright";
import { createServer } from "vite";

const errors = [];
const server = await createServer({ server: { port: 5199 }, logLevel: "error" });
await server.listen();

const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
const page = await browser.newPage();
page.on("console", (msg) => { if (msg.type() === "error") errors.push(`console: ${msg.text()}`); });
page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
page.on("requestfailed", (req) => errors.push(`reqfailed: ${req.url()}`));
page.on("response", (res) => { if (res.status() === 404) errors.push(`404: ${res.url()}`); });

const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok, detail }); };

try {
  await page.goto("http://localhost:5199/?dlc=heavywallet", { waitUntil: "networkidle" });

  // The number renders.
  await page.waitForSelector(".number-display");
  check("number display renders", await page.isVisible(".number-display"));

  // Heavy Wallet overlay (from ?dlc=heavywallet) shows and accepts.
  const acceptVisible = await page.isVisible(".overlay-accept");
  check("heavy wallet overlay appears", acceptVisible);
  if (acceptVisible) await page.click(".overlay-accept");

  // Wallet icon now showing.
  check("wallet icon visible after accept", await page.isVisible(".wallet-icon"));

  // Click the number a bunch; it should go up.
  const before = await page.textContent(".number-display");
  for (let i = 0; i < 30; i++) await page.click(".number-display");
  const after = await page.textContent(".number-display");
  check("clicking raises the number", before !== after, `${before} -> ${after}`);

  // Grant a pile of number, then buy an upgrade.
  await page.evaluate(() => {
    const raw = localStorage.getItem("number-goes-up:save");
  });
  // Buy the first affordable upgrade by clicking enough then hitting a buy button.
  for (let i = 0; i < 200; i++) await page.click(".number-display");
  const buyButtons = await page.$$(".buy-button:not([disabled])");
  check("an upgrade is affordable", buyButtons.length > 0, `${buyButtons.length} affordable`);
  if (buyButtons.length) await buyButtons[0].click();

  // Tab navigation across all tabs (exercises every panel builder/updater).
  for (const tab of ["Prestige", "Achievements", "Stats", "Cards", "Settings", "Upgrades"]) {
    await page.click(`.tab-button:has-text("${tab}")`);
  }
  check("all tabs navigable", true);

  // Achievements: at least "First Click" should have unlocked.
  await page.click('.tab-button:has-text("Achievements")');
  const achText = await page.textContent(".achievement-count");
  check("achievements unlocking", /[1-9]/.test(achText), achText);

  // Settings: flip notation to Unhinged and toggle a few options.
  await page.click('.tab-button:has-text("Settings")');
  await page.selectOption(".setting-select >> nth=0", "unhinged");
  check("notation switch works", true);

  // Let the loop run a moment to accrue passive production / music / achievements.
  await page.waitForTimeout(1500);

} catch (err) {
  errors.push(`test-harness: ${err.message}`);
} finally {
  await browser.close();
  await server.close();
}

let failed = errors.length;
console.log("\n=== smoke test results ===");
for (const r of results) {
  console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `  (${r.detail})` : ""}`);
  if (!r.ok) failed++;
}
if (errors.length) {
  console.log("\n--- runtime errors ---");
  for (const e of errors) console.log("  " + e);
}
console.log(`\n${failed === 0 ? "ALL GOOD" : failed + " PROBLEM(S)"}`);
process.exit(failed === 0 ? 0 : 1);
