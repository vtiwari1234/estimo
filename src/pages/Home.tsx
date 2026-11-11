import { useState, type FormEvent } from "react";
import { navigate } from "../App";
import { Logo } from "../components/Logo";
import { ThemeToggle } from "../components/ThemeToggle";
import { randomRoomName, slugify } from "../lib/identity";
import { ROOM_ID_PATTERN } from "../../shared/protocol";
import { BRAND } from "../brand";
import { Footer } from "../components/Footer";

const FEATURES = [
  ["Story queue", "Paste your backlog and work through it one item at a time."],
  ["Honest reveals", "Cards stay face down until everyone flips together, so nobody anchors."],
  ["Results that help", "Average, median, spread and consensus, with the outliers called out."],
  ["Timer and roles", "Time-box discussion. Product owners can watch without voting."],
  ["History and CSV", "Every estimate is saved. Export the session for Jira or a sheet."],
  ["Free, no sign-up", "Share a link or QR code. Works on phones. No ads, ever."],
];

export function Home() {
  const [name, setName] = useState("");
  const [join, setJoin] = useState("");
  const [error, setError] = useState("");

  const create = (e: FormEvent) => {
    e.preventDefault();
    const slug = name.trim() ? slugify(name) : randomRoomName();
    if (!ROOM_ID_PATTERN.test(slug)) return setError("Room names need 3 to 40 letters, numbers or dashes.");
    navigate(`/r/${slug}`);
  };

  const goJoin = (e: FormEvent) => {
    e.preventDefault();
    const raw = join.trim();
    const fromUrl = raw.match(/\/r\/([^/?#]+)/)?.[1];
    const slug = slugify(fromUrl ? decodeURIComponent(fromUrl) : raw);
    if (!ROOM_ID_PATTERN.test(slug)) return setError("That doesn't look like a room name or link.");
    navigate(`/r/${slug}`);
  };

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
        <Logo />
        <ThemeToggle />
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-16 sm:px-6">
        <section className="grid items-center gap-10 py-8 md:grid-cols-[1.1fr_1fr] md:py-14">
          <div>
            <p className="mb-3 inline-block rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold tracking-wide text-ink-2 uppercase">
              Planning poker for agile teams
            </p>
            <h1 className="font-display text-4xl leading-[1.05] font-extrabold tracking-tight sm:text-5xl">
              Estimate together. <span className="text-brand">Flip at once.</span>
            </h1>
            <p className="mt-4 max-w-md text-lg text-ink-2">
              {BRAND} is a free, real-time planning poker room. Bring your backlog, vote in private, reveal together and
              keep a record of every estimate.
            </p>

            <form onSubmit={create} className="mt-8 rounded-2xl border border-line bg-surface p-4 shadow-sm">
              <label htmlFor="room-name" className="text-sm font-semibold">
                Start a room
              </label>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <input
                  id="room-name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setError("");
                  }}
                  placeholder="Team name (optional)"
                  className="min-w-0 flex-1 rounded-xl border border-line bg-bg px-3 py-2.5 outline-none focus:border-brand"
                />
                <button className="rounded-xl bg-brand px-5 py-2.5 font-semibold text-brand-ink hover:opacity-90">
                  Create room
                </button>
              </div>
              <p className="mt-2 text-xs text-ink-3">
                Use a team name to get the same link every sprint{name.trim() && <>: <b>/r/{slugify(name)}</b></>}
              </p>
            </form>

            <form onSubmit={goJoin} className="mt-3 flex flex-col gap-2 px-1 sm:flex-row sm:items-center">
              <label htmlFor="join" className="text-sm text-ink-2">
                Have a link?
              </label>
              <input
                id="join"
                value={join}
                onChange={(e) => {
                  setJoin(e.target.value);
                  setError("");
                }}
                placeholder="Room name or link"
                className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
              />
              <button className="rounded-xl border border-line bg-surface px-4 py-2 text-sm font-semibold hover:bg-surface-2">
                Join
              </button>
            </form>
            {error && <p className="mt-2 px-1 text-sm text-danger">{error}</p>}
          </div>

          <HeroTable />
        </section>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(([title, body]) => (
            <div key={title} className="rounded-2xl border border-line bg-surface p-5">
              <h2 className="font-display text-lg font-bold">{title}</h2>
              <p className="mt-1 text-sm text-ink-2">{body}</p>
            </div>
          ))}
        </section>

        <section className="mt-12 rounded-2xl border border-line bg-surface p-6">
          <h2 className="font-display text-xl font-bold">How planning poker works</h2>
          <ol className="mt-3 grid gap-3 text-sm text-ink-2 sm:grid-cols-4">
            {[
              "Read out a story and answer questions about it.",
              "Everyone picks a card in private.",
              "Flip all cards at once. If they agree, that's your estimate.",
              "If not, the highest and lowest explain, then vote again.",
            ].map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-soft font-display font-bold text-brand">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <Footer />
    </div>
  );
}

function HeroTable() {
  const cards = [
    { v: "5", name: "Priya", rot: -8 },
    { v: "8", name: "Sam", rot: 4 },
    { v: "5", name: "Lee", rot: -2 },
    { v: "5", name: "Noor", rot: 7 },
  ];
  return (
    <div aria-hidden className="felt relative mx-auto aspect-[4/3] w-full max-w-md rounded-[2rem] p-6 shadow-xl">
      <div className="absolute inset-3 rounded-[1.6rem] border border-white/10" />
      <div className="relative flex h-full flex-col items-center justify-center gap-5">
        <div className="flex gap-3">
          {cards.map((c) => (
            <div key={c.name} className="flex flex-col items-center gap-2" style={{ transform: `rotate(${c.rot}deg)` }}>
              <div className="grid h-24 w-16 place-items-center rounded-xl bg-white font-display text-3xl font-extrabold text-stone-900 shadow-lg sm:h-28 sm:w-20">
                {c.v}
              </div>
              <span className="text-xs font-medium text-white/80">{c.name}</span>
            </div>
          ))}
        </div>
        <div className="rounded-full bg-white/10 px-4 py-1.5 text-sm text-white">
          Average 5.8 · Suggested <b className="text-amber-300">5</b>
        </div>
      </div>
    </div>
  );
}
