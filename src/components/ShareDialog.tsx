import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { Modal } from "./Modal";

export function ShareDialog({ roomId, onClose }: { roomId: string; onClose: () => void }) {
  const url = `${location.origin}/r/${roomId}`;
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    QRCode.toDataURL(url, { margin: 1, width: 240, color: { dark: "#1c1917", light: "#ffffff" } })
      .then(setQr)
      .catch(() => setQr(null));
  }, [url]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked; the link is selectable below.
    }
  };

  return (
    <Modal title="Invite your team" onClose={onClose}>
      <p className="text-sm text-ink-2">Anyone with this link can join. No account needed.</p>
      <div className="mt-3 flex gap-2">
        <input readOnly value={url} onFocus={(e) => e.target.select()} className="min-w-0 flex-1 rounded-xl border border-line bg-bg px-3 py-2 text-sm" />
        <button onClick={copy} className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-brand-ink">
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {qr && (
        <div className="mt-5 flex flex-col items-center gap-2">
          <img src={qr} alt={`QR code for ${url}`} className="size-48 rounded-xl border border-line bg-white p-2" />
          <p className="text-xs text-ink-3">Scan to join from a phone</p>
        </div>
      )}
    </Modal>
  );
}
