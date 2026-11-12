import type { ReactNode } from "react";
import { FREE_VOTER_LIMIT, MAX_PRO_ROOMS, PRICES, TRIAL_DAYS } from "../../shared/plan";
import { APP_NAME } from "../brand";
import { Footer } from "../components/Footer";
import { Logo } from "../components/Logo";
import { ThemeToggle } from "../components/ThemeToggle";

export const SUPPORT_EMAIL = `support@${APP_NAME.toLowerCase()}.com`;
const UPDATED = "November 12, 2026";

export type InfoPageId = "pricing" | "terms" | "privacy" | "refunds";

function Shell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
        <Logo />
        <ThemeToggle />
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-10 sm:px-6">
        <h1 className="font-display text-5xl leading-none">{title}</h1>
        <div className="info mt-6 space-y-4 text-ink-2 [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:text-ink [&_a]:text-brand [&_a]:underline [&_li]:ml-5 [&_li]:list-disc">
          {children}
        </div>
      </main>
      <Footer />
    </div>
  );
}

function Pricing() {
  return (
    <Shell title="Pricing">
      <p>One price per team. Only the person who pays signs in. Everyone you invite just opens the room link and votes.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="!mt-0">Free</h2>
          <p className="mt-1 text-3xl font-semibold text-ink">$0</p>
          <ul className="mt-3 space-y-1 text-sm">
            <li>Up to {FREE_VOTER_LIMIT} voters at once, unlimited spectators</li>
            <li>All decks, story queue, timer, reveal and hide</li>
            <li>History and CSV export</li>
          </ul>
        </div>
        <div className="rounded-2xl border-[1.5px] border-ink bg-surface p-5">
          <h2 className="!mt-0">Pro</h2>
          <p className="mt-1 text-3xl font-semibold text-ink">
            {PRICES.monthly.label.split(" ")[0]}
            <span className="text-base font-normal text-ink-2"> / month</span>
          </p>
          <p className="text-sm">or {PRICES.yearly.label} (save 25%)</p>
          <ul className="mt-3 space-y-1 text-sm">
            <li>Unlimited voters in up to {MAX_PRO_ROOMS} rooms, swap them any time</li>
            <li>Everything in Free</li>
            <li>{TRIAL_DAYS}-day free trial, cancel any time</li>
          </ul>
        </div>
      </div>
      <p>
        Start a trial from your <a href="/account">account page</a> or the <strong>Try Pro</strong> button in a room. You enter a
        card at checkout. It's charged when the trial ends unless you cancel, and we email you 3 days before.
      </p>
      <p>
        Private by design: no ads, no tracking, no connectors into your company's tools, and no sign-up for voters. Rooms
        nobody uses for 90 days are deleted.
      </p>
      <p>
        Questions? <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
      </p>
    </Shell>
  );
}

function Terms() {
  return (
    <Shell title="Terms of service">
      <p>Last updated {UPDATED}.</p>
      <p>
        {APP_NAME} is a planning poker tool for teams. By using it you agree to these terms. If you don't agree, please don't use
        the service.
      </p>
      <h2>The service</h2>
      <p>
        Anyone with a room's link can join that room, so treat room links like you would a meeting link. Don't share
        anything in a room you wouldn't share with the people who have the link. We may change or stop features, and we
        delete rooms that nobody has used for 90 days.
      </p>
      <h2>Paid plans</h2>
      <p>
        Pro is a subscription ({PRICES.monthly.label} or {PRICES.yearly.label}) on the account of the person who pays, and covers
        up to {MAX_PRO_ROOMS} rooms they choose. It starts with a {TRIAL_DAYS}-day free trial. Payments are processed through Stripe Managed Payments: Stripe's Link is the merchant of record (your
        statement and receipt say the purchase was sold through Link) and handles billing, taxes and receipts. Subscriptions renew automatically until cancelled. You can cancel any time from your account page
        or through Link, and Pro stays active until the end of the period you paid for.
      </p>
      <h2>Acceptable use</h2>
      <p>Don't use {APP_NAME} for anything illegal, to harass people, or to attack or overload the service.</p>
      <h2>No warranty</h2>
      <p>
        The service is provided "as is", without warranties of any kind. To the extent the law allows, our liability for any
        claim is limited to the amount you paid us in the 12 months before it.
      </p>
      <h2>Contact</h2>
      <p>
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
      </p>
    </Shell>
  );
}

function Privacy() {
  return (
    <Shell title="Privacy policy">
      <p>Last updated {UPDATED}.</p>
      <p>We keep as little as we can, and we never sell or share it for advertising.</p>
      <h2>What we store</h2>
      <ul>
        <li>The display name and colour you pick, and a random id kept in your browser so you keep your seat.</li>
        <li>What you put in a room: story titles, links, votes and estimates.</li>
        <li>If you pay: your email address (to sign you in), which rooms your plan covers, and the subscription status from our payment provider. We never see your card details.</li>
      </ul>
      <p>Room data is deleted automatically after 90 days without use.</p>
      <h2>What we don't do</h2>
      <ul>
        <li>No ads, no analytics trackers, no third-party cookies. The only cookie keeps a paying owner signed in.</li>
        <li>No connections into Jira or other company tools.</li>
      </ul>
      <h2>Service providers</h2>
      <p>
        The app runs on Cloudflare. Payments are handled by Stripe and its Link service, which receive your name, email, billing address
        and card to process the subscription, under their own privacy policies. Sign-in emails are sent through Resend.
      </p>
      <h2>Your choices</h2>
      <p>
        Want a room or your account deleted, or have a question? Email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>
    </Shell>
  );
}

function Refunds() {
  return (
    <Shell title="Refund policy">
      <p>Last updated {UPDATED}.</p>
      <p>
        Every Pro plan starts with a {TRIAL_DAYS}-day free trial, so you can try it with your team before paying. Cancel
        before the trial ends and you won't be charged.
      </p>
      <p>
        If you're charged and didn't mean to be, email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> within 14 days
        of the charge and we'll refund it in full. After that, you can cancel any time and won't be charged again, but we
        don't refund partial periods.
      </p>
    </Shell>
  );
}

export function InfoPage({ id }: { id: InfoPageId }) {
  if (id === "pricing") return <Pricing />;
  if (id === "terms") return <Terms />;
  if (id === "privacy") return <Privacy />;
  return <Refunds />;
}
