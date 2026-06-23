import { useEffect, useState } from 'react';
import { apiFetch } from '../api';

interface Newsletter {
  active: boolean;
  sourceSite: string;
  subscribedAt: string;
}

interface Person {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  notes: string | null;
  tags: string[];
  isAdmin: boolean;
  createdAt: string;
  newsletter: Newsletter | null;
  _count?: { contacts: number };
  contacts?: ContactMsg[];
}

interface ContactMsg {
  id: string;
  subject: string;
  message: string;
  createdAt: string;
  read: boolean;
}

export default function AdminPeople() {
  const [people, setPeople] = useState<Person[]>([]);
  const [selected, setSelected] = useState<Person | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', notes: '' });

  useEffect(() => {
    apiFetch<Person[]>('/api/people')
      .then(setPeople)
      .finally(() => setLoading(false));
  }, []);

  async function selectPerson(p: Person) {
    const detail = await apiFetch<Person>(`/api/people/${p.id}`);
    setSelected(detail);
    setForm({ name: detail.name ?? '', phone: detail.phone ?? '', notes: detail.notes ?? '' });
    setEditing(false);
  }

  async function saveEdit() {
    if (!selected) return;
    const updated = await apiFetch<Person>(`/api/people/${selected.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: form.name || null, phone: form.phone || null, notes: form.notes || null }),
    });
    setSelected(updated);
    setPeople((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
    setEditing(false);
  }

  async function deletePerson(id: string) {
    if (!confirm('Delete this person and all their data?')) return;
    await apiFetch(`/api/people/${id}`, { method: 'DELETE' });
    setPeople((prev) => prev.filter((p) => p.id !== id));
    setSelected(null);
  }

  function copyEmails() {
    const emails = people.filter((p) => p.newsletter?.active).map((p) => p.email).join(', ');
    navigator.clipboard.writeText(emails);
    alert(`Copied ${people.filter((p) => p.newsletter?.active).length} subscriber emails`);
  }

  if (loading) return <p style={{ color: '#888' }}>Loading…</p>;

  return (
    <div style={styles.wrap}>
      <div style={styles.toolbar}>
        <h2 style={styles.heading}>People <span style={styles.count}>{people.length}</span></h2>
        <button onClick={copyEmails} style={styles.btnSm}>Copy subscriber emails</button>
      </div>

      <div style={styles.layout}>
        <div style={{ ...styles.list, ...(selected ? styles.listNarrow : {}) }}>
          {people.map((p) => (
            <div
              key={p.id}
              onClick={() => selectPerson(p)}
              style={{ ...styles.card, ...(selected?.id === p.id ? styles.cardActive : {}) }}
            >
              <div style={styles.cardName}>{p.name ?? <em style={{ color: '#aaa' }}>no name</em>}</div>
              <div style={styles.cardEmail}>{p.email}</div>
              <div style={styles.badges}>
                {p.newsletter?.active && <span style={styles.badgeGreen}>subscriber</span>}
                {(p._count?.contacts ?? 0) > 0 && <span style={styles.badgeBlue}>{p._count!.contacts} msg</span>}
                {p.isAdmin && <span style={styles.badgeGray}>admin</span>}
              </div>
            </div>
          ))}
        </div>

        {selected && (
          <div style={styles.detail}>
            <div style={styles.detailHeader}>
              <div>
                {editing ? (
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Name" style={styles.inputInline} />
                ) : (
                  <h3 style={styles.detailName}>{selected.name ?? <em style={{ color: '#aaa' }}>no name</em>}</h3>
                )}
                <p style={styles.detailEmail}>{selected.email}</p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {editing ? (
                  <>
                    <button onClick={saveEdit} style={styles.btnPrimary}>Save</button>
                    <button onClick={() => setEditing(false)} style={styles.btnSm}>Cancel</button>
                  </>
                ) : (
                  <button onClick={() => setEditing(true)} style={styles.btnSm}>Edit</button>
                )}
                <button onClick={() => deletePerson(selected.id)} style={styles.btnDanger}>Delete</button>
              </div>
            </div>

            {editing && (
              <div style={styles.editFields}>
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="Phone" style={styles.inputInline} />
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Notes" style={{ ...styles.inputInline, height: 80, resize: 'vertical' }} />
              </div>
            )}

            {!editing && (
              <div style={styles.meta}>
                {selected.phone && <span style={styles.metaItem}>📞 {selected.phone}</span>}
                {selected.notes && <p style={styles.notes}>{selected.notes}</p>}
                <span style={styles.metaItem}>Joined {new Date(selected.createdAt).toLocaleDateString()}</span>
              </div>
            )}

            {selected.newsletter && (
              <div style={styles.section}>
                <h4 style={styles.sectionTitle}>Newsletter</h4>
                <p style={{ fontSize: '0.85rem', color: '#555' }}>
                  {selected.newsletter.active ? '✅ Active' : '❌ Unsubscribed'} · {selected.newsletter.sourceSite} · subscribed {new Date(selected.newsletter.subscribedAt).toLocaleDateString()}
                </p>
              </div>
            )}

            {selected.contacts && selected.contacts.length > 0 && (
              <div style={styles.section}>
                <h4 style={styles.sectionTitle}>Messages ({selected.contacts.length})</h4>
                {selected.contacts.map((c) => (
                  <div key={c.id} style={styles.msgItem}>
                    <div style={styles.msgSubject}>{c.subject}</div>
                    <div style={styles.msgBody}>{c.message}</div>
                    <div style={styles.msgDate}>{new Date(c.createdAt).toLocaleDateString()}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {},
  toolbar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' },
  heading: { fontSize: '1.1rem', fontWeight: 600 },
  count: { fontSize: '0.85rem', fontWeight: 400, color: '#888', marginLeft: 6 },
  layout: { display: 'flex', gap: '1.25rem', alignItems: 'flex-start' },
  list: { flex: 1, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 },
  listNarrow: { maxWidth: 320 },
  card: { background: 'white', border: '1px solid #e5e5e5', borderRadius: 6, padding: '0.85rem 1rem', cursor: 'pointer' },
  cardActive: { borderColor: '#2d4a2d', boxShadow: '0 0 0 1px #2d4a2d' },
  cardName: { fontWeight: 500, fontSize: '0.9rem', marginBottom: 2 },
  cardEmail: { fontSize: '0.82rem', color: '#666', marginBottom: 6 },
  badges: { display: 'flex', gap: 4, flexWrap: 'wrap' },
  badgeGreen: { background: '#e8efe8', color: '#2d4a2d', borderRadius: 3, fontSize: '0.68rem', fontWeight: 600, padding: '1px 6px' },
  badgeBlue: { background: '#e8f0f8', color: '#2850a0', borderRadius: 3, fontSize: '0.68rem', fontWeight: 600, padding: '1px 6px' },
  badgeGray: { background: '#eee', color: '#555', borderRadius: 3, fontSize: '0.68rem', fontWeight: 600, padding: '1px 6px' },
  detail: { flex: 2, background: 'white', border: '1px solid #e5e5e5', borderRadius: 6, padding: '1.25rem', minWidth: 0 },
  detailHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' },
  detailName: { fontSize: '1rem', fontWeight: 600 },
  detailEmail: { fontSize: '0.85rem', color: '#666', marginTop: 2 },
  meta: { display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: '1rem' },
  metaItem: { fontSize: '0.82rem', color: '#666' },
  notes: { fontSize: '0.85rem', color: '#444', fontStyle: 'italic', background: '#fafafa', padding: '0.5rem 0.75rem', borderRadius: 4, width: '100%' },
  editFields: { display: 'flex', flexDirection: 'column', gap: 8, marginBottom: '1rem' },
  inputInline: { width: '100%', border: '1px solid #ddd', borderRadius: 4, padding: '0.45rem 0.65rem', fontSize: '0.88rem', fontFamily: 'inherit' },
  section: { borderTop: '1px solid #f0f0f0', paddingTop: '1rem', marginTop: '1rem' },
  sectionTitle: { fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#888', marginBottom: '0.6rem' },
  msgItem: { background: '#fafafa', borderRadius: 4, padding: '0.65rem 0.8rem', marginBottom: 8 },
  msgSubject: { fontWeight: 500, fontSize: '0.88rem', marginBottom: 4 },
  msgBody: { fontSize: '0.84rem', color: '#444', marginBottom: 4 },
  msgDate: { fontSize: '0.75rem', color: '#999' },
  btnSm: { background: 'white', border: '1px solid #ddd', borderRadius: 4, padding: '0.35rem 0.85rem', fontSize: '0.8rem', cursor: 'pointer' },
  btnPrimary: { background: '#2d4a2d', color: 'white', border: 'none', borderRadius: 4, padding: '0.35rem 0.85rem', fontSize: '0.8rem', cursor: 'pointer' },
  btnDanger: { background: 'white', border: '1px solid #e88', color: '#c33', borderRadius: 4, padding: '0.35rem 0.85rem', fontSize: '0.8rem', cursor: 'pointer' },
};
