import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { MAX_PRO_ROOMS, PRICES, TRIAL_DAYS, type Interval, type Plan } from "../../shared/plan";
import { navigate } from "../App";
import { APP_NAME } from "../brand";
import { Footer } from "../components/Footer";
import { Logo } from "../components/Logo";
import { ThemeToggle } from "../components/ThemeToggle";

interface Account {
  email: string;
  plan: Plan | null;
  pro: boolean;
  rooms: string[];
  maxRooms: number;
}

function day(ms: number | null | undefined): string {
  return ms ? new Date(ms).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }) : "";
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw Object.assign(new Error(data.error || "Something went wrong."), { status: res.status });
  return data;
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
        <Logo />
        <ThemeToggle />
      </header>
      <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-10 sm:px-6">{children}</main>
      <Footer />
    </div>
  );
}

const card = "rounded-2xl border border-line bg-surface p-5";
const primary = "rounded-full bg-ink px-5 py-2.5 font-semibold text-bg hover:opacity-90 disabled:opacity-50";
const input = "min-w-0 flex-1 rounded-full border border-line bg-bg px-4 py-2.5 outline-none focus:border-ink";

function SignInForm({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "sent">("idle");
  const [error, setError] = useState("");
  const [devLink, setDevLink] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setState("busy");
    setError("");
    try {
      const res = await call<{ devLink?: string }>("/api/auth/start", { method: "POST", body: JSON.stringify({ email, next }) });
      setDevLink(res.devLink ?? "");
      setState("sent");
    } catch (err) {
      setError((err as Error).message);
      setState("idle");
    }
  };

  if (state === "sent") {
    return (
      <div className={card}>
        <h2 className="font-display text-2xl">Check your email</h2>
        <p className="mt-2 text-ink-2">
          We sent a sign-in link to <strong>{email}</strong>. It works once and expires in 20 minutes.
        </p>
        {devLink && (
          <a href={devLink} className="mt-3 inline-block text-brand underline">
            Dev sign-in link
          </a>
        )}
      </div>
    );
  }
  return (
    <form onSubmit={submit} className={card}>
      <label htmlFor="email" className="font-semibold">
        Your email
      </label>
      <p className="mt-1 text-sm text-ink-2">Only the person who pays needs an account. Everyone else just opens the room link.</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className={input} />
        <button className={primary} disabled={state === "busy"}>
          {state === "busy" ? "Sending…" : "Email me a sign-in link"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-brand">{error}</p>}
    </form>
  );
}

function StartPlan({ room }: { room: string }) {
  const [interval, setPeriod] = useState<Interval>("yearly");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const start = async () => {
    setBusy(true);
    setError("");
    try {
      const { url } = await call<{ url: string }>("/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ interval, roomId: room }),
      });
      location.href = url;
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };
  return (
    <section className={card}>
      <h2 className="font-display text-2xl">Start your free trial</h2>
      <p className="mt-2 text-sm text-ink-2">
        Unlimited voters in up to {MAX_PRO_ROOMS} rooms{room ? <>, starting with <span className="font-mono">/{room}</span></> : null}. Free for{" "}
        {TRIAL_DAYS} days, then billed to the card you enter. Cancel before the trial ends and you won't be charged. We email you 3 days
        before.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Billing period">
        {(["monthly", "yearly"] as const).map((k) => (
          <button
            key={k}
            role="radio"
            aria-checked={interval === k}
            onClick={() => setPeriod(k)}
            className={`rounded-2xl border-[1.5px] px-3 py-3 text-left ${interval === k ? "border-ink" : "border-line"}`}
          >
            <span className="block font-semibold">{PRICES[k].label}</span>
            <span className="text-xs text-ink-3">{k === "yearly" ? "Save 25%" : "Cancel any time"}</span>
          </button>
        ))}
      </div>
      {error && <p className="mt-3 text-sm text-brand">{error}</p>}
      <button onClick={start} disabled={busy} className={`mt-4 w-full ${primary}`}>
        {busy ? "Opening checkout…" : `Start ${TRIAL_DAYS}-day free trial`}
      </button>
      <p className="mt-3 text-center text-xs text-ink-3">Secure checkout by Lemon Squeezy, our reseller.</p>
    </section>
  );
}

function PlanSummary({ plan }: { plan: Plan }) {
  const line =
    plan.status === "on_trial"
      ? `Free trial until ${day(plan.trialEndsAt)}, then ${PRICES[plan.interval === "yearly" ? "yearly" : "monthly"].label}.`
      : plan.status === "active"
        ? `Active · renews ${day(plan.renewsAt)}.`
        : plan.status === "cancelled"
          ? `Cancelled · Pro works until ${day(plan.endsAt)}.`
          : plan.status === "past_due"
            ? "Your last payment failed. Please update your card."
            : plan.status === "expired"
              ? "Your plan has ended."
              : `Status: ${plan.status.replace("_", " ")}.`;
  return (
    <section className={card}>
      <p className="eyebrow">Your plan</p>
      <h2 className="mt-1 font-display text-2xl">Pro · {plan.interval === "yearly" ? "Yearly" : "Monthly"}</h2>
      <p className="mt-1 text-ink-2">{line}</p>
      {plan.portalUrl && (
        <a href={plan.portalUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block text-brand underline">
          Manage billing, card and invoices ↗
        </a>
      )}
    </section>
  );
}

function Rooms({ account, suggested, onChange }: { account: Account; suggested: string; onChange: (rooms: string[]) => void }) {
  const [name, setName] = useState(suggested && !account.rooms.includes(suggested) ? suggested : "");
  const [error, setError] = useState("");
  const full = account.rooms.length >= account.maxRooms;

  const add = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const { rooms } = await call<{ rooms: string[] }>("/api/account/rooms", { method: "POST", body: JSON.stringify({ roomId: name }) });
      onChange(rooms);
      setName("");
    } catch (err) {
      setError((err as Error).message);
    }
  };
  const remove = async (room: string) => {
    if (!confirm(`Make /${room} a free room again? You can add it back any time.`)) return;
    const { rooms } = await call<{ rooms: string[] }>(`/api/account/rooms/${encodeURIComponent(room)}`, { method: "DELETE" });
    onChange(rooms);
  };

  return (
    <section className={card}>
      <p className="eyebrow">
        Pro rooms · {account.rooms.length} of {account.maxRooms}
      </p>
      <p className="mt-1 text-sm text-ink-2">Typo in a room name, or switched teams? Remove one and add another. Votes and history stay with each room.</p>
      <ul className="mt-3 divide-y divide-line" data-testid="pro-rooms">
        {account.rooms.map((r) => (
          <li key={r} className="flex items-center justify-between gap-2 py-2">
            <a href={`/r/${r}`} className="font-mono hover:underline">
              /{r}
            </a>
            <button onClick={() => remove(r)} className="text-sm text-ink-3 hover:text-brand">
              Remove
            </button>
          </li>
        ))}
        {account.rooms.length === 0 && <li className="py-2 text-sm text-ink-3">No Pro rooms yet.</li>}
      </ul>
      {account.pro && !full && (
        <form onSubmit={add} className="mt-3 flex flex-col gap-2 sm:flex-row">
          <label htmlFor="add-room" className="sr-only">
            Room name or link
          </label>
          <input id="add-room" value={name} onChange={(e) => setName(e.target.value)} placeholder="team-falcon or the room link" className={input} />
          <button className={primary}>Add room</button>
        </form>
      )}
      {error && <p className="mt-2 text-sm text-brand">{error}</p>}
    </section>
  );
}

