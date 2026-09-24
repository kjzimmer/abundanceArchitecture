import { useEffect, useState } from 'react';
import { apiFetch } from '../api';

type EmailStatus = 'QUEUED' | 'SENT' | 'DELIVERED' | 'DELAYED' | 'BOUNCED' | 'COMPLAINED' | 'FAILED' | 'SUPPRESSED';

interface OutboundEmail {
  id: string;
  toEmail: string;
  subject: string;
  kind: string;
  status: EmailStatus;
  error: string | null;
  createdAt: string;
  person: { id: string; name: string | null } | null;
}

interface Suppression {
  id: string;
  email: string;
  reason: string;
  createdAt: string;
}

interface EmailStatusInfo {
  mode: 'live' | 'log' | 'redirect';
  notifyTo: string | null;
}

const KIND_LABELS: Record<string, string> = {
  SUBSCRIBE_CONFIRM: 'Confirm',
  CONTACT_ACK: 'Contact ack',
  ADMIN_NOTIFY: 'Notification',
  REPLY: 'Reply',
  NEWSLETTER: 'Newsletter',
  NEWSLETTER_TEST: 'Newsletter test',
};

const STATUS_COLORS: Record<EmailStatus, { bg: string; fg: string }> = {
  QUEUED: { bg: '#eee', fg: '#555' },
  SENT: { bg: '#e8f0f8', fg: '#2850a0' },
  DELIVERED: { bg: '#e8efe8', fg: '#2d4a2d' },
  DELAYED: { bg: '#fdf3e0', fg: '#8a5a00' },
  BOUNCED: { bg: '#fbe9e9', fg: '#b22' },
  COMPLAINED: { bg: '#fbe9e9', fg: '#b22' },
  FAILED: { bg: '#fbe9e9', fg: '#b22' },
  SUPPRESSED: { bg: '#eee', fg: '#777' },
};

