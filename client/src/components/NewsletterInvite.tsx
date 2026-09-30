import { useState } from 'react';
import { apiFetch } from '../api';

interface SubState {
  active: boolean;
  confirmedAt: string | null;
  unsubscribedAt?: string | null;
}

interface Props {
  personId: string;
  newsletter: SubState | null;
  lists: SubState[];
  onInvited?: () => void;
}

/**
 * "Invite to newsletter" for people we've corresponded with. The server enforces the rules
 * (double opt-in, 1/hour, never re-invite someone who unsubscribed); this only picks the label.
 */
export default function NewsletterInvite({ personId, newsletter, lists, onInvited }: Props) {
  const [status, setStatus] = useState<{ text: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const confirmed = !!(newsletter?.active && newsletter.confirmedAt && lists.some((l) => l.active && l.confirmedAt));
  const unsubscribedAt =
    (newsletter && !newsletter.active && newsletter.unsubscribedAt) ||
    lists.find((l) => !l.active && l.unsubscribedAt)?.unsubscribedAt ||
    null;

  if (confirmed) return null;
  if (unsubscribedAt) {
    return (
      <div style={styles.note}>
        Unsubscribed {new Date(unsubscribedAt).toLocaleDateString()}. Not invited again; they can resubscribe on the website.
      </div>
    );
  }

  const pending = !!newsletter || lists.length > 0;

  async function invite() {
    setBusy(true);
    setStatus(null);
    try {
      const r = await apiFetch<{ result: string; message: string }>(`/api/people/${personId}/invite`, { method: 'POST' });
      setStatus({ text: r.message, ok: true });
      onInvited?.();
    } catch (err) {
      setStatus({ text: err instanceof Error ? err.message : 'Invite failed', ok: false });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: 8 }}>
      <button onClick={invite} disabled={busy} style={styles.btn}
        title="Sends an invitation email with a confirm button. Nothing changes unless they confirm.">
        {busy ? 'Sending…' : pending ? 'Resend newsletter invite' : 'Invite to newsletter'}
      </button>
      {status && <div style={{ ...styles.note, color: status.ok ? '#2d4a2d' : '#b22' }}>{status.text}</div>}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  btn: { background: 'white', border: '1px solid #2d4a2d', color: '#2d4a2d', borderRadius: 4, padding: '0.3rem 0.75rem', fontSize: '0.78rem', cursor: 'pointer' },
  note: { fontSize: '0.75rem', color: '#888', marginTop: 6, lineHeight: 1.4 },
};
