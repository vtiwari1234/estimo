// Paid-site check: free rooms seat 4 voters; the owner signs in by email, and a signed
// subscription webhook makes their rooms Pro.
// Run `npm run dev:pro` with LS_WEBHOOK_SECRET=testsecret and DEV_LOGIN_LINKS=1 in .dev.vars.pro, then: npm run e2e:pro
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

  // Upgrading goes through the owner's account: sign in by email first.
  await ana.getByRole("link", { name: /Try Pro free/ }).click();
  await ana.getByLabel("Your email").fill("owner@example.com");
  await ana.getByRole("button", { name: /Email me a sign-in link/ }).click();
  await ana.getByText("Check your email").waitFor();
  await ana.getByRole("link", { name: "Dev sign-in link" }).click();
  await ana.getByRole("button", { name: "Sign in" }).click();
  await ana.getByText("Signed in as").waitFor();
  await ana.getByRole("heading", { name: "Start your free trial" }).waitFor();
  if (SHOTS) await ana.screenshot({ path: `${SHOTS}/pro-2-account.png`, fullPage: true });
  await ana.getByRole("button", { name: /Start 14-day free trial/ }).click();
  await ana.getByText(/Payments aren't set up yet/).waitFor(); // no store ids on a dev machine
  const { id: userId } = await ana.evaluate(() => fetch("/api/account").then((r) => r.json()));

  const bad = await fetch(`${BASE}/api/billing/webhook`, { method: "POST", headers: { "X-Signature": "nope" }, body: "{}" });
  assert.equal(bad.status, 401, "unsigned webhooks are rejected");

  const res = await webhook({
    meta: { event_name: "subscription_created", custom_data: { user_id: userId, room_id: room } },
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
  await ana.reload();
  await ana.getByText(/Free trial until/).waitFor();
  await ana.getByRole("link", { name: /Manage billing/ }).waitFor();
  await ana.getByTestId("pro-rooms").getByText(`/${room}`).waitFor();

  // A typo'd room can be swapped out.
  await ana.getByLabel("Room name or link").fill("typo-roomm");
  await ana.getByRole("button", { name: "Add room" }).click();
  await ana.getByTestId("pro-rooms").getByText("/typo-roomm").waitFor();
  ana.once("dialog", (d) => d.accept());
  await ana.getByTestId("pro-rooms").getByRole("listitem").filter({ hasText: "/typo-roomm" }).getByRole("button", { name: "Remove" }).click();
  await ana.getByTestId("pro-rooms").getByText("/typo-roomm").waitFor({ state: "detached" });
  if (SHOTS) await ana.screenshot({ path: `${SHOTS}/pro-3-account-trial.png`, fullPage: true });

  // The room itself is Pro now; people in it see the trial and no billing link.
  await pages[1].getByText(/Free trial until/).waitFor();
  assert.equal(await pages[1].getByRole("link", { name: /Manage billing/ }).count(), 0, "billing link stays on the account page");

  await eve.getByRole("button", { name: "Your profile" }).click();
  await eve.getByRole("button", { name: /^Voter/ }).click();
  await eve.getByRole("button", { name: /^Save/ }).click();
  await eve.getByRole("radiogroup", { name: "Your card" }).waitFor();
  if (SHOTS) await eve.screenshot({ path: `${SHOTS}/pro-4-room-trial.png`, fullPage: true });

  for (const p of ["pricing", "terms", "privacy", "refunds"]) {
    // eslint-disable-next-line no-await-in-loop
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