export default function AdminEmail() {
  const [view, setView] = useState<'sent' | 'suppressions'>('sent');
  const [emails, setEmails] = useState<OutboundEmail[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [suppressions, setSuppressions] = useState<Suppression[]>([]);
  const [status, setStatus] = useState<EmailStatusInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  async function loadSent(cursor?: string) {
    const page = await apiFetch<{ items: OutboundEmail[]; nextCursor: string | null }>(
      `/api/email/outbound${cursor ? `?cursor=${cursor}` : ''}`,
    );
    setEmails((prev) => (cursor ? [...prev, ...page.items] : page.items));
    setNextCursor(page.nextCursor);
  }

  useEffect(() => {
    Promise.all([
      loadSent(),
      apiFetch<Suppression[]>('/api/email/suppressions').then(setSuppressions),
      apiFetch<EmailStatusInfo>('/api/email/status').then(setStatus),
    ]).finally(() => setLoading(false));
  }, []);

  async function sendTest() {
    setNotice('Sending…');
    try {
      const row = await apiFetch<OutboundEmail>('/api/email/test', { method: 'POST' });
      setNotice(row.status === 'FAILED' ? `Failed: ${row.error}` : `Test email ${row.status.toLowerCase()} → ${row.toEmail}`);
      await loadSent();
    } catch {
      setNotice('Test failed — is ADMIN_NOTIFY_EMAIL set?');
    }
  }

  async function removeSuppression(s: Suppression) {
    if (!confirm(`Allow email to ${s.email} again?`)) return;
    await apiFetch(`/api/email/suppressions/${s.id}`, { method: 'DELETE' });
    setSuppressions((prev) => prev.filter((x) => x.id !== s.id));
  }

  if (loading) return <p style={{ color: '#888' }}>Loading…</p>;

  return (
    <div>
      <div style={styles.toolbar}>
        <h2 style={styles.heading}>
          Email
          {status && status.mode !== 'live' && (
            <span style={styles.modeBadge} title="EMAIL_MODE — only 'live' sends real email">mode: {status.mode}</span>
          )}
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {notice && <span style={styles.notice}>{notice}</span>}
          <button onClick={sendTest} style={styles.btnSm} disabled={!status?.notifyTo}
            title={status?.notifyTo ? `Sends to ${status.notifyTo}` : 'ADMIN_NOTIFY_EMAIL not set'}>
            Send test email
          </button>
        </div>
      </div>

      <div style={styles.tabs}>
        <button onClick={() => setView('sent')} style={{ ...styles.tab, ...(view === 'sent' ? styles.tabActive : {}) }}>
          Sent
        </button>
        <button onClick={() => setView('suppressions')} style={{ ...styles.tab, ...(view === 'suppressions' ? styles.tabActive : {}) }}>
          Suppressions {suppressions.length > 0 && <span style={styles.count}>{suppressions.length}</span>}
        </button>
      </div>

      {view === 'sent' && (
        <>
          {emails.length === 0 ? (
            <p style={{ color: '#888' }}>No email sent yet.</p>
          ) : (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Date</th>
                    <th style={styles.th}>To</th>
                    <th style={styles.th}>Subject</th>
                    <th style={styles.th}>Type</th>
                    <th style={styles.th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {emails.map((e) => (
                    <tr key={e.id}>
                      <td style={{ ...styles.td, whiteSpace: 'nowrap', color: '#888' }}>
                        {new Date(e.createdAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td style={styles.td}>
                        {e.person?.name && <div style={{ fontWeight: 500 }}>{e.person.name}</div>}
                        <div style={{ color: '#666' }}>{e.toEmail}</div>
                      </td>
                      <td style={styles.td}>{e.subject}</td>
                      <td style={{ ...styles.td, whiteSpace: 'nowrap' }}>{KIND_LABELS[e.kind] ?? e.kind}</td>
                      <td style={styles.td}>
                        <span style={{ ...styles.status, background: STATUS_COLORS[e.status].bg, color: STATUS_COLORS[e.status].fg }}
                          title={e.error ?? undefined}>
                          {e.status.toLowerCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {nextCursor && (
            <button onClick={() => loadSent(nextCursor)} style={{ ...styles.btnSm, marginTop: 12 }}>Load more</button>
          )}
        </>
      )}

      {view === 'suppressions' && (
        suppressions.length === 0 ? (
          <p style={{ color: '#888' }}>No suppressed addresses. Hard bounces and spam complaints are added here automatically.</p>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Email</th>
                  <th style={styles.th}>Reason</th>
                  <th style={styles.th}>Since</th>
                  <th style={styles.th}></th>
                </tr>
              </thead>
              <tbody>
                {suppressions.map((s) => (
                  <tr key={s.id}>
                    <td style={styles.td}>{s.email}</td>
                    <td style={styles.td}>{s.reason}</td>
                    <td style={{ ...styles.td, color: '#888' }}>{new Date(s.createdAt).toLocaleDateString()}</td>
                    <td style={{ ...styles.td, textAlign: 'right' }}>
                      <button onClick={() => removeSuppression(s)} style={styles.btnSm}>Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  toolbar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', gap: 12, flexWrap: 'wrap' },
  heading: { fontSize: '1.1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 },
  modeBadge: { background: '#fdf3e0', color: '#8a5a00', borderRadius: 3, fontSize: '0.7rem', fontWeight: 600, padding: '2px 7px' },
  notice: { fontSize: '0.8rem', color: '#555' },
  count: { fontSize: '0.75rem', color: '#888', marginLeft: 4 },
  tabs: { display: 'flex', gap: 4, borderBottom: '1px solid #e5e5e5', marginBottom: '1rem' },
  tab: { background: 'transparent', border: 'none', borderBottom: '2px solid transparent', padding: '0.5rem 0.9rem', fontSize: '0.85rem', color: '#777', cursor: 'pointer', marginBottom: -1 },
  tabActive: { color: '#1a1917', borderBottomColor: '#2d4a2d', fontWeight: 500 },
  tableWrap: { background: 'white', border: '1px solid #e5e5e5', borderRadius: 6, overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' },
  th: { textAlign: 'left', padding: '0.6rem 0.85rem', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#888', borderBottom: '1px solid #eee' },
  td: { padding: '0.6rem 0.85rem', borderBottom: '1px solid #f3f3f3', verticalAlign: 'top' },
  status: { borderRadius: 3, fontSize: '0.7rem', fontWeight: 600, padding: '2px 7px' },
  btnSm: { background: 'white', border: '1px solid #ddd', borderRadius: 4, padding: '0.35rem 0.85rem', fontSize: '0.8rem', cursor: 'pointer' },
};
