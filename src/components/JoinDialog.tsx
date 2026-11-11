import { useState, type FormEvent } from "react";
import { AVATAR_COLORS, MAX_NAME, type Role } from "../../shared/protocol";
import type { Profile } from "../lib/identity";
import { Avatar } from "./Avatar";
import { Modal } from "./Modal";

export function ProfileForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial: Profile | null;
  submitLabel: string;
  onSubmit: (p: Profile) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [color, setColor] = useState(initial?.color ?? AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]);
  const [role, setRole] = useState<Role>(initial?.role ?? "voter");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim()) onSubmit({ name: name.trim(), color, role });
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <label htmlFor="your-name" className="text-sm font-semibold">
          Your name
        </label>
        <div className="mt-2 flex items-center gap-3">
          <Avatar name={name || "?"} color={color} size={40} />
          <input
            id="your-name"
            autoFocus
            maxLength={MAX_NAME}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Priya"
            className="min-w-0 flex-1 rounded-xl border border-line bg-bg px-3 py-2.5 outline-none focus:border-brand"
          />
        </div>
      </div>

      <fieldset>
        <legend className="text-sm font-semibold">Colour</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {AVATAR_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              aria-label={`Colour ${c}`}
              aria-pressed={c === color}
              className="size-8 rounded-full ring-offset-2 ring-offset-surface aria-pressed:ring-2 aria-pressed:ring-ink"
              style={{ background: c }}
            />
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-semibold">Join as</legend>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {(
            [
              ["voter", "Voter", "Pick cards each round"],
              ["spectator", "Spectator", "Watch and run the session"],
            ] as const
          ).map(([value, label, hint]) => (
            <button
              key={value}
              type="button"
              onClick={() => setRole(value)}
              aria-pressed={role === value}
              className="rounded-xl border border-line p-3 text-left aria-pressed:border-brand aria-pressed:bg-brand-soft"
            >
              <span className="block font-semibold">{label}</span>
              <span className="block text-xs text-ink-2">{hint}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <button
        disabled={!name.trim()}
        className="w-full rounded-xl bg-brand py-3 font-semibold text-brand-ink hover:opacity-90 disabled:opacity-40"
      >
        {submitLabel}
      </button>
    </form>
  );
}

export function JoinDialog({ roomId, initial, onJoin }: { roomId: string; initial: Profile | null; onJoin: (p: Profile) => void }) {
  return (
    <Modal title={`Join ${roomId}`}>
      <ProfileForm initial={initial} submitLabel="Join room" onSubmit={onJoin} />
    </Modal>
  );
}
