import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../api';
import AddressListInput from './AddressListInput';

interface GroupSummary {
  id: string;
  name: string;
  description: string | null;
  memberCount: number;
  conversationCount: number;
}

interface GroupDetail {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  members: { id: string; name: string | null; email: string; addedAt: string }[];
  conversations: { id: string; subject: string; status: 'OPEN' | 'WAITING' | 'CLOSED'; lastMessageAt: string; mailbox: string }[];
}

/** Ad hoc groups of People (e.g. design collaborators). "Email this group" opens Compose with the members. */
export default function AdminGroups({ onEmailGroup }: { onEmailGroup: (groupId: string) => void }) {
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [selected, setSelected] = useState<GroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const [adding, setAdding] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadGroups = useCallback(async () => {
    setGroups(await apiFetch<GroupSummary[]>('/api/groups'));
  }, []);

  useEffect(() => { loadGroups().finally(() => setLoading(false)); }, [loadGroups]);

  async function run<T>(fn: () => Promise<T>): Promise<T | undefined> {
    setError(null);
    try {
      return await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      return undefined;
    }
  }

  async function select(id: string) {
    const g = await run(() => apiFetch<GroupDetail>(`/api/groups/${id}`));
    if (!g) return;
    setSelected(g);
    setCreating(false);
    setEditing(false);
    setAdding([]);
  }

  async function create() {
    const g = await run(() => apiFetch<GroupDetail>('/api/groups', { method: 'POST', body: JSON.stringify(form) }));
    if (!g) return;
    await loadGroups();
    setSelected(g);
    setCreating(false);
    setForm({ name: '', description: '' });
  }

  async function saveEdit() {
    if (!selected) return;
    const g = await run(() => apiFetch<GroupDetail>(`/api/groups/${selected.id}`, { method: 'PATCH', body: JSON.stringify(form) }));
    if (!g) return;
    setSelected(g);
    setEditing(false);
    await loadGroups();
  }

  async function remove() {
    if (!selected || !confirm(`Delete the group “${selected.name}”? People and conversations are kept.`)) return;
    await run(() => apiFetch(`/api/groups/${selected.id}`, { method: 'DELETE' }));
    setSelected(null);
    await loadGroups();
  }

  async function addMembers() {
    if (!selected || !adding.length) return;
    const g = await run(() => apiFetch<GroupDetail>(`/api/groups/${selected.id}/members`, {
      method: 'POST', body: JSON.stringify({ members: adding.map((email) => ({ email })) }),
    }));
    if (!g) return;
    setSelected(g);
    setAdding([]);
    await loadGroups();
  }

  async function removeMember(personId: string) {
    if (!selected) return;
    const g = await run(() => apiFetch<GroupDetail>(`/api/groups/${selected.id}/members/${personId}`, { method: 'DELETE' }));
    if (!g) return;
    setSelected(g);
    await loadGroups();
  }

  if (loading) return <p style={{ color: '#888' }}>Loading…</p>;

  return (
    <div>
      <div style={styles.toolbar}>
        <h2 style={styles.heading}>Groups <span style={styles.count}>{groups.length}</span></h2>
        <button onClick={() => { setCreating(true); setSelected(null); setForm({ name: '', description: '' }); }} style={styles.btnPrimary}>
          New group
        </button>
      </div>
      {error && <p style={styles.error}>{error}</p>}

      <div style={styles.layout}>
        <div style={styles.list}>
          {groups.length === 0 && !creating && (
            <p style={styles.muted}>No groups yet. A group is a named set of people you email together, e.g. “Site design collaborators”.</p>
          )}
          {groups.map((g) => (
            <div key={g.id} onClick={() => select(g.id)}
              style={{ ...styles.card, ...(selected?.id === g.id ? styles.cardActive : {}) }}>
              <div style={styles.cardName}>{g.name}</div>
              {g.description && <div style={styles.cardDesc}>{g.description}</div>}
              <div style={styles.cardMeta}>
                {g.memberCount} member{g.memberCount === 1 ? '' : 's'} · {g.conversationCount} conversation{g.conversationCount === 1 ? '' : 's'}
              </div>
            </div>
          ))}
        </div>

        {creating && (
          <div style={styles.detail}>
            <h3 style={styles.detailName}>New group</h3>
            <div style={styles.fields}>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name" style={styles.input} autoFocus />
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="What is this group for? (optional)" style={{ ...styles.input, height: 70, resize: 'vertical' }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={create} disabled={!form.name.trim()} style={styles.btnPrimary}>Create</button>
                <button onClick={() => setCreating(false)} style={styles.btnSm}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {selected && (
          <div style={styles.detail}>
            <div style={styles.detailHeader}>
              {editing ? (
                <div style={{ ...styles.fields, flex: 1 }}>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={styles.input} />
                  <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Description" style={{ ...styles.input, height: 70, resize: 'vertical' }} />
                </div>
              ) : (
                <div style={{ minWidth: 0 }}>
                  <h3 style={styles.detailName}>{selected.name}</h3>
                  {selected.description && <p style={styles.desc}>{selected.description}</p>}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                {editing ? (
                  <>
                    <button onClick={saveEdit} style={styles.btnPrimary}>Save</button>
                    <button onClick={() => setEditing(false)} style={styles.btnSm}>Cancel</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => onEmailGroup(selected.id)} disabled={!selected.members.length} style={styles.btnPrimary}>
                      Email this group
                    </button>
                    <button onClick={() => { setEditing(true); setForm({ name: selected.name, description: selected.description ?? '' }); }} style={styles.btnSm}>Edit</button>
                    <button onClick={remove} style={styles.btnDanger}>Delete</button>
                  </>
                )}
              </div>
            </div>

            <div style={styles.section}>
              <h4 style={styles.sectionTitle}>Members ({selected.members.length})</h4>
              {selected.members.map((m) => (
                <div key={m.id} style={styles.row}>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    {m.name ? <><strong style={{ fontWeight: 500 }}>{m.name}</strong> <span style={styles.muted}>{m.email}</span></> : m.email}
                  </span>
                  <button onClick={() => removeMember(m.id)} style={styles.linkBtn}>remove</button>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 10 }}>
                <div style={{ flex: 1 }}>
                  <AddressListInput label="Add" value={adding} onChange={setAdding} placeholder="Type a name or email (new addresses become People)" />
                </div>
                <button onClick={addMembers} disabled={!adding.length} style={styles.btnSm}>Add</button>
              </div>
            </div>

            <div style={styles.section}>
              <h4 style={styles.sectionTitle}>Conversations ({selected.conversations.length})</h4>
              {selected.conversations.length === 0 && <p style={styles.muted}>None yet. Conversations started with “Email this group” are filed here.</p>}
              {selected.conversations.map((c) => (
                <div key={c.id} style={styles.row}>
                  <span style={{ flex: 1, minWidth: 0 }}>{c.subject}</span>
                  <span style={styles.muted}>{c.status.toLowerCase()} · {c.mailbox}@ · {new Date(c.lastMessageAt).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  toolbar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' },
  heading: { fontSize: '1.1rem', fontWeight: 600 },
  count: { fontSize: '0.85rem', fontWeight: 400, color: '#888', marginLeft: 6 },
  error: { color: '#b22', fontSize: '0.85rem', marginBottom: '0.75rem' },
  layout: { display: 'flex', gap: '1.25rem', alignItems: 'flex-start' },
  list: { width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 },
  card: { background: 'white', border: '1px solid #e5e5e5', borderRadius: 6, padding: '0.85rem 1rem', cursor: 'pointer' },
  cardActive: { borderColor: '#2d4a2d', boxShadow: '0 0 0 1px #2d4a2d' },
  cardName: { fontWeight: 500, fontSize: '0.9rem', marginBottom: 2 },
  cardDesc: { fontSize: '0.8rem', color: '#666', marginBottom: 4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' },
  cardMeta: { fontSize: '0.72rem', color: '#999' },
  detail: { flex: 1, background: 'white', border: '1px solid #e5e5e5', borderRadius: 6, padding: '1.25rem', minWidth: 0 },
  detailHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: '0.5rem' },
  detailName: { fontSize: '1rem', fontWeight: 600, margin: 0 },
  desc: { fontSize: '0.85rem', color: '#555', marginTop: 4, whiteSpace: 'pre-wrap' },
  fields: { display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 },
  input: { width: '100%', boxSizing: 'border-box', border: '1px solid #ddd', borderRadius: 4, padding: '0.45rem 0.65rem', fontSize: '0.88rem', fontFamily: 'inherit' },
  section: { borderTop: '1px solid #f0f0f0', paddingTop: '1rem', marginTop: '1rem' },
  sectionTitle: { fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#888', marginBottom: '0.6rem' },
  row: { display: 'flex', gap: 10, alignItems: 'baseline', fontSize: '0.85rem', padding: '0.4rem 0', borderBottom: '1px solid #f5f5f5' },
  muted: { fontSize: '0.78rem', color: '#888' },
  linkBtn: { background: 'transparent', border: 'none', color: '#a33', fontSize: '0.78rem', cursor: 'pointer', textDecoration: 'underline' },
  btnSm: { background: 'white', border: '1px solid #ddd', borderRadius: 4, padding: '0.35rem 0.85rem', fontSize: '0.8rem', cursor: 'pointer' },
  btnPrimary: { background: '#2d4a2d', color: 'white', border: 'none', borderRadius: 4, padding: '0.4rem 0.95rem', fontSize: '0.8rem', cursor: 'pointer' },
  btnDanger: { background: 'white', border: '1px solid #e88', color: '#c33', borderRadius: 4, padding: '0.35rem 0.85rem', fontSize: '0.8rem', cursor: 'pointer' },
};
