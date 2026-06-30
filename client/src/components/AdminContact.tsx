import { useEffect, useState } from 'react';
import { apiFetch } from '../api';

interface ContactMessage {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string;
  message: string;
  read: boolean;
  sourceSite: string;
  createdAt: string;
  person: { id: string; name: string | null; tags: string[] } | null;
}

interface Props {
  onUnreadChange: (count: number) => void;
}

export default function AdminContact({ onUnreadChange }: Props) {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<ContactMessage[]>('/api/contact')
      .then((data) => {
        setMessages(data);
        onUnreadChange(data.filter((m) => !m.read).length);
      })
      .finally(() => setLoading(false));
  }, []);

  async function markRead(id: string) {
    await apiFetch(`/api/contact/${id}/read`, { method: 'PATCH' });
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, read: true } : m)));
    onUnreadChange(messages.filter((m) => !m.read && m.id !== id).length);
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = prev === id ? null : id;
      if (next) {
        const msg = messages.find((m) => m.id === next);
        if (msg && !msg.read) markRead(next);
      }
      return next;
    });
  }

  if (loading) return <p style={{ color: '#888' }}>Loading…</p>;

  const unread = messages.filter((m) => !m.read).length;

  return (
    <div>
      <div style={styles.toolbar}>
        <h2 style={styles.heading}>
          Inbox <span style={styles.count}>{messages.length}</span>
          {unread > 0 && <span style={styles.unreadBadge}>{unread} unread</span>}
        </h2>
      </div>

      {messages.length === 0 && <p style={{ color: '#888' }}>No messages yet.</p>}

      {messages.map((msg) => (
        <div
          key={msg.id}
          style={{ ...styles.item, ...(msg.read ? {} : styles.itemUnread) }}
        >
          <div style={styles.itemHeader} onClick={() => toggleExpand(msg.id)}>
            <div style={styles.itemMeta}>
              <span style={styles.itemName}>{msg.name}</span>
              <span style={styles.itemEmail}>{msg.email}</span>
              {msg.phone && <span style={styles.itemPhone}>{msg.phone}</span>}
            </div>
            <div style={styles.itemRight}>
              <span style={styles.itemSite}>{msg.sourceSite}</span>
              <span style={styles.itemDate}>{new Date(msg.createdAt).toLocaleDateString()}</span>
              {!msg.read && <span style={styles.dot} />}
              <span style={styles.chevron}>{expanded === msg.id ? '▲' : '▼'}</span>
            </div>
          </div>
          <div style={styles.itemSubject}>{msg.subject}</div>
          {expanded === msg.id && (
            <div style={styles.itemBody}>{msg.message}</div>
          )}
        </div>
      ))}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  toolbar: { display: 'flex', alignItems: 'center', marginBottom: '1.25rem' },
  heading: { fontSize: '1.1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 },
  count: { fontSize: '0.85rem', fontWeight: 400, color: '#888' },
  unreadBadge: { background: '#c44', color: 'white', borderRadius: 10, fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px' },
  item: { background: 'white', border: '1px solid #e5e5e5', borderRadius: 6, marginBottom: 8, overflow: 'hidden' },
  itemUnread: { borderLeftColor: '#2d4a2d', borderLeftWidth: 3 },
  itemHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem 1rem', cursor: 'pointer' },
  itemMeta: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  itemName: { fontWeight: 500, fontSize: '0.9rem' },
  itemEmail: { fontSize: '0.82rem', color: '#666' },
  itemPhone: { fontSize: '0.82rem', color: '#888' },
  itemRight: { display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 },
  itemSite: { fontSize: '0.72rem', color: '#aaa', fontStyle: 'italic' },
  itemDate: { fontSize: '0.78rem', color: '#999' },
  dot: { width: 8, height: 8, borderRadius: 4, background: '#2d4a2d', flexShrink: 0 },
  chevron: { fontSize: '0.65rem', color: '#aaa' },
  itemSubject: { padding: '0 1rem 0.75rem', fontSize: '0.88rem', fontWeight: 500, color: '#333' },
  itemBody: { padding: '0.75rem 1rem 1rem', fontSize: '0.88rem', color: '#444', lineHeight: 1.6, borderTop: '1px solid #f5f5f5', whiteSpace: 'pre-wrap' },
};
