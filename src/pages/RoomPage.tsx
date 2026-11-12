import { useState } from "react";
import { REACTIONS } from "../../shared/protocol";
import { Avatar } from "../components/Avatar";
import { Hand } from "../components/Hand";
import { JoinDialog, ProfileForm } from "../components/JoinDialog";
import { Logo } from "../components/Logo";
import { Modal } from "../components/Modal";
import { PlanBar } from "../components/PlanBar";
import { Results } from "../components/Results";
import { SettingsDialog } from "../components/SettingsDialog";
import { ShareDialog } from "../components/ShareDialog";
import { StoryPanel } from "../components/StoryPanel";
import { Table } from "../components/Table";
import { ThemeToggle } from "../components/ThemeToggle";
import { Timer } from "../components/Timer";
import { loadProfile, saveProfile, type Profile } from "../lib/identity";
import { useRoom } from "../lib/useRoom";
import { BRAND } from "../brand";

type Dialog = "share" | "settings" | "profile" | null;

export function RoomPage({ roomId }: { roomId: string }) {
  const [profile, setProfile] = useState<Profile | null>(loadProfile);
  const [confirmed, setConfirmed] = useState(() => profile !== null);
  const { room, status, send, me, reactions, toasts, clockOffset } = useRoom(roomId, confirmed ? profile : null);
  const [dialog, setDialog] = useState<Dialog>(null);

  if (!confirmed || !profile) {
    return (
      <div className="min-h-dvh">
        <JoinDialog
          roomId={roomId}
          initial={profile}
          onJoin={(p) => {
            saveProfile(p);
            setProfile(p);
            setConfirmed(true);
          }}
        />
      </div>
    );
  }

  if (status === "kicked") {
    return (
      <Modal title="You were removed">
        <p className="text-sm text-ink-2">The host removed you from this room.</p>
        <a href="/" className="mt-4 inline-block rounded-full bg-ink px-5 py-2 font-semibold text-bg">
          Back to {BRAND}
        </a>
      </Modal>
    );
  }

  if (!room) {
    return (
      <div className="grid min-h-dvh place-items-center text-ink-2">
        <p className="animate-pulse font-display text-2xl">{status === "reconnecting" ? "Can't reach the room, retrying…" : "Joining room…"}</p>
      </div>
    );
  }

  const meP = room.participants[me];
  const isHost = room.hostId === me;
  const canControl = room.settings.openControls || isHost;
  const current = room.stories.find((s) => s.id === room.currentStoryId);
  const myVote = room.votes[me];
  const mine = typeof myVote === "string" ? myVote : null;
  const voteCount = Object.keys(room.votes).length;

  const storyIndex = current ? room.stories.findIndex((st) => st.id === current.id) + 1 : 0;
  const round = room.previousRounds.length + 1;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1240px] items-center gap-2 px-3 py-3 sm:gap-3 sm:px-8">
          <Logo compact />
          <div className="min-w-0 flex-1 pl-1">
            <h1 className="truncate font-mono text-sm text-ink-2">/{room.id}</h1>
            <p className="flex items-center gap-1.5 text-xs text-ink-3">
              <span className={`size-1.5 rounded-full ${status === "open" ? "bg-[#3f9b62]" : "bg-accent"}`} />
              {status === "open" ? `${room.online.length} online` : "Reconnecting…"}
              <span className="hidden sm:inline">· {BRAND}</span>
            </p>
          </div>
          <button
            onClick={() => setDialog("settings")}
            className="hidden rounded-full border-[1.5px] border-ink px-4 py-1.5 text-sm font-semibold hover:bg-ink hover:text-bg sm:block"
          >
            Settings
          </button>
          <button
            onClick={() => setDialog("settings")}
            aria-label="Room settings"
            title="Room settings"
            className="grid size-9 place-items-center rounded-full border border-line bg-surface sm:hidden"
          >
            ⚙
          </button>
          <button onClick={() => setDialog("share")} className="rounded-full bg-ink px-4 py-1.5 text-sm font-semibold text-bg hover:opacity-90 sm:py-2">
            Invite
          </button>
          <ThemeToggle />
          {meP && (
            <button onClick={() => setDialog("profile")} title="Your profile" aria-label="Your profile" className="rounded-full">
              <Avatar name={meP.name} color={meP.color} size={34} />
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-[1240px] flex-1 gap-6 px-3 py-6 sm:px-8 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-5">
          <section className="flex flex-wrap items-end gap-x-6 gap-y-3">
            <div className="min-w-0 flex-1">
              <p className="eyebrow">
                {current ? `Story ${storyIndex} of ${room.stories.length}` : "Quick round"} · Round {round}
              </p>
              <h2 className="mt-2 font-display text-[40px] leading-[0.95] break-words sm:text-[54px]" data-testid="current-story">
                {current ? current.title : "Vote on anything."}
              </h2>
              {current?.link ? (
                <a href={current.link} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-brand hover:underline">
                  Open ticket ↗
                </a>
              ) : (
                !current && <p className="mt-2 text-sm text-ink-2">No story selected. Add your backlog to the ledger, or just play a round.</p>
              )}
            </div>
            <Timer room={room} offset={clockOffset} canControl={canControl} send={send} />
          </section>

          <PlanBar room={room} isHost={isHost} />

          <Table room={room} me={me} />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {canControl && !room.revealed && (
                <button
                  onClick={() => send({ type: "reveal" })}
                  disabled={voteCount === 0}
                  className="rounded-full bg-brand px-6 py-3 font-semibold text-white shadow-[0_10px_24px_-12px_var(--brand)] transition hover:brightness-110 disabled:opacity-40 disabled:shadow-none"
                >
                  Reveal cards
                </button>
              )}
              {canControl && room.revealed && (
                <button
                  onClick={() => send({ type: "hide" })}
                  className="rounded-full border-[1.5px] border-ink px-5 py-3 font-semibold hover:bg-ink hover:text-bg"
                >
                  Hide cards
                </button>
              )}
              {canControl && voteCount > 0 && (
                <button
                  onClick={() => send({ type: "clear" })}
                  title="Clear everyone's estimates and start this round over"
                  className="rounded-full px-4 py-3 font-semibold text-ink-2 hover:bg-surface-2"
                >
                  Reset
                </button>
              )}
              {!canControl && !room.revealed && <p className="text-sm text-ink-3">The host will reveal the cards.</p>}
            </div>
            <div className="flex gap-0.5 rounded-full border border-line bg-surface p-1" aria-label="Send a reaction">
              {REACTIONS.map((e) => (
                <button
                  key={e}
                  onClick={() => send({ type: "react", emoji: e })}
                  className="grid size-9 place-items-center rounded-full text-lg transition hover:scale-110 hover:bg-surface-2"
                  aria-label={`React ${e}`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          {room.revealed && room.stats && <Results room={room} canControl={canControl} send={send} />}
        </div>

        <div className="lg:sticky lg:top-24 lg:max-h-[calc(100dvh-8rem)] lg:self-start">
          <StoryPanel room={room} canControl={canControl} send={send} />
        </div>
      </main>

      {meP?.role === "voter" && !room.revealed && (
        <div className="sticky bottom-0 z-20">
          <Hand
            room={room}
            mine={mine}
            send={send}
          />
        </div>
      )}

      <div aria-hidden className="pointer-events-none fixed inset-x-0 bottom-24 z-40 h-0">
        {reactions.map((r) => (
          <span key={r.key} className="float-up absolute text-4xl" style={{ left: `${r.left}%` }}>
            {r.emoji}
            <span className="block text-center text-[10px] font-semibold text-ink-2">{room.participants[r.from]?.name}</span>
          </span>
        ))}
      </div>

      <div className="fixed inset-x-0 top-16 z-50 flex flex-col items-center gap-2 px-4" aria-live="assertive">
        {toasts.map((t) => (
          <div key={t.key} className="rounded-full bg-ink px-5 py-2 text-sm text-bg shadow-lg">
            {t.text}
          </div>
        ))}
      </div>

      {dialog === "share" && <ShareDialog roomId={room.id} onClose={() => setDialog(null)} />}
      {dialog === "settings" && <SettingsDialog room={room} me={me} send={send} onClose={() => setDialog(null)} />}
      {dialog === "profile" && (
        <Modal title="Your profile" onClose={() => setDialog(null)}>
          <ProfileForm
            initial={profile}
            submitLabel="Save"
            onSubmit={(p) => {
              saveProfile(p);
              setProfile(p);
              send({ type: "profile", name: p.name, color: p.color, role: p.role });
              setDialog(null);
            }}
          />
        </Modal>
      )}
    </div>
  );
}
