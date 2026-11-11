// End-to-end check: two people join a room, vote, reveal and save an estimate.
// Run with the dev server up (npm run dev), then: npm run e2e
// Set BASE_URL to test a deployed copy, and SHOTS=dir to save screenshots.
import { chromium } from "playwright";
import assert from "node:assert/strict";

const BASE = process.env.BASE_URL ?? "http://localhost:5173";
const SHOTS = process.env.SHOTS;
const room = `e2e-${Date.now().toString(36)}`;

const browser = await chromium.launch();
const shot = async (page, name) => SHOTS && page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });

async function join(name, role = "Voter", opts = {}) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.error(`[${name}] page error:`, e.message));
  await page.goto(`${BASE}/r/${room}`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Your name").fill(name);
  await page.getByRole("button", { name: new RegExp(`^${role}`) }).click();
  await page.getByRole("button", { name: "Join room" }).click();
  await page.getByText(/online/).waitFor();
  return page;
}

try {
  const ana = await join("Ana");
  await ana.getByLabel("Add stories").fill("PROJ-1 Login with Google https://example.com/PROJ-1\nPROJ-2 Export to CSV");
  await ana.getByRole("button", { name: /^Add 2/ }).click();
  await ana.getByTestId("current-story").getByText("PROJ-1 Login with Google").waitFor();

  const ben = await join("Ben", "Voter", { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const po = await join("Pat", "Spectator");
  await ben.getByTestId("current-story").getByText("PROJ-1 Login with Google").waitFor();
  assert.equal(await po.getByRole("radiogroup", { name: "Your card" }).count(), 0, "spectators get no hand");

  await ana.getByRole("radio", { name: "3 points", exact: true }).click();
  await ben.getByRole("radio", { name: "13 points", exact: true }).click();
  await ana.getByText("Everyone has voted. Ready to reveal.").waitFor();
  // Ben's card is hidden from Ana until reveal.
  assert.equal(await ana.getByTestId("revealed-card").count(), 0);
  await shot(ana, "1-voted");

  // Revealed by accident: hide again, then reveal for real.
  await ana.getByRole("button", { name: "Reveal cards" }).click();
  await ana.getByRole("button", { name: "Hide cards" }).click();
  await ben.getByRole("button", { name: "Reveal cards" }).waitFor();
  assert.equal(await ben.getByTestId("revealed-card").count(), 0);
  await ana.getByRole("button", { name: "Reveal cards" }).click();
  await ben.getByTestId("stat-average").getByText("8").waitFor();
  await ben.getByText("(lowest)").waitFor();
  await shot(ben, "2-revealed-mobile");
  await shot(ana, "2-revealed-desktop");

  // Reset wipes the estimates while the cards are showing.
  await ana.getByRole("button", { name: "Reset" }).click();
  await ben.getByText("Pick a card").waitFor();
  await ana.getByRole("radio", { name: "3 points", exact: true }).click();
  await ben.getByRole("radio", { name: "8 points", exact: true }).click();
  await ana.getByRole("button", { name: "Reveal cards" }).click();
  await ben.getByTestId("stat-average").getByText("5.5").waitFor();

  await ana.getByRole("button", { name: "Vote again" }).first().click();
  await ana.getByRole("radio", { name: "5 points", exact: true }).click();
  await ben.getByRole("radio", { name: "5 points", exact: true }).click();
  await ben.getByRole("button", { name: "Reveal cards" }).click();
  await ana.getByText("Everyone agrees!").waitFor();
  await ana.getByRole("button", { name: /^Save 5/ }).click();

  await ben.getByTestId("current-story").getByText("PROJ-2 Export to CSV").waitFor();
  await ben.getByRole("tab", { name: /Estimated \(1\)/ }).click();
  await ben.getByText("2 rounds · consensus").waitFor();

  await ana.getByRole("button", { name: "React 🎉" }).click();
  await ben.getByText("🎉").first().waitFor();

  // Refreshing keeps your seat and your vote.
  await ana.getByRole("radio", { name: "8 points", exact: true }).click();
  await ana.reload({ waitUntil: "domcontentloaded" });
  await ana.getByRole("radio", { name: "8 points", exact: true, checked: true }).waitFor();

  await ana.getByRole("tab", { name: /Estimated/ }).click();
  const [download] = await Promise.all([ana.waitForEvent("download"), ana.getByRole("button", { name: "Export CSV" }).click()]);
  const csv = await (await download.createReadStream()).toArray().then((c) => Buffer.concat(c).toString());
  assert.match(csv, /PROJ-1 Login with Google,https:\/\/example.com\/PROJ-1,estimated,5,2,/);
  await shot(ana, "3-history");

  console.log(`✓ end-to-end voting flow passed in room ${room}`);
} catch (err) {
  console.error("✗ end-to-end check failed:", err);
  process.exitCode = 1;
} finally {
  await browser.close();
}
