import { useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from '../api';

type IssueStatus = 'DRAFT' | 'SENDING' | 'SENT';

interface Stats {
  queued: number;
  sent: number;
  delivered: number;
  delayed: number;
  bounced: number;
  complained: number;
  failed: number;
  skipped: number;
  unsubscribed: number;
}

interface Issue {
  id: string;
  listId: string;
  subject: string;
  preheader: string | null;
  markdown: string;
  status: IssueStatus;
  recipientCount: number;
  sendStartedAt: string | null;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
  list: { key: string; name: string };
  stats: Stats;
}

interface List {
  id: string;
  key: string;
  name: string;
  recipientCount: number;
}

interface Config {
  mode: 'live' | 'log' | 'redirect';
  postalAddressSet: boolean;
  dailyLimit: number;
  transactionalReserve: number;
}

interface Draft {
  listId: string;
  subject: string;
  preheader: string;
  markdown: string;
}

const MD_HINT = '# Heading · ## Subheading · ### Label · **bold** · *italic* · [link](https://…) · - list · 1. list · > quote · --- rule · ![alt](https://image-url)';

const STARTER = `# You're on the list

Thank you for subscribing to Abundance Architecture.

Write your update here. A blank line starts a new paragraph.

## A subheading

- A point worth making
- Another one

[Visit the site](https://abundancearchitecture.world)
`;

function accepted(s: Stats) {
  return s.sent + s.delivered + s.delayed + s.bounced + s.complained;
}

export default function AdminNewsletter() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [lists, setLists] = useState<List[]>([]);
  const [config, setConfig] = useState<Config | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadAll() {
    const [i, l, c] = await Promise.all([
      apiFetch<Issue[]>('/api/newsletter/issues'),
      apiFetch<List[]>('/api/newsletter/lists'),
      apiFetch<Config>('/api/newsletter/config'),
    ]);
    setIssues(i);
    setLists(l);
    setConfig(c);
  }

  useEffect(() => {
    loadAll().finally(() => setLoading(false));
  }, []);

  async function newIssue() {
    const created = await apiFetch<Issue>('/api/newsletter/issues', {
      method: 'POST',
      body: JSON.stringify({ listId: lists[0]?.id, subject: '', markdown: STARTER }),
    });
    await loadAll();
    setOpenId(created.id);
  }

  if (loading) return <p style={{ color: '#888' }}>Loading…</p>;

  if (openId) {
    return (
      <IssueEditor
        id={openId}
        lists={lists}
        config={config}
        onClose={() => { setOpenId(null); loadAll(); }}
      />
    );
  }

  return (
    <div>
      <div style={styles.toolbar}>
        <h2 style={styles.heading}>Newsletter</h2>
        <button onClick={newIssue} style={styles.btnPrimary}>New issue</button>
      </div>

      <ConfigWarnings config={config} />

      <div style={styles.listSummary}>
        {lists.map((l) => (
          <span key={l.id} style={styles.listChip}>
            {l.name}: <strong>{l.recipientCount}</strong> confirmed subscriber{l.recipientCount === 1 ? '' : 's'}
          </span>
        ))}
      </div>

      {issues.length === 0 ? (
        <p style={{ color: '#888' }}>No issues yet. Start one with “New issue”.</p>
      ) : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Subject</th>
                <th style={styles.th}>List</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Sent</th>
                <th style={styles.th}>Delivered</th>
                <th style={styles.th}>Unsubscribed</th>
                <th style={styles.th}>Date</th>
              </tr>
            </thead>
            <tbody>
              {issues.map((i) => (
                <tr key={i.id} onClick={() => setOpenId(i.id)} style={{ cursor: 'pointer' }}>
                  <td style={{ ...styles.td, fontWeight: 500 }}>{i.subject || <em style={{ color: '#aaa' }}>untitled</em>}</td>
                  <td style={styles.td}>{i.list.name}</td>
                  <td style={styles.td}><StatusBadge status={i.status} /></td>
                  <td style={styles.td}>{i.status === 'DRAFT' ? '—' : `${accepted(i.stats)} / ${i.recipientCount}`}</td>
                  <td style={styles.td}>{i.status === 'DRAFT' ? '—' : i.stats.delivered}</td>
                  <td style={styles.td}>{i.status === 'DRAFT' ? '—' : i.stats.unsubscribed}</td>
                  <td style={{ ...styles.td, color: '#888', whiteSpace: 'nowrap' }}>
                    {new Date(i.sentAt ?? i.sendStartedAt ?? i.updatedAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ConfigWarnings({ config }: { config: Config | null }) {
  if (!config) return null;
  return (
    <>
      {config.mode !== 'live' && (
        <p style={styles.warn}>EMAIL_MODE is <strong>{config.mode}</strong> — sends are {config.mode === 'log' ? 'only logged, not delivered' : `redirected to EMAIL_REDIRECT_TO`}.</p>
      )}
      {!config.postalAddressSet && (
        <p style={styles.warn}>NEWSLETTER_POSTAL_ADDRESS is not set. US law (CAN-SPAM) requires a postal address in every newsletter — sending is blocked until it’s set (tests still work).</p>
      )}
    </>
  );
}

function StatusBadge({ status }: { status: IssueStatus }) {
  const c = { DRAFT: ['#eee', '#555'], SENDING: ['#fdf3e0', '#8a5a00'], SENT: ['#e8efe8', '#2d4a2d'] }[status];
  return <span style={{ ...styles.badge, background: c[0], color: c[1] }}>{status.toLowerCase()}</span>;
}

// ─── Editor / detail ──────────────────────────────────────────────────────────

function IssueEditor({ id, lists, config, onClose }: { id: string; lists: List[]; config: Config | null; onClose: () => void }) {
  const [issue, setIssue] = useState<Issue | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [savedDraft, setSavedDraft] = useState<Draft | null>(null);
  const [previewHtml, setPreviewHtml] = useState('');
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const previewTimer = useRef<number | undefined>(undefined);

  const editable = issue?.status === 'DRAFT';
  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(savedDraft), [draft, savedDraft]);
  const list = lists.find((l) => l.id === draft?.listId);

  async function load() {
    const i = await apiFetch<Issue>(`/api/newsletter/issues/${id}`);
    const d = { listId: i.listId, subject: i.subject, preheader: i.preheader ?? '', markdown: i.markdown };
    setIssue(i);
    setDraft(d);
    setSavedDraft(d);
  }

  useEffect(() => { load(); }, [id]);

  // Poll while sending so progress updates
  useEffect(() => {
    if (issue?.status !== 'SENDING') return;
    const t = window.setInterval(load, 10000);
    return () => window.clearInterval(t);
  }, [issue?.status]);

  // Debounced live preview
  useEffect(() => {
    if (!draft) return;
    window.clearTimeout(previewTimer.current);
    previewTimer.current = window.setTimeout(async () => {
      const r = await apiFetch<{ html: string }>('/api/newsletter/preview', { method: 'POST', body: JSON.stringify(draft) });
      setPreviewHtml(r.html);
    }, 350);
    return () => window.clearTimeout(previewTimer.current);
  }, [draft]);

  async function save(): Promise<boolean> {
    if (!draft || !editable) return true;
    if (!dirty) return true;
    try {
      await apiFetch(`/api/newsletter/issues/${id}`, { method: 'PATCH', body: JSON.stringify(draft) });
      setSavedDraft(draft);
      return true;
    } catch {
      setNotice({ text: 'Save failed', error: true });
      return false;
    }
  }

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(true);
    setNotice({ text: `${label}…` });
    try {
      await fn();
    } catch (err) {
      setNotice({ text: err instanceof Error ? err.message : 'Something went wrong', error: true });
    } finally {
      setBusy(false);
    }
  }

  const onSave = () => run('Saving', async () => { if (await save()) setNotice({ text: 'Saved' }); });

  const onTest = () => run('Sending test', async () => {
    if (!(await save())) return;
    const row = await apiFetch<{ status: string; toEmail: string; error: string | null }>(
      `/api/newsletter/issues/${id}/test`, { method: 'POST', body: JSON.stringify({}) },
    );
    setNotice(row.status === 'FAILED'
      ? { text: `Test failed: ${row.error}`, error: true }
      : { text: `Test ${row.status.toLowerCase()} → ${row.toEmail}` });
  });

  const onSend = () => run('Starting send', async () => {
    if (!(await save())) return;
    const n = list?.recipientCount ?? 0;
    const budget = config ? config.dailyLimit - config.transactionalReserve : 80;
    const spread = n > budget ? `\n\nThe daily send limit is ${config?.dailyLimit}, so this will go out over about ${Math.ceil(n / budget)} days.` : '';
    if (!window.confirm(`Send “${draft?.subject}” to ${n} confirmed subscriber${n === 1 ? '' : 's'} of ${list?.name}?${spread}\n\nThis can’t be undone.`)) {
      setNotice(null);
      return;
    }
    await apiFetch(`/api/newsletter/issues/${id}/send`, { method: 'POST', body: JSON.stringify({}) });
    await load();
    setNotice({ text: 'Sending started' });
  });

  const onDelete = () => run('Deleting', async () => {
    if (!window.confirm('Delete this draft?')) { setNotice(null); return; }
    await apiFetch(`/api/newsletter/issues/${id}`, { method: 'DELETE' });
    onClose();
  });

  const onBack = async () => {
    if (editable && dirty && !window.confirm('Discard unsaved changes?')) return;
    onClose();
  };

  if (!issue || !draft) return <p style={{ color: '#888' }}>Loading…</p>;

  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });

  return (
    <div>
      <div style={styles.toolbar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <button onClick={onBack} style={styles.btnSm}>← Issues</button>
          <h2 style={{ ...styles.heading, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {issue.subject || 'Untitled issue'}
          </h2>
          <StatusBadge status={issue.status} />
          {editable && dirty && <span style={styles.unsaved}>unsaved</span>}
        </div>
        <div style={styles.actions}>
          {notice && <span style={{ ...styles.notice, color: notice.error ? '#b22' : '#555' }}>{notice.text}</span>}
          {editable ? (
            <>
              <button onClick={onDelete} style={styles.btnDanger} disabled={busy}>Delete</button>
              <button onClick={onSave} style={styles.btnSm} disabled={busy || !dirty}>Save</button>
              <button onClick={onTest} style={styles.btnSm} disabled={busy}>Send test</button>
              <button onClick={onSend} style={styles.btnPrimary}
                disabled={busy || !draft.subject.trim() || !draft.markdown.trim() || (config?.mode === 'live' && !config.postalAddressSet) || !list?.recipientCount}>
                Send to {list?.recipientCount ?? 0}
              </button>
            </>
          ) : (
            <button onClick={onTest} style={styles.btnSm} disabled={busy}>Send test</button>
          )}
        </div>
      </div>

      {editable && <ConfigWarnings config={config} />}
      {!editable && <StatsPanel issue={issue} />}

      <div style={styles.editorGrid}>
        <div style={styles.editorCol}>
          {editable ? (
            <>
              {lists.length > 1 && (
                <label style={styles.label}>List
                  <select value={draft.listId} onChange={(e) => set({ listId: e.target.value })} style={styles.input}>
                    {lists.map((l) => <option key={l.id} value={l.id}>{l.name} ({l.recipientCount})</option>)}
                  </select>
                </label>
              )}
              <label style={styles.label}>Subject
                <input value={draft.subject} onChange={(e) => set({ subject: e.target.value })} style={styles.input} placeholder="Subject line" />
              </label>
              <label style={styles.label}>Preview text <span style={styles.hint}>(shown after the subject in the inbox)</span>
                <input value={draft.preheader} onChange={(e) => set({ preheader: e.target.value })} style={styles.input} placeholder="Optional" />
              </label>
              <label style={{ ...styles.label, flex: 1, display: 'flex', flexDirection: 'column' }}>Content (Markdown)
                <textarea value={draft.markdown} onChange={(e) => set({ markdown: e.target.value })} style={styles.textarea} spellCheck />
              </label>
              <p style={styles.hint}>{MD_HINT}</p>
            </>
          ) : (
            <div style={styles.readonly}>
              <div><span style={styles.hint}>List</span> {issue.list.name}</div>
              <div><span style={styles.hint}>Preview text</span> {issue.preheader || '—'}</div>
              <pre style={styles.pre}>{issue.markdown}</pre>
            </div>
          )}
        </div>
        <div style={styles.previewCol}>
          <div style={styles.previewLabel}>Preview</div>
          <iframe title="Newsletter preview" srcDoc={previewHtml} style={styles.iframe} sandbox="" />
        </div>
      </div>
    </div>
  );
}

function StatsPanel({ issue }: { issue: Issue }) {
  const s = issue.stats;
  const cells: [string, number | string][] = [
    ['Recipients', issue.recipientCount],
    ['Queued', s.queued],
    ['Sent', accepted(s)],
    ['Delivered', s.delivered],
    ['Bounced', s.bounced],
    ['Spam reports', s.complained],
    ['Failed', s.failed],
    ['Skipped', s.skipped],
    ['Unsubscribed', s.unsubscribed],
  ];
  return (
    <div style={styles.stats}>
      {cells.map(([k, v]) => (
        <div key={k} style={styles.stat}>
          <div style={styles.statValue}>{v}</div>
          <div style={styles.statLabel}>{k}</div>
        </div>
      ))}
      <div style={{ ...styles.hint, width: '100%', marginTop: 4 }}>
        {issue.status === 'SENDING'
          ? 'Sending — refreshes every 10 seconds. Large lists continue as the daily limit allows.'
          : `Sent ${issue.sentAt ? new Date(issue.sentAt).toLocaleString() : ''}. Delivery counts keep updating as reports arrive.`}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  toolbar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: '1rem' },
  heading: { fontSize: '1.1rem', fontWeight: 600, margin: 0 },
  actions: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  notice: { fontSize: '0.8rem' },
  unsaved: { fontSize: '0.72rem', color: '#8a5a00' },
  warn: { background: '#fdf3e0', color: '#6b4a00', border: '1px solid #f0dfb8', borderRadius: 4, padding: '0.55rem 0.8rem', fontSize: '0.82rem', margin: '0 0 0.75rem' },
  listSummary: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '1rem' },
  listChip: { background: 'white', border: '1px solid #e5e5e5', borderRadius: 4, padding: '0.35rem 0.7rem', fontSize: '0.82rem', color: '#444' },
  tableWrap: { background: 'white', border: '1px solid #e5e5e5', borderRadius: 6, overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' },
  th: { textAlign: 'left', padding: '0.6rem 0.85rem', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#888', borderBottom: '1px solid #eee' },
  td: { padding: '0.65rem 0.85rem', borderBottom: '1px solid #f3f3f3' },
  badge: { borderRadius: 3, fontSize: '0.7rem', fontWeight: 600, padding: '2px 7px' },
  editorGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.25rem', alignItems: 'stretch' },
  editorCol: { display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 },
  previewCol: { display: 'flex', flexDirection: 'column', minWidth: 0 },
  previewLabel: { fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#888', marginBottom: 6 },
  iframe: { width: '100%', minHeight: 640, flex: 1, border: '1px solid #e5e5e5', borderRadius: 6, background: '#eeeae0' },
  label: { fontSize: '0.78rem', fontWeight: 600, color: '#555', display: 'flex', flexDirection: 'column', gap: 4 },
  hint: { fontSize: '0.75rem', fontWeight: 400, color: '#999', margin: 0 },
  input: { border: '1px solid #ddd', borderRadius: 4, padding: '0.5rem 0.65rem', fontSize: '0.9rem', fontFamily: 'inherit', fontWeight: 400 },
  textarea: { flex: 1, minHeight: 460, border: '1px solid #ddd', borderRadius: 4, padding: '0.75rem', fontSize: '0.88rem', lineHeight: 1.55, fontFamily: 'Menlo, Consolas, monospace', fontWeight: 400, resize: 'vertical' },
  readonly: { background: 'white', border: '1px solid #e5e5e5', borderRadius: 6, padding: '1rem', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: 8 },
  pre: { whiteSpace: 'pre-wrap', fontFamily: 'Menlo, Consolas, monospace', fontSize: '0.8rem', color: '#444', margin: 0, maxHeight: 520, overflow: 'auto' },
  stats: { display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: '1rem' },
  stat: { background: 'white', border: '1px solid #e5e5e5', borderRadius: 6, padding: '0.6rem 0.9rem', minWidth: 92 },
  statValue: { fontSize: '1.15rem', fontWeight: 600 },
  statLabel: { fontSize: '0.7rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.04em' },
  btnSm: { background: 'white', border: '1px solid #ddd', borderRadius: 4, padding: '0.35rem 0.85rem', fontSize: '0.8rem', cursor: 'pointer' },
  btnPrimary: { background: '#2d4a2d', color: 'white', border: 'none', borderRadius: 4, padding: '0.4rem 0.95rem', fontSize: '0.8rem', cursor: 'pointer' },
  btnDanger: { background: 'white', border: '1px solid #e88', color: '#c33', borderRadius: 4, padding: '0.35rem 0.85rem', fontSize: '0.8rem', cursor: 'pointer' },
};
