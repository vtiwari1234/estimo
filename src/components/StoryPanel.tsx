import { useState } from "react";
import { cardValue } from "../../shared/decks";
import type { ClientMessage, RoomView, Story } from "../../shared/protocol";
import { downloadCsv, parseStoryLines } from "../lib/csv";

type Tab = "queue" | "history";

export function StoryPanel({ room, canControl, send }: { room: RoomView; canControl: boolean; send: (m: ClientMessage) => void }) {
  const [tab, setTab] = useState<Tab>("queue");
  const queue = room.stories.filter((s) => s.status !== "estimated");
  const done = room.stories.filter((s) => s.status === "estimated");

  return (
    <aside className="flex min-h-0 flex-col overflow-hidden rounded-[22px] border border-line bg-surface">
      <div className="flex items-baseline justify-between px-5 pt-5 pb-3">
        <h2 className="font-display text-[32px] leading-none">The ledger</h2>
        <LedgerTotal room={room} />
      </div>
      <div role="tablist" className="mx-4 mb-1 flex gap-1 rounded-full bg-surface-2 p-1">
        {(
          [
            ["queue", `Stories (${queue.length})`],
            ["history", `Estimated (${done.length})`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className="flex-1 rounded-full px-3 py-1.5 text-sm font-medium text-ink-2 transition aria-selected:bg-surface aria-selected:text-ink aria-selected:shadow-sm"
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "queue" ? (
        <Queue room={room} stories={queue} canControl={canControl} send={send} />
      ) : (
        <History room={room} stories={done} canControl={canControl} send={send} />
      )}
    </aside>
  );
}

function Queue({ room, stories, canControl, send }: { room: RoomView; stories: Story[]; canControl: boolean; send: (m: ClientMessage) => void }) {
  const [text, setText] = useState("");
  const [adding, setAdding] = useState(room.stories.length === 0);
  const add = () => {
    const parsed = parseStoryLines(text);
    if (parsed.length === 0) return;
    send({ type: "addStories", stories: parsed });
    setText("");
    setAdding(false);
  };
  const indexOf = (id: string) => room.stories.findIndex((s) => s.id === id);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ul className="min-h-0 flex-1 overflow-y-auto py-2" aria-label="Story queue">
        {stories.length === 0 && (
          <li className="px-6 py-8 text-center text-sm leading-relaxed text-ink-3">
            <span className="mb-2 block font-display text-2xl text-ink-2">An empty ledger.</span>
            Add your backlog below, or just vote. Each saved round becomes a quick round.
          </li>
        )}
        {stories.map((s) => {
          const current = s.id === room.currentStoryId;
          return (
            <li
              key={s.id}
              className={`group flex items-start gap-3 border-t border-line px-5 py-3 first:border-t-0 ${current ? "bg-brand-soft shadow-[inset_3px_0_0_var(--brand)]" : "hover:bg-surface-2"}`}
            >
              <button
                disabled={!canControl || current}
                onClick={() => send({ type: "selectStory", storyId: s.id })}
                className="min-w-0 flex-1 text-left disabled:cursor-default"
                title={current ? "Voting on this now" : "Vote on this story"}
              >
                <span className="block text-[15px] break-words">{s.title}</span>
                <span className="font-mono text-[11px] text-ink-3">
                  {current ? "on the table" : s.status === "skipped" ? "skipped" : `#${indexOf(s.id) + 1}`}
                </span>
              </button>
              {s.link && (
                <a href={s.link} target="_blank" rel="noreferrer" className="text-xs text-brand hover:underline" title="Open link">
                  ↗
                </a>
              )}
              {canControl && (
                <span className="flex gap-0.5 opacity-60 group-hover:opacity-100">
                  <IconButton label="Move up" onClick={() => send({ type: "moveStory", storyId: s.id, toIndex: indexOf(s.id) - 1 })}>
                    ↑
                  </IconButton>
                  <IconButton label="Move down" onClick={() => send({ type: "moveStory", storyId: s.id, toIndex: indexOf(s.id) + 1 })}>
                    ↓
                  </IconButton>
                  <IconButton label="Remove story" onClick={() => send({ type: "removeStory", storyId: s.id })}>
                    ✕
                  </IconButton>
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {canControl && (
        <div className="border-t border-line p-4">
          {adding ? (
            <div>
              <label htmlFor="stories" className="text-sm font-semibold">
                Add stories
              </label>
              <textarea
                id="stories"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === "Enter" && add()}
                rows={4}
                placeholder={"One per line. Paste from Jira or a sheet.\nPROJ-12 Login with Google https://…\nPROJ-13 Export to CSV"}
                className="mt-2 w-full resize-y rounded-xl border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-ink"
              />
              <div className="mt-2 flex gap-2">
                <button onClick={add} disabled={!text.trim()} className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-bg disabled:opacity-40">
                  Add {parseStoryLines(text).length || ""}
                </button>
                {room.stories.length > 0 && (
                  <button onClick={() => setAdding(false)} className="rounded-full px-3 py-2 text-sm text-ink-2 hover:bg-surface-2">
                    Cancel
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => setAdding(true)} className="flex-1 rounded-full border border-dashed border-ink-3/60 py-2 text-sm font-medium text-ink-2 hover:bg-surface-2">
                + Add stories
              </button>
              {room.currentStoryId && (
                <button onClick={() => send({ type: "skip" })} className="rounded-full border border-line px-4 py-2 text-sm font-medium text-ink-2 hover:bg-surface-2">
                  Skip current
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function History({ room, stories, canControl, send }: { room: RoomView; stories: Story[]; canControl: boolean; send: (m: ClientMessage) => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const numeric = stories.map((s) => cardValue(s.estimate ?? "")).filter((n): n is number => n !== null);
  const total = numeric.reduce((a, b) => a + b, 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ul className="min-h-0 flex-1 overflow-y-auto py-2" aria-label="Estimated stories">
        {stories.length === 0 && <li className="px-6 py-8 text-center text-sm text-ink-3">Saved estimates will show up here.</li>}
        {stories.map((s) => {
          const last = s.rounds[s.rounds.length - 1];
          return (
            <li key={s.id} className="border-t border-line px-5 py-3 first:border-t-0 hover:bg-surface-2">
              <button onClick={() => setOpen(open === s.id ? null : s.id)} className="flex w-full items-start gap-3 text-left" aria-expanded={open === s.id}>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] break-words">{s.title}</span>
                  <span className="block font-mono text-[11px] text-ink-3">
                    {s.rounds.length} round{s.rounds.length === 1 ? "" : "s"}
                    {last?.stats.consensus ? " · consensus" : ""}
                  </span>
                </span>
                <span className="font-display text-[32px] leading-none">{s.estimate}</span>
              </button>
              {open === s.id && (
                <div className="mt-2 space-y-2 text-xs text-ink-2">
                  {s.rounds.map((r, i) => (
                    <div key={i}>
                      <b>Round {i + 1}:</b>{" "}
                      {Object.entries(r.votes)
                        .map(([id, c]) => `${r.names[id] ?? "?"} ${c}`)
                        .join(", ")}
                      {r.stats.average !== null && ` · avg ${r.stats.average}`}
                    </div>
                  ))}
                  <div className="flex gap-3">
                    {s.link && (
                      <a href={s.link} target="_blank" rel="noreferrer" className="font-semibold text-brand hover:underline">
                        Open link
                      </a>
                    )}
                    {canControl && (
                      <button onClick={() => send({ type: "reopenStory", storyId: s.id })} className="font-semibold text-brand hover:underline">
                        Re-estimate
                      </button>
                    )}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <div className="flex items-center justify-between gap-2 border-t border-line px-5 py-3">
        <span className="text-sm text-ink-2">{numeric.length > 0 && <>Total: <b className="font-display text-xl font-normal text-ink">{Math.round(total * 10) / 10}</b> points</>}</span>
        <button
          onClick={() => downloadCsv(room)}
          disabled={room.stories.length === 0}
          className="text-sm font-semibold text-brand hover:underline disabled:opacity-40"
        >
          Export CSV ↓
        </button>
      </div>
    </div>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: string }) {
  return (
    <button onClick={onClick} aria-label={label} title={label} className="grid size-6 place-items-center rounded-md text-xs text-ink-3 hover:bg-line hover:text-ink">
      {children}
    </button>
  );
}

function LedgerTotal({ room }: { room: RoomView }) {
  const total = room.stories
    .filter((s) => s.status === "estimated")
    .map((s) => cardValue(s.estimate ?? ""))
    .reduce<number>((a, n) => a + (n ?? 0), 0);
  return total > 0 ? <span className="font-mono text-xs text-ink-3">{Math.round(total * 10) / 10} pts so far</span> : null;
}
