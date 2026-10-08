import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { apiFetch } from '../api';
import NewsletterInvite from './NewsletterInvite';
import RecipientInput from './RecipientInput';

type Status = 'OPEN' | 'WAITING' | 'CLOSED';
type Filter = 'open' | 'waiting' | 'closed' | 'all';
type Channel = 'CONTACT_FORM' | 'EMAIL' | 'NEWSLETTER_REPLY' | 'COMPOSED';

interface Summary { open: number; waiting: number; closed: number; unread: number }

interface Mailbox { key: string; address: string; name: string; personal: boolean; open: number }

interface ListItem {
  id: string;
  subject: string;
  status: Status;
  channel: Channel;
  mailbox: string;
  unread: boolean;
  lastMessageAt: string;
  messageCount: number;
  person: { id: string; name: string | null; email: string } | null;
  last: { direction: 'INBOUND' | 'OUTBOUND'; text: string; fromName: string | null; fromEmail: string } | null;
}

interface Message {
  id: string;
  direction: 'INBOUND' | 'OUTBOUND';
  fromEmail: string;
  fromName: string | null;
  toEmail: string;
  subject: string;
  text: string;
  quotedText: string | null;
  createdAt: string;
  meta: { phone?: string } | null;
  attachments: { filename: string; contentType: string; size: number }[] | null;
  outboundEmail: { status: string; error: string | null } | null;
}

interface Detail {
  id: string;
  subject: string;
  status: Status;
  channel: Channel;
  mailbox: string;
  createdAt: string;
  messages: Message[];
  person: {
    id: string;
    name: string | null;
    email: string;
    phone: string | null;
    notes: string | null;
    tags: string[];
    createdAt: string;
    newsletter: { active: boolean; confirmedAt: string | null; unsubscribedAt: string | null } | null;
    listSubscriptions: { active: boolean; confirmedAt: string | null; unsubscribedAt: string | null; list: { name: string } }[];
    conversations: { id: string; subject: string; status: Status; lastMessageAt: string }[];
  } | null;
}

const CHANNEL_LABEL: Record<Channel, string> = {
  CONTACT_FORM: 'Contact form',
  EMAIL: 'Email',
  NEWSLETTER_REPLY: 'Newsletter reply',
  COMPOSED: 'Sent from admin',
};

const STATUS_COLORS: Record<Status, [string, string]> = {
  OPEN: ['#e8efe8', '#2d4a2d'],
  WAITING: ['#fdf3e0', '#8a5a00'],
  CLOSED: ['#eee', '#666'],
};

function ago(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d`;
  return new Date(iso).toLocaleDateString();
}

function useWide(minWidth: number) {
  const [wide, setWide] = useState(() => window.matchMedia(`(min-width: ${minWidth}px)`).matches);
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${minWidth}px)`);
    const on = () => setWide(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [minWidth]);
  return wide;
}

