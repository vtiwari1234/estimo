import { useState, type FormEvent } from "react";
import { navigate } from "../App";
import { Footer } from "../components/Footer";
import { Logo } from "../components/Logo";
import { CardBack, PlayingCard } from "../components/PlayingCard";
import { ThemeToggle } from "../components/ThemeToggle";
import { randomRoomName, slugify } from "../lib/identity";
import { ROOM_ID_PATTERN } from "../../shared/protocol";
import { BRAND, EDITION } from "../brand";

const FEATURES = [
  ["Backlog in, estimates out", "Paste a list from Jira or a spreadsheet and work it top to bottom."],
  ["Blind until the flip", "Cards stay face down until everyone has played, so nobody anchors."],
  ["Outliers speak first", "The highest and lowest votes are called out, so the talk starts in the right place."],
  ["A ledger you can export", "Every round is recorded. One click turns the session into a CSV for your tracker."],
];

const STEPS = [
  ["Read the story", "Someone reads it out. The team asks questions until it's clear."],
  ["Play a card", "Everyone picks a card in private. Spectators can watch."],
  ["Flip together", "All cards turn at once. If they match, that's the estimate."],
  ["Talk, then replay", "If they don't, the outliers explain and the table votes again."],
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
    <div className="min-h-dvh overflow-x-hidden">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-5 sm:px-8">
          <Logo />
          <div className="flex-1" />
          <a href="#how" className="hidden text-sm text-ink-2 hover:text-ink sm:block">
            How it works
          </a>
          <a href="#features" className="hidden text-sm text-ink-2 hover:text-ink sm:block">
            Features
          </a>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-8">
        <section className="grid items-center gap-8 py-12 md:grid-cols-[1.1fr_1fr] md:py-16">
          <div>
            <p className="eyebrow">Planning poker for agile teams</p>
            <h1 className="mt-6 font-display text-[56px] leading-[0.95] tracking-[-0.02em] sm:text-[80px] lg:text-[88px]">
              Estimate together.
              <br />
              <em className="text-brand">Flip at once.</em>
            </h1>
            <p className="mt-6 max-w-[34rem] text-lg leading-relaxed text-ink-2">
              {BRAND} is a {EDITION === "pro" ? "private" : "free"}, real-time planning poker room. Bring your backlog, vote in private, reveal together and
              keep a record of every estimate.
            </p>

            <form onSubmit={create} className="mt-9 max-w-[34rem]">
              <label htmlFor="room-name" className="sr-only">
                Room name
              </label>
              <div className="flex items-center gap-3 border-b-[1.5px] border-ink pb-2.5">
                <span className="hidden font-mono text-sm text-ink-3 sm:inline">/r/</span>
                <input
                  id="room-name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setError("");
                  }}
                  placeholder="your-team-name"
                  className="min-w-0 flex-1 bg-transparent text-xl font-medium outline-none placeholder:text-ink-3/60"
                />
                <button className="shrink-0 rounded-full bg-brand px-5 py-2.5 text-[15px] font-semibold text-white transition hover:brightness-110">
                  Create room →
                </button>
              </div>
              <p className="mt-2 text-xs text-ink-3">
                {name.trim() ? (
                  <>
                    Your link: <b className="font-mono">/r/{slugify(name)}</b>, the same every sprint.
                  </>
                ) : (
                  "Leave it blank for a random name, or use your team name to keep the same link every sprint."
                )}
              </p>
            </form>

            <form onSubmit={goJoin} className="mt-6 flex max-w-[34rem] items-center gap-2">
              <label htmlFor="join" className="shrink-0 text-sm text-ink-2">
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
                className="min-w-0 flex-1 rounded-full border border-line bg-surface px-4 py-2 text-sm outline-none focus:border-ink"
              />
              <button className="rounded-full border-[1.5px] border-ink px-4 py-2 text-sm font-semibold hover:bg-ink hover:text-bg">
                Join
              </button>
            </form>
            {error && <p className="mt-2 text-sm text-danger">{error}</p>}

            <div className="mt-8 flex gap-7 text-sm text-ink-2">
              {[
                ["0", "sign-ups"],
                ["0", "ads"],
                ["∞", "players"],
              ].map(([n, l]) => (
                <span key={l}>
                  <b className="mr-1 font-display text-2xl font-normal text-ink">{n}</b>
                  {l}
                </span>
              ))}
            </div>
          </div>

          <HeroCards />
        </section>

        <section id="features" className="grid border-t border-line sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(([title, body], i) => (
            <div key={title} className="border-line py-7 sm:px-6 sm:first:pl-0 lg:border-l lg:first:border-l-0">
              <p className="font-mono text-xs text-brand">0{i + 1}</p>
              <h2 className="mt-1 font-display text-[28px] leading-tight">{title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">{body}</p>
            </div>
          ))}
        </section>

        <section id="how" className="mt-16 grid gap-10 rounded-[28px] felt p-8 text-[#efe7d6] sm:p-12 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <p className="font-mono text-[11px] tracking-[0.18em] text-[#efe7d6]/60 uppercase">How a round works</p>
            <h2 className="mt-3 font-display text-5xl leading-none sm:text-6xl">
              Four steps,
              <br />
              <em className="text-[#f3d48c]">no anchoring.</em>
            </h2>
          </div>
          <ol className="grid gap-6 sm:grid-cols-2">
            {STEPS.map(([title, body], i) => (
              <li key={title} className="flex gap-4">
                <span className="font-display text-4xl leading-none text-[#f3d48c]">{i + 1}</span>
                <span>
                  <b className="block font-display text-2xl font-normal">{title}</b>
                  <span className="text-sm text-[#efe7d6]/75">{body}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <Footer />
    </div>
  );
}

function HeroCards() {
  const fan: [string, number, number, number][] = [
    ["3", -18, 2, 60],
    ["5", -7, 18, 20],
    ["8", 4, 36, 10],
    ["13", 15, 53, 45],
  ];
  return (
    <div aria-hidden className="relative mx-auto h-[360px] w-full max-w-[520px] sm:h-[460px]">
      <div className="absolute inset-0 origin-top-left scale-[0.72] sm:scale-100">
        {fan.map(([v, r, x, y]) => (
          <PlayingCard key={v} value={v} size="lg" className="absolute" style={{ left: `${x}%`, top: y, transform: `rotate(${r}deg)` }} />
        ))}
        <div className="absolute" style={{ left: "30%", top: 250, transform: "rotate(-2deg)" }}>
          <CardBack size="lg" />
        </div>
        <div
          className="absolute w-[200px] border border-line bg-surface px-4 py-3 shadow-[0_14px_30px_-18px_rgb(0_0_0/0.45)]"
          style={{ left: "62%", top: 300, transform: "rotate(3deg)" }}
        >
          <p className="eyebrow !text-[10px]">Verdict</p>
          <p className="font-display text-[34px] leading-tight">8 points</p>
          <p className="text-xs text-ink-2">avg 7.3 · 2 rounds · consensus</p>
        </div>
      </div>
    </div>
  );
}