export function AccountPage() {
  const params = new URLSearchParams(location.search);
  const room = (params.get("room") ?? "").toLowerCase();
  const [account, setAccount] = useState<Account | null | "out">(null);

  const load = () =>
    call<Account>("/api/account")
      .then(setAccount)
      .catch((err) => (err.status === 401 ? setAccount("out") : setAccount("out")));
  useEffect(() => {
    load();
    // Lemon Squeezy's confirmation can arrive a few seconds after the redirect back.
    if (params.get("welcome")) {
      const t = setInterval(load, 3000);
      setTimeout(() => clearInterval(t), 30000);
      return () => clearInterval(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signOut = async () => {
    await call("/api/auth/logout", { method: "POST" });
    setAccount("out");
  };

  return (
    <Shell>
      <h1 className="font-display text-5xl leading-none">Account</h1>
      <div className="mt-6 space-y-4">
        {account === null && <p className="text-ink-3">Loading…</p>}
        {account === "out" && <SignInForm next={location.pathname + location.search} />}
        {account && account !== "out" && (
          <>
            <p className="text-sm text-ink-2">
              Signed in as <strong>{account.email}</strong> ·{" "}
              <button onClick={signOut} className="underline">
                Sign out
              </button>
            </p>
            {params.get("welcome") && !account.plan && <p className={card}>Thanks! Waiting for {APP_NAME}'s payment confirmation…</p>}
            {account.plan && account.plan.status !== "expired" ? <PlanSummary plan={account.plan} /> : <StartPlan room={room} />}
            <Rooms account={account} suggested={room} onChange={(rooms) => setAccount({ ...account, rooms })} />
            {room && account.rooms.includes(room) && (
              <button onClick={() => navigate(`/r/${room}`)} className={primary}>
                Back to /{room}
              </button>
            )}
          </>
        )}
      </div>
    </Shell>
  );
}

export function SignInPage() {
  const params = new URLSearchParams(location.search);
  const token = params.get("token") ?? "";
  const next = params.get("next") ?? "/account";
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // Signing in takes a click, so email link scanners that open the page don't use up the link.
  const go = async () => {
    setBusy(true);
    try {
      await call("/api/auth/verify", { method: "POST", body: JSON.stringify({ token }) });
      navigate(next.startsWith("/") && !next.startsWith("//") ? next : "/account");
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };
  return (
    <Shell>
      <h1 className="font-display text-5xl leading-none">Sign in</h1>
      <div className={`mt-6 ${card}`}>
        <p className="text-ink-2">Continue to your {APP_NAME} account.</p>
        <button onClick={go} disabled={busy || !token} className={`mt-4 ${primary}`}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
        {error && (
          <p className="mt-3 text-sm text-brand">
            {error}{" "}
            <a href="/account" className="underline">
              Get a new link
            </a>
          </p>
        )}
      </div>
    </Shell>
  );
}