export default function AdminInbox({ onSummaryChange }: { onSummaryChange: (s: Summary) => void }) {
  const [filter, setFilter] = useState<Filter>('open');
  const [mailbox, setMailbox] = useState(''); // '' = all mailboxes
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<ListItem[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [loading, setLoading] = useState(true);
  const searchTimer = useRef<number | undefined>(undefined);
  const showSidebar = useWide(1280);

  // The nav badge always counts every mailbox; the tabs follow the mailbox filter
  const refreshSummary = useCallback(async (mb: string) => {
    const [all, boxes] = await Promise.all([
      apiFetch<Summary>('/api/inbox/summary'),
      apiFetch<Mailbox[]>('/api/inbox/mailboxes'),
    ]);
    onSummaryChange(all);
    setMailboxes(boxes);
    setSummary(mb ? await apiFetch<Summary>(`/api/inbox/summary?mailbox=${encodeURIComponent(mb)}`) : all);
  }, [onSummaryChange]);

  const loadList = useCallback(async (f: Filter, q: string, mb: string) => {
    const params = new URLSearchParams({ status: f });
    if (q.trim()) params.set('q', q.trim());
    if (mb) params.set('mailbox', mb);
    setItems(await apiFetch<ListItem[]>(`/api/inbox/conversations?${params}`));
  }, []);

  useEffect(() => {
    Promise.all([loadList('open', '', ''), refreshSummary('')]).finally(() => setLoading(false));
  }, [loadList, refreshSummary]);

  useEffect(() => {
    window.clearTimeout(searchTimer.current);
    searchTimer.current = window.setTimeout(() => loadList(filter, query, mailbox), query ? 300 : 0);
    return () => window.clearTimeout(searchTimer.current);
  }, [filter, query, mailbox, loadList]);

  async function afterChange(id?: string) {
    await Promise.all([loadList(filter, query, mailbox), refreshSummary(mailbox)]);
    if (id) setSelectedId(id);
  }

  function pickMailbox(mb: string) {
    setMailbox(mb);
    refreshSummary(mb);
  }

  const multi = mailboxes.length > 1;
  const local = (key: string) => `${key}@`;

  if (loading) return <p style={{ color: '#888' }}>Loading…</p>;

  const tabs: [Filter, string, number | undefined][] = [
    ['open', 'Open', summary?.open],
    ['waiting', 'Waiting', summary?.waiting],
    ['closed', 'Closed', summary?.closed],
    ['all', 'All', undefined],
  ];

  return (
    <div style={styles.wrap}>
      <div style={styles.toolbar}>
        <h2 style={styles.heading}>Inbox</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {multi && (
            <select value={mailbox} onChange={(e) => pickMailbox(e.target.value)} style={styles.select} title="Mailbox">
              <option value="">All mailboxes</option>
              {mailboxes.map((m) => (
                <option key={m.key} value={m.key}>{m.address}{m.open ? ` (${m.open})` : ''}</option>
              ))}
            </select>
          )}
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search conversations…" style={styles.search} />
          <button onClick={() => { setComposing(true); setSelectedId(null); }} style={styles.btnPrimary}>Compose</button>
        </div>
      </div>

      <div style={styles.tabs}>
        {tabs.map(([key, label, count]) => (
          <button key={key} onClick={() => setFilter(key)} style={{ ...styles.tab, ...(filter === key ? styles.tabActive : {}) }}>
            {label}{count !== undefined && <span style={styles.tabCount}>{count}</span>}
          </button>
        ))}
      </div>

      <div style={{ ...styles.panes, gridTemplateColumns: showSidebar ? '320px minmax(0,1fr) 260px' : '320px minmax(0,1fr)' }}>
        <div style={styles.list}>
          {items.length === 0 && (
            <p style={styles.empty}>{query ? `Nothing matches “${query}”.` : filter === 'open' ? 'Nothing needs a reply. 🎉' : 'No conversations here.'}</p>
          )}
          {items.map((c) => (
            <button key={c.id} onClick={() => { setSelectedId(c.id); setComposing(false); }}
              style={{ ...styles.item, ...(selectedId === c.id ? styles.itemActive : {}) }}>
              <div style={styles.itemTop}>
                <span style={{ ...styles.itemName, fontWeight: c.unread ? 700 : 500 }}>
                  {c.unread && <span style={styles.dot} />}
                  {c.person?.name || c.person?.email || c.last?.fromEmail || 'Unknown'}
                </span>
                <span style={styles.itemTime}>{ago(c.lastMessageAt)}</span>
              </div>
              <div style={{ ...styles.itemSubject, fontWeight: c.unread ? 600 : 400 }}>{c.subject}</div>
              <div style={styles.itemSnippet}>
                {c.last?.direction === 'OUTBOUND' && <span style={{ color: '#2d4a2d' }}>You: </span>}
                {c.last?.text}
              </div>
              <div style={styles.itemMeta}>
                {multi && !mailbox && <span style={styles.mailboxBadge}>{local(c.mailbox)}</span>}
                {filter === 'all' && <StatusBadge status={c.status} />}
                <span>{CHANNEL_LABEL[c.channel]}</span>
                {c.messageCount > 1 && <span>· {c.messageCount} messages</span>}
              </div>
            </button>
          ))}
        </div>

        <div style={styles.threadPane}>
          {composing ? (
            <Compose mailboxes={mailboxes} initialFrom={mailbox} onCancel={() => setComposing(false)}
              onSent={async (id) => { setComposing(false); setFilter('waiting'); await afterChange(id); }} />
          ) : selectedId ? (
            <Thread key={selectedId} id={selectedId} onChanged={() => afterChange()} showSidebar={showSidebar}
              mailboxes={mailboxes} />
          ) : (
            <p style={styles.empty}>Select a conversation, or Compose a new email.</p>
          )}
        </div>

        {showSidebar && <div id="inbox-sidebar" style={styles.sidebar} />}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const [bg, fg] = STATUS_COLORS[status];
  return <span style={{ ...styles.badge, background: bg, color: fg }}>{status.toLowerCase()}</span>;
}

// ─── Thread ──────────────────────────────────────────────────────────────────

function Thread({ id, onChanged, showSidebar, mailboxes }: {
  id: string; onChanged: () => void; showSidebar: boolean; mailboxes: Mailbox[];
}) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiFetch<Detail>(`/api/inbox/conversations/${id}`).then((d) => { setDetail(d); onChanged(); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Refresh after sidebar actions (e.g. newsletter invite) without touching list state
  const reload = () => apiFetch<Detail>(`/api/inbox/conversations/${id}`).then(setDetail);

  useEffect(() => { bottomRef.current?.scrollIntoView({ block: 'end' }); }, [detail?.messages.length]);

  async function send(close: boolean) {
    setBusy(true);
    setNotice({ text: 'Sending…' });
    try {
      const d = await apiFetch<Detail>(`/api/inbox/conversations/${id}/reply`, {
        method: 'POST', body: JSON.stringify({ body, close }),
      });
      setDetail(d);
      setBody('');
      setNotice({ text: close ? 'Sent and closed' : 'Sent — moved to Waiting' });
      onChanged();
    } catch (err) {
      setNotice({ text: err instanceof Error ? err.message : 'Send failed', error: true });
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(status: Status) {
    await apiFetch(`/api/inbox/conversations/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
    setDetail((d) => (d ? { ...d, status } : d));
    onChanged();
  }

  if (!detail) return <p style={styles.empty}>Loading…</p>;

  const fromAddress = mailboxes.find((m) => m.key === detail.mailbox)?.address ?? `${detail.mailbox}@`;

  return (
    <div style={styles.thread}>
      <div style={styles.threadHeader}>
        <div style={{ minWidth: 0 }}>
          <h3 style={styles.threadSubject}>{detail.subject}</h3>
          <div style={styles.threadMeta}>
            <StatusBadge status={detail.status} /> <span>{CHANNEL_LABEL[detail.channel]}</span>
            {mailboxes.length > 1 && <span style={styles.mailboxBadge}>{fromAddress}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {detail.status !== 'CLOSED'
            ? <button onClick={() => setStatus('CLOSED')} style={styles.btnSm}>Close</button>
            : <button onClick={() => setStatus('OPEN')} style={styles.btnSm}>Reopen</button>}
          {detail.status === 'WAITING' && <button onClick={() => setStatus('OPEN')} style={styles.btnSm}>Mark open</button>}
        </div>
      </div>

      <div style={styles.messages}>
        {detail.messages.map((m) => (
          <div key={m.id} style={{ ...styles.msg, ...(m.direction === 'OUTBOUND' ? styles.msgOut : {}) }}>
            <div style={styles.msgHead}>
              <span style={{ fontWeight: 600 }}>
                {m.direction === 'OUTBOUND' ? `You${mailboxes.length > 1 ? ` (${m.fromEmail})` : ''} → ${m.toEmail}` :(m.fromName ? `${m.fromName} <${m.fromEmail}>` : m.fromEmail)}
              </span>
              <span style={styles.msgTime}>{new Date(m.createdAt).toLocaleString()}</span>
            </div>
            {m.meta?.phone && <div style={styles.msgExtra}>📞 {m.meta.phone}</div>}
            <div style={styles.msgBody}>{m.text}</div>
            {m.quotedText && <QuotedText text={m.quotedText} />}
            {m.attachments && m.attachments.length > 0 && (
              <div style={styles.msgExtra}>📎 {m.attachments.map((a) => a.filename).join(', ')} <em>(see the original in your email inbox)</em></div>
            )}
            {m.outboundEmail && (
              <div style={{ ...styles.msgExtra, color: ['FAILED', 'BOUNCED', 'COMPLAINED', 'SUPPRESSED'].includes(m.outboundEmail.status) ? '#b22' : '#888' }}
                title={m.outboundEmail.error ?? undefined}>
                {m.outboundEmail.status.toLowerCase()}
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div style={styles.replyBox}>
        <textarea value={body} onChange={(e) => { setBody(e.target.value); setNotice(null); }}
          placeholder={`Reply to ${detail.person?.name || detail.person?.email || 'sender'} from ${fromAddress}… (signature is added automatically)`}
          style={styles.replyInput} rows={6} />
        <div style={styles.replyActions}>
          {notice && <span style={{ fontSize: '0.8rem', color: notice.error ? '#b22' : '#555' }}>{notice.text}</span>}
          <button onClick={() => send(true)} disabled={busy || !body.trim()} style={styles.btnSm}>Send &amp; close</button>
          <button onClick={() => send(false)} disabled={busy || !body.trim()} style={styles.btnPrimary}>Send</button>
        </div>
      </div>

      {showSidebar && detail.person && <PersonSidebar person={detail.person} onChanged={reload} />}
    </div>
  );
}

// Earlier messages the sender's email client quoted below their reply — hidden by default
function QuotedText({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: 8 }}>
      <button onClick={() => setOpen(!open)} style={styles.quoteToggle} title={open ? 'Hide quoted text' : 'Show quoted text'}>
        {open ? 'Hide quoted text' : '··· Show quoted text'}
      </button>
      {open && <div style={styles.quoted}>{text}</div>}
    </div>
  );
}

// Rendered into the third grid column (#inbox-sidebar) with a portal, so it can live with the thread's data
function PersonSidebar({ person, onChanged }: { person: NonNullable<Detail['person']>; onChanged: () => void }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useEffect(() => { setSlot(document.getElementById('inbox-sidebar')); }, []);
  if (!slot) return null;
  const sub = person.newsletter;
  const subLabel = !sub ? 'Not subscribed' : !sub.active ? 'Unsubscribed' : sub.confirmedAt ? 'Subscribed' : 'Pending confirmation';
  return <SidebarPortal slot={slot}>
    <div style={styles.sideCard}>
      <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{person.name || person.email}</div>
      {person.name && <div style={styles.sideMuted}>{person.email}</div>}
      {person.phone && <div style={styles.sideMuted}>📞 {person.phone}</div>}
      <div style={styles.sideMuted}>Since {new Date(person.createdAt).toLocaleDateString()}</div>
      {person.tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
          {person.tags.map((t) => <span key={t} style={styles.tag}>{t}</span>)}
        </div>
      )}
    </div>
    <div style={styles.sideCard}>
      <div style={styles.sideTitle}>Newsletter</div>
      <div style={{ fontSize: '0.84rem' }}>{subLabel}</div>
      {person.listSubscriptions.filter((l) => l.active).map((l) => (
        <div key={l.list.name} style={styles.sideMuted}>· {l.list.name}{l.confirmedAt ? '' : ' (pending)'}</div>
      ))}
      <NewsletterInvite personId={person.id} newsletter={person.newsletter}
        lists={person.listSubscriptions} onInvited={onChanged} />
    </div>
    {person.notes && (
      <div style={styles.sideCard}>
        <div style={styles.sideTitle}>Notes</div>
        <div style={{ fontSize: '0.84rem', whiteSpace: 'pre-wrap' }}>{person.notes}</div>
      </div>
    )}
    {person.conversations.length > 0 && (
      <div style={styles.sideCard}>
        <div style={styles.sideTitle}>Other conversations</div>
        {person.conversations.map((c) => (
          <div key={c.id} style={{ fontSize: '0.82rem', marginBottom: 4 }}>
            <StatusBadge status={c.status} /> {c.subject}
          </div>
        ))}
      </div>
    )}
  </SidebarPortal>;
}

function SidebarPortal({ slot, children }: { slot: HTMLElement; children: React.ReactNode }) {
  return createPortal(<>{children}</>, slot);
}

// ─── Compose ─────────────────────────────────────────────────────────────────

function Compose({ mailboxes, initialFrom, onCancel, onSent }: {
  mailboxes: Mailbox[]; initialFrom: string; onCancel: () => void; onSent: (id: string) => void;
}) {
  const [from, setFrom] = useState(initialFrom || mailboxes[0]?.key || '');
  const [to, setTo] = useState('');
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const d = await apiFetch<Detail>('/api/inbox/conversations', {
        method: 'POST', body: JSON.stringify({ to, name, subject, body, ...(from ? { from } : {}) }),
      });
      onSent(d.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Send failed');
    } finally {
      setBusy(false);
    }
  }

  const sender = mailboxes.find((m) => m.key === from);

  return (
    <div style={{ ...styles.thread, padding: '1rem 1.1rem', gap: 10 }}>
      <h3 style={styles.threadSubject}>New email</h3>
      {mailboxes.length > 1 && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: '#555' }}>
          From
          <select value={from} onChange={(e) => setFrom(e.target.value)} style={{ ...styles.input, flex: 1 }}>
            {mailboxes.map((m) => <option key={m.key} value={m.key}>{m.name} &lt;{m.address}&gt;</option>)}
          </select>
        </label>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <RecipientInput value={to} onChange={setTo} style={styles.input} autoFocus
          onPick={(m) => { setTo(m.email); if (m.name) setName(m.name); }} />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (optional)" style={styles.input} />
      </div>
      <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" style={styles.input} />
      <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Message… (signature is added automatically)"
        style={{ ...styles.replyInput, flex: 1, minHeight: 240 }} />
      <div style={styles.replyActions}>
        {error && <span style={{ fontSize: '0.8rem', color: '#b22' }}>{error}</span>}
        <button onClick={onCancel} style={styles.btnSm} disabled={busy}>Cancel</button>
        <button onClick={send} style={styles.btnPrimary} disabled={busy || !to.trim() || !subject.trim() || !body.trim()}>
          {busy ? 'Sending…' : 'Send'}
        </button>
      </div>
      <p style={{ fontSize: '0.75rem', color: '#999', margin: 0 }}>
        Sent from {sender?.address ?? 'your site address'}. Replies come back into this conversation (a copy also reaches
        your email inbox).
      </p>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { display: 'flex', flexDirection: 'column', height: 'calc(100vh - 4rem)' },
  toolbar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: '0.75rem', flexWrap: 'wrap' },
  heading: { fontSize: '1.1rem', fontWeight: 600, margin: 0 },
  search: { border: '1px solid #ddd', borderRadius: 4, padding: '0.4rem 0.65rem', fontSize: '0.85rem', fontFamily: 'inherit', width: 260 },
  select: { border: '1px solid #ddd', borderRadius: 4, padding: '0.4rem 0.5rem', fontSize: '0.85rem', fontFamily: 'inherit', background: 'white' },
  mailboxBadge: { borderRadius: 3, fontSize: '0.66rem', fontWeight: 600, padding: '1px 6px', background: '#eef0f4', color: '#4a5568' },
  tabs: { display: 'flex', gap: 4, borderBottom: '1px solid #e5e5e5', marginBottom: '0.75rem' },
  tab: { background: 'transparent', border: 'none', borderBottom: '2px solid transparent', padding: '0.45rem 0.85rem', fontSize: '0.85rem', color: '#777', cursor: 'pointer', marginBottom: -1 },
  tabActive: { color: '#1a1917', borderBottomColor: '#2d4a2d', fontWeight: 500 },
  tabCount: { marginLeft: 6, fontSize: '0.72rem', color: '#999' },
  panes: { display: 'grid', gap: '0.9rem', flex: 1, minHeight: 0 },
  list: { overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, paddingRight: 2 },
  empty: { color: '#888', fontSize: '0.88rem', padding: '1rem 0.25rem' },
  item: { textAlign: 'left', background: 'white', border: '1px solid #e5e5e5', borderRadius: 6, padding: '0.65rem 0.8rem', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', gap: 2 },
  itemActive: { borderColor: '#2d4a2d', boxShadow: '0 0 0 1px #2d4a2d' },
  itemTop: { display: 'flex', justifyContent: 'space-between', gap: 8 },
  itemName: { fontSize: '0.85rem', color: '#1a1917', display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' },
  dot: { width: 7, height: 7, borderRadius: 4, background: '#2d4a2d', flexShrink: 0 },
  itemTime: { fontSize: '0.72rem', color: '#999', flexShrink: 0 },
  itemSubject: { fontSize: '0.84rem', color: '#333', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' },
  itemSnippet: { fontSize: '0.78rem', color: '#888', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' },
  itemMeta: { fontSize: '0.7rem', color: '#aaa', display: 'flex', gap: 4, alignItems: 'center', marginTop: 2 },
  badge: { borderRadius: 3, fontSize: '0.66rem', fontWeight: 600, padding: '1px 6px' },
  threadPane: { minHeight: 0, display: 'flex', flexDirection: 'column' },
  thread: { background: 'white', border: '1px solid #e5e5e5', borderRadius: 6, display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 },
  threadHeader: { display: 'flex', justifyContent: 'space-between', gap: 12, padding: '0.85rem 1.1rem', borderBottom: '1px solid #f0f0f0' },
  threadSubject: { fontSize: '1rem', fontWeight: 600, margin: 0 },
  threadMeta: { display: 'flex', gap: 6, alignItems: 'center', fontSize: '0.75rem', color: '#999', marginTop: 4 },
  messages: { flex: 1, overflowY: 'auto', padding: '0.9rem 1.1rem', display: 'flex', flexDirection: 'column', gap: 10 },
  msg: { border: '1px solid #eee', borderRadius: 6, padding: '0.7rem 0.85rem', background: '#fafafa', maxWidth: '92%' },
  msgOut: { background: '#f1f6f1', borderColor: '#dfe9df', alignSelf: 'flex-end' },
  msgHead: { display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: '0.78rem', color: '#444', marginBottom: 6, flexWrap: 'wrap' },
  msgTime: { color: '#999' },
  msgBody: { fontSize: '0.88rem', color: '#222', lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word' },
  quoteToggle: { background: 'transparent', border: '1px solid #e0e0e0', borderRadius: 10, padding: '1px 8px', fontSize: '0.72rem', color: '#888', cursor: 'pointer' },
  quoted: { marginTop: 6, paddingLeft: 10, borderLeft: '2px solid #e0e0e0', fontSize: '0.8rem', color: '#888', whiteSpace: 'pre-wrap', wordBreak: 'break-word' },
  msgExtra: { fontSize: '0.74rem', color: '#888', marginTop: 6 },
  replyBox: { borderTop: '1px solid #f0f0f0', padding: '0.75rem 1.1rem', display: 'flex', flexDirection: 'column', gap: 8 },
  replyInput: { border: '1px solid #ddd', borderRadius: 4, padding: '0.6rem 0.7rem', fontSize: '0.88rem', fontFamily: 'inherit', lineHeight: 1.5, resize: 'vertical' },
  replyActions: { display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 },
  input: { border: '1px solid #ddd', borderRadius: 4, padding: '0.5rem 0.65rem', fontSize: '0.88rem', fontFamily: 'inherit' },
  sidebar: { overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 },
  sideCard: { background: 'white', border: '1px solid #e5e5e5', borderRadius: 6, padding: '0.75rem 0.85rem' },
  sideTitle: { fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#999', marginBottom: 6 },
  sideMuted: { fontSize: '0.8rem', color: '#777', marginTop: 2, wordBreak: 'break-all' },
  tag: { background: '#eee', color: '#555', borderRadius: 3, fontSize: '0.68rem', padding: '1px 6px' },
  btnSm: { background: 'white', border: '1px solid #ddd', borderRadius: 4, padding: '0.35rem 0.85rem', fontSize: '0.8rem', cursor: 'pointer' },
  btnPrimary: { background: '#2d4a2d', color: 'white', border: 'none', borderRadius: 4, padding: '0.4rem 0.95rem', fontSize: '0.8rem', cursor: 'pointer' },
};
