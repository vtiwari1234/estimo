// Paid-site check: free rooms seat 4 voters, a signed webhook turns the room Pro.
// Run `npm run dev:pro` with LS_WEBHOOK_SECRET=testsecret in .dev.vars.pro, then: npm run e2e:pro
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

const BASE = process.env.BASE_URL ?? "http://localhost:5173";
const SECRET = process.env.LS_WEBHOOK_SECRET ?? "testsecret";
const SHOTS = process.env.SHOTS;
const room = `pro-${Date.now().toString(36)}`;
const browser = await chromium.launch();

async function join(name) {
  const page = await (await browser.newContext()).newPage();
  await page.goto(`${BASE}/r/${room}`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Your name").fill(name);
  await page.getByRole("button", { name: /^Voter/ }).click();
  await page.getByRole("button", { name: "Join room" }).click();
  await page.getByText(/online/).waitFor();
  return page;
}

async function webhook(body) {
  const raw = JSON.stringify(body);
  const sig = createHmac("sha256", SECRET).update(raw).digest("hex");
  return fetch(`${BASE}/api/billing/webhook`, { method: "POST", headers: { "X-Signature": sig }, body: raw });
}

try {
  const pages = [];
  for (const n of ["Ana", "Ben", "Cy", "Dee"]) pages.push(await join(n));
  const [ana] = pages;
  await ana.getByText("4 of 4 voters").waitFor();

  const eve = await join("Eve");
  await eve.getByText(/Free rooms allow 4 voters/).waitFor();
  assert.equal(await eve.getByRole("radiogroup", { name: "Your card" }).count(), 0, "5th person is a spectator");
  if (SHOTS) await ana.screenshot({ path: `${SHOTS}/pro-1-free.png`, fullPage: true });

  await ana.getByRole("button", { name: /Try Pro free/ }).click();
  await ana.getByRole("dialog", { name: "Go Pro" }).waitFor();
  if (SHOTS) await ana.screenshot({ path: `${SHOTS}/pro-2-dialog.png` });
  await ana.keyboard.press("Escape");

  const bad = await fetch(`${BASE}/api/billing/webhook`, { method: "POST", headers: { "X-Signature": "nope" }, body: "{}" });
  assert.equal(bad.status, 401, "unsigned webhooks are rejected");

  const res = await webhook({
    meta: { event_name: "subscription_created", custom_data: { room_id: room } },
    data: {
      type: "subscriptions",
      id: "42",
      attributes: {
        status: "on_trial",
        variant_name: "Yearly",
        trial_ends_at: new Date(Date.now() + 14 * 864e5).toISOString(),
        renews_at: new Date(Date.now() + 14 * 864e5).toISOString(),
        urls: { customer_portal: "https://example.com/portal" },
      },
    },
  });
  assert.equal(res.status, 200);
  await ana.getByText(/Free trial until/).waitFor();
  await ana.getByRole("link", { name: /Manage billing/ }).waitFor();
  assert.equal(await pages[1].getByRole("link", { name: /Manage billing/ }).count(), 0, "only the host sees billing");

  await eve.getByRole("button", { name: "Your profile" }).click();
  await eve.getByRole("button", { name: /^Voter/ }).click();
  await eve.getByRole("button", { name: /^Save/ }).click();
  await eve.getByRole("radiogroup", { name: "Your card" }).waitFor();
  if (SHOTS) await ana.screenshot({ path: `${SHOTS}/pro-3-trial.png`, fullPage: true });

  for (const p of ["pricing", "terms", "privacy", "refunds"]) {
    await ana.goto(`${BASE}/${p}`);
    await ana.getByRole("heading", { level: 1 }).waitFor();
  }
  console.log(`✓ paid-site flow passed in room ${room}`);
} catch (err) {
  console.error("✗ paid-site check failed:", err);
  process.exitCode = 1;
} finally {
  await browser.close();
}
