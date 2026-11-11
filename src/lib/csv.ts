import type { RoomView } from "../../shared/protocol";

function cell(value: unknown): string {
  const s = value === undefined || value === null ? "" : String(value);
  // Neutralise spreadsheet formulas and quote anything with separators.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** One row per estimated or skipped story, ready to paste into Jira or a sheet. */
export function sessionCsv(room: RoomView): string {
  const header = ["Story", "Link", "Status", "Estimate", "Rounds", "Final votes", "Average", "Median", "Estimated at"];
  const rows = room.stories
    .filter((s) => s.status !== "pending" || s.rounds.length > 0)
    .map((s) => {
      const last = s.rounds[s.rounds.length - 1];
      const votes = last
        ? Object.entries(last.votes)
            .map(([id, card]) => `${last.names[id] ?? "?"}: ${card}`)
            .join("; ")
        : "";
      return [
        s.title,
        s.link ?? "",
        s.status,
        s.estimate ?? "",
        s.rounds.length,
        votes,
        last?.stats.average ?? "",
        last?.stats.median ?? "",
        s.estimatedAt ? new Date(s.estimatedAt).toISOString() : "",
      ];
    });
  return [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}

export function downloadCsv(room: RoomView) {
  const blob = new Blob([sessionCsv(room)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `estimo-${room.id}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Splits pasted text into stories: one per line, URLs pulled out as links. */
export function parseStoryLines(text: string): { title: string; link?: string }[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "").trim())
    .filter(Boolean)
    .map((line) => {
      const cols = line.split("\t").map((c) => c.trim()).filter(Boolean);
      const joined = cols.join(" — ");
      const url = joined.match(/https?:\/\/\S+/)?.[0];
      const title = (url ? joined.replace(url, "") : joined).replace(/\s*[—-]\s*$/, "").replace(/^\s*[—-]\s*/, "").trim();
      return { title: title || url || joined, link: url };
    });
}
