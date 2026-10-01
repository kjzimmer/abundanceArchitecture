import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../api';

interface ShareSummary {
  id: string;
  name: string;
  token: string;
  active: boolean;
  lastAccessAt: string | null;
  createdAt: string;
  fileCount: number;
  folderCount: number;
  totalBytes: number;
}

interface Folder { id: string; name: string; parentId: string | null }
interface FileRow { id: string; name: string; size: number; contentType: string; folderId: string | null; createdAt: string }
interface Tree { share: ShareSummary; folders: Folder[]; files: FileRow[] }

function size(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const shareUrl = (token: string) => `${window.location.origin}/s/${token}`;

export default function AdminDocs() {
  const [shares, setShares] = useState<ShareSummary[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [driver, setDriver] = useState<string | null>(null);

  async function load() {
    setShares(await apiFetch<ShareSummary[]>('/api/docs/shares'));
  }

  useEffect(() => {
    Promise.all([load(), apiFetch<{ driver: string }>('/api/docs/config').then((c) => setDriver(c.driver))])
      .finally(() => setLoading(false));
  }, []);

  async function create() {
    setError(null);
    try {
      const s = await apiFetch<ShareSummary>('/api/docs/shares', { method: 'POST', body: JSON.stringify({ name: newName }) });
      setNewName('');
      await load();
      setOpenId(s.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create share');
    }
  }

  if (loading) return <p style={{ color: '#888' }}>Loading…</p>;
  if (openId) return <ShareView id={openId} onBack={() => { setOpenId(null); load(); }} />;

  return (
    <div>
      <div style={styles.toolbar}>
        <h2 style={styles.heading}>Documents</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New share name (e.g. Book reviewers)"
            style={{ ...styles.input, width: 280 }} onKeyDown={(e) => e.key === 'Enter' && newName.trim() && create()} />
          <button onClick={create} disabled={!newName.trim()} style={styles.btnPrimary}>Create share</button>
        </div>
      </div>
      {driver === 'local' && (
        <p style={styles.warn}>Storage is the local disk (no R2 configured). Fine for development; on Railway, files would be lost on the next deploy.</p>
      )}
      {error && <p style={{ color: '#b22', fontSize: '0.85rem' }}>{error}</p>}
      <p style={styles.hint}>Each share has its own secret link. Anyone with the link can browse and download (read-only). Only you can add or remove files.</p>

      {shares.length === 0 ? (
        <p style={{ color: '#888' }}>No shares yet.</p>
      ) : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead><tr>
              <th style={styles.th}>Share</th><th style={styles.th}>Files</th><th style={styles.th}>Size</th>
              <th style={styles.th}>Link</th><th style={styles.th}>Last opened</th><th style={styles.th}></th>
            </tr></thead>
            <tbody>
              {shares.map((s) => (
                <tr key={s.id}>
                  <td style={{ ...styles.td, fontWeight: 500, cursor: 'pointer' }} onClick={() => setOpenId(s.id)}>{s.name}</td>
                  <td style={styles.td}>{s.fileCount}{s.folderCount ? ` in ${s.folderCount} folder${s.folderCount === 1 ? '' : 's'}` : ''}</td>
                  <td style={styles.td}>{size(s.totalBytes)}</td>
                  <td style={styles.td}>{s.active ? <CopyLink token={s.token} /> : <span style={styles.badgeOff}>revoked</span>}</td>
                  <td style={{ ...styles.td, color: '#888' }}>{s.lastAccessAt ? new Date(s.lastAccessAt).toLocaleString() : 'never'}</td>
                  <td style={{ ...styles.td, textAlign: 'right' }}><button onClick={() => setOpenId(s.id)} style={styles.btnSm}>Open</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CopyLink({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button style={styles.btnSm} onClick={async () => {
      await navigator.clipboard.writeText(shareUrl(token));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    }}>{copied ? 'Copied ✓' : 'Copy link'}</button>
  );
}

function ShareView({ id, onBack }: { id: string; onBack: () => void }) {
  const [tree, setTree] = useState<Tree | null>(null);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function load() { setTree(await apiFetch<Tree>(`/api/docs/shares/${id}`)); }
  useEffect(() => { load(); }, [id]);

  async function act(label: string, fn: () => Promise<unknown>, done?: string) {
    setBusy(true);
    setNotice({ text: `${label}…` });
    try {
      await fn();
      await load();
      setNotice(done ? { text: done } : null);
    } catch (err) {
      setNotice({ text: err instanceof Error ? err.message : `${label} failed`, error: true });
    } finally {
      setBusy(false);
    }
  }

  if (!tree) return <p style={{ color: '#888' }}>Loading…</p>;
  const { share, folders, files } = tree;

  const crumbs: Folder[] = [];
  let cur = folders.find((f) => f.id === folderId);
  while (cur) { crumbs.unshift(cur); cur = folders.find((f) => f.id === cur!.parentId); }
  const subfolders = folders.filter((f) => f.parentId === folderId);
  const here = files.filter((f) => f.folderId === folderId);

  function upload(list: FileList | null) {
    if (!list || list.length === 0) return;
    const form = new FormData();
    [...list].forEach((f) => form.append('files', f));
    const q = folderId ? `?folderId=${encodeURIComponent(folderId)}` : '';
    act('Uploading', () => apiFetch(`/api/docs/shares/${id}/files${q}`, { method: 'POST', body: form }), `Uploaded ${list.length} file${list.length === 1 ? '' : 's'}`);
  }

  function newFolder() {
    const name = window.prompt('Folder name');
    if (!name?.trim()) return;
    act('Creating folder', () => apiFetch(`/api/docs/shares/${id}/folders`, { method: 'POST', body: JSON.stringify({ parentId: folderId, name }) }));
  }

  function renameShare() {
    const name = window.prompt('Share name', share.name);
    if (!name?.trim() || name === share.name) return;
    act('Renaming', () => apiFetch(`/api/docs/shares/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) }));
  }

  return (
    <div>
      <div style={styles.toolbar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={onBack} style={styles.btnSm}>← Documents</button>
          <h2 style={styles.heading}>{share.name}</h2>
          {!share.active && <span style={styles.badgeOff}>revoked</span>}
          <button onClick={renameShare} style={styles.linkBtn}>rename</button>
        </div>
        {notice && <span style={{ fontSize: '0.8rem', color: notice.error ? '#b22' : '#555' }}>{notice.text}</span>}
      </div>

      <div style={styles.linkBox}>
        {share.active ? (
          <>
            <code style={styles.code}>{shareUrl(share.token)}</code>
            <CopyLink token={share.token} />
            <a href={shareUrl(share.token)} target="_blank" rel="noopener noreferrer" style={styles.btnSm}>Open</a>
            <button style={styles.btnSm} disabled={busy}
              onClick={() => window.confirm('Revoke this link? Anyone using it will lose access (you can restore it later).')
                && act('Revoking', () => apiFetch(`/api/docs/shares/${id}`, { method: 'PATCH', body: JSON.stringify({ active: false }) }), 'Link revoked')}>Revoke</button>
            <button style={styles.btnSm} disabled={busy}
              onClick={() => window.confirm('Create a new link? The current link stops working immediately.')
                && act('Regenerating', () => apiFetch(`/api/docs/shares/${id}`, { method: 'PATCH', body: JSON.stringify({ regenerate: true }) }), 'New link created — send it to your collaborators')}>New link</button>
          </>
        ) : (
          <>
            <span style={{ fontSize: '0.85rem', color: '#777' }}>This link is revoked — nobody can open it.</span>
            <button style={styles.btnSm} disabled={busy}
              onClick={() => act('Restoring', () => apiFetch(`/api/docs/shares/${id}`, { method: 'PATCH', body: JSON.stringify({ active: true }) }), 'Link restored')}>Restore</button>
          </>
        )}
        <button style={{ ...styles.btnDanger, marginLeft: 'auto' }} disabled={busy}
          onClick={() => window.confirm(`Delete “${share.name}” and all its files? This can’t be undone.`)
            && act('Deleting', async () => { await apiFetch(`/api/docs/shares/${id}`, { method: 'DELETE' }); onBack(); })}>Delete share</button>
      </div>

      <div style={styles.toolbar}>
        <div style={styles.crumbs}>
          <button onClick={() => setFolderId(null)} style={styles.linkBtn}>{share.name}</button>
          {crumbs.map((c) => <span key={c.id}> / <button onClick={() => setFolderId(c.id)} style={styles.linkBtn}>{c.name}</button></span>)}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={newFolder} style={styles.btnSm} disabled={busy}>New folder</button>
          <button onClick={() => fileInput.current?.click()} style={styles.btnPrimary} disabled={busy}>Upload files</button>
          <input ref={fileInput} type="file" multiple hidden onChange={(e) => { upload(e.target.files); e.target.value = ''; }} />
        </div>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); upload(e.dataTransfer.files); }}
        style={{ ...styles.tableWrap, ...(dragOver ? styles.dropActive : {}) }}
      >
        {subfolders.length === 0 && here.length === 0 ? (
          <p style={{ color: '#888', padding: '1.25rem', margin: 0, fontSize: '0.88rem' }}>Empty folder — drop files here or use Upload.</p>
        ) : (
          <table style={styles.table}>
            <tbody>
              {subfolders.map((f) => (
                <tr key={f.id}>
                  <td style={{ ...styles.td, cursor: 'pointer' }} onClick={() => setFolderId(f.id)}>📁 {f.name}</td>
                  <td style={styles.td}></td><td style={styles.td}></td>
                  <td style={{ ...styles.td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button style={styles.linkBtn} onClick={() => {
                      const name = window.prompt('Rename folder', f.name);
                      if (name?.trim() && name !== f.name) act('Renaming', () => apiFetch(`/api/docs/shares/${id}/folders/${f.id}`, { method: 'PATCH', body: JSON.stringify({ name }) }));
                    }}>rename</button>
                    {' · '}
                    <button style={{ ...styles.linkBtn, color: '#c33' }} onClick={() =>
                      window.confirm(`Delete folder “${f.name}” and everything in it?`)
                      && act('Deleting', () => apiFetch(`/api/docs/shares/${id}/folders/${f.id}`, { method: 'DELETE' }))}>delete</button>
                  </td>
                </tr>
              ))}
              {here.map((f) => (
                <tr key={f.id}>
                  <td style={styles.td}>
                    📄 {share.active
                      ? <a href={`${shareUrl(share.token)}/file/${f.id}`} style={{ color: '#1a1917' }}>{f.name}</a>
                      : f.name}
                  </td>
                  <td style={{ ...styles.td, color: '#888' }}>{size(f.size)}</td>
                  <td style={{ ...styles.td, color: '#888' }}>{new Date(f.createdAt).toLocaleDateString()}</td>
                  <td style={{ ...styles.td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button style={styles.linkBtn} onClick={() => {
                      const name = window.prompt('Rename file', f.name);
                      if (name?.trim() && name !== f.name) act('Renaming', () => apiFetch(`/api/docs/shares/${id}/files/${f.id}`, { method: 'PATCH', body: JSON.stringify({ name }) }));
                    }}>rename</button>
                    {' · '}
                    <button style={{ ...styles.linkBtn, color: '#c33' }} onClick={() =>
                      window.confirm(`Delete “${f.name}”?`)
                      && act('Deleting', () => apiFetch(`/api/docs/shares/${id}/files/${f.id}`, { method: 'DELETE' }))}>delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p style={styles.hint}>Max 50 MB per file, 20 files per upload. You can drag files onto the list.</p>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  toolbar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: '0.9rem' },
  heading: { fontSize: '1.1rem', fontWeight: 600, margin: 0 },
  hint: { fontSize: '0.78rem', color: '#999', margin: '0.5rem 0 1rem' },
  warn: { background: '#fdf3e0', color: '#6b4a00', border: '1px solid #f0dfb8', borderRadius: 4, padding: '0.55rem 0.8rem', fontSize: '0.82rem', margin: '0 0 0.75rem' },
  input: { border: '1px solid #ddd', borderRadius: 4, padding: '0.45rem 0.65rem', fontSize: '0.85rem', fontFamily: 'inherit' },
  tableWrap: { background: 'white', border: '1px solid #e5e5e5', borderRadius: 6, overflowX: 'auto' },
  dropActive: { borderColor: '#2d4a2d', boxShadow: '0 0 0 2px #cfe0cf' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' },
  th: { textAlign: 'left', padding: '0.6rem 0.85rem', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#888', borderBottom: '1px solid #eee' },
  td: { padding: '0.6rem 0.85rem', borderBottom: '1px solid #f3f3f3' },
  linkBox: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', background: 'white', border: '1px solid #e5e5e5', borderRadius: 6, padding: '0.65rem 0.8rem', marginBottom: '1.1rem' },
  code: { fontSize: '0.78rem', background: '#f5f5f3', padding: '0.3rem 0.5rem', borderRadius: 3, wordBreak: 'break-all' },
  crumbs: { fontSize: '0.88rem', color: '#777' },
  badgeOff: { background: '#eee', color: '#777', borderRadius: 3, fontSize: '0.7rem', fontWeight: 600, padding: '2px 7px' },
  linkBtn: { background: 'none', border: 'none', padding: 0, color: '#2d4a2d', cursor: 'pointer', fontSize: '0.8rem', fontFamily: 'inherit' },
  btnSm: { background: 'white', border: '1px solid #ddd', borderRadius: 4, padding: '0.35rem 0.85rem', fontSize: '0.8rem', cursor: 'pointer', color: '#1a1917', textDecoration: 'none' },
  btnPrimary: { background: '#2d4a2d', color: 'white', border: 'none', borderRadius: 4, padding: '0.4rem 0.95rem', fontSize: '0.8rem', cursor: 'pointer' },
  btnDanger: { background: 'white', border: '1px solid #e88', color: '#c33', borderRadius: 4, padding: '0.35rem 0.85rem', fontSize: '0.8rem', cursor: 'pointer' },
};
