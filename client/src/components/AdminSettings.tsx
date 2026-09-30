import { useEffect, useState } from 'react';
import { apiFetch } from '../api';
import AdminEmail from './AdminEmail';

type SettingType = 'text' | 'multiline' | 'number';

interface Setting {
  key: string;
  group: string;
  label: string;
  help: string;
  type: SettingType;
  value: string | null;
  source: 'saved' | 'env' | 'default';
  envFallback?: string;
  placeholder?: string;
  maxLength?: number;
  updatedAt: string | null;
}

export default function AdminSettings() {
  const [view, setView] = useState<'general' | 'email'>('general');

  return (
    <div>
      <div style={styles.toolbar}>
        <h2 style={styles.heading}>Settings</h2>
      </div>
      <div style={styles.tabs}>
        <button onClick={() => setView('general')} style={{ ...styles.tab, ...(view === 'general' ? styles.tabActive : {}) }}>
          General
        </button>
        <button onClick={() => setView('email')} style={{ ...styles.tab, ...(view === 'email' ? styles.tabActive : {}) }}>
          Email delivery
        </button>
      </div>
      {view === 'general' ? <GeneralSettings /> : <AdminEmail />}
    </div>
  );
}

function GeneralSettings() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<Setting[]>('/api/settings').then(setSettings).finally(() => setLoading(false));
  }, []);

  if (loading) return <p style={{ color: '#888' }}>Loading…</p>;

  const groups = [...new Set(settings.map((s) => s.group))];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: 720 }}>
      {groups.map((g) => (
        <section key={g} style={styles.card}>
          <h3 style={styles.groupTitle}>{g}</h3>
          {settings.filter((s) => s.group === g).map((s) => (
            <SettingField key={s.key} setting={s}
              onSaved={(updated) => setSettings((prev) => prev.map((x) => (x.key === updated.key ? updated : x)))} />
          ))}
        </section>
      ))}
    </div>
  );
}

function SettingField({ setting, onSaved }: { setting: Setting; onSaved: (s: Setting) => void }) {
  const initial = setting.source === 'saved' ? setting.value ?? '' : '';
  const [value, setValue] = useState(initial);
  const [status, setStatus] = useState<{ text: string; error?: boolean } | null>(null);
  const dirty = value.trim() !== initial.trim();

  async function save() {
    setStatus({ text: 'Saving…' });
    try {
      const updated = await apiFetch<Setting>(`/api/settings/${encodeURIComponent(setting.key)}`, {
        method: 'PUT',
        body: JSON.stringify({ value }),
      });
      onSaved(updated);
      setValue(updated.source === 'saved' ? updated.value ?? '' : '');
      setStatus({ text: 'Saved' });
    } catch (err) {
      setStatus({ text: err instanceof Error ? err.message : 'Save failed', error: true });
    }
  }

  const inputProps = {
    value,
    placeholder: setting.source !== 'saved' && setting.value ? setting.value : setting.placeholder,
    maxLength: setting.maxLength,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { setValue(e.target.value); setStatus(null); },
    style: styles.input,
  };

  return (
    <div style={styles.field}>
      <label style={styles.label}>{setting.label}</label>
      <p style={styles.help}>{setting.help}</p>
      {setting.type === 'multiline'
        ? <textarea rows={4} {...inputProps} style={{ ...styles.input, resize: 'vertical' }} />
        : <input type={setting.type === 'number' ? 'number' : 'text'} {...inputProps} />}
      <div style={styles.fieldFooter}>
        <span style={styles.source}>
          {setting.source === 'saved' && setting.updatedAt && `Saved ${new Date(setting.updatedAt).toLocaleString()}`}
          {setting.source === 'env' && `Currently from env var ${setting.envFallback} — saving here overrides it`}
          {setting.source === 'default' && !setting.value && 'Not set'}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {status && <span style={{ fontSize: '0.78rem', color: status.error ? '#b22' : '#555' }}>{status.text}</span>}
          <button onClick={save} disabled={!dirty} style={dirty ? styles.btnPrimary : styles.btnDisabled}>Save</button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  toolbar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' },
  heading: { fontSize: '1.1rem', fontWeight: 600, margin: 0 },
  tabs: { display: 'flex', gap: 4, borderBottom: '1px solid #e5e5e5', marginBottom: '1.25rem' },
  tab: { background: 'transparent', border: 'none', borderBottom: '2px solid transparent', padding: '0.5rem 0.9rem', fontSize: '0.85rem', color: '#777', cursor: 'pointer', marginBottom: -1 },
  tabActive: { color: '#1a1917', borderBottomColor: '#2d4a2d', fontWeight: 500 },
  card: { background: 'white', border: '1px solid #e5e5e5', borderRadius: 6, padding: '1.1rem 1.25rem' },
  groupTitle: { fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#888', margin: '0 0 0.9rem' },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: '0.9rem', fontWeight: 600, color: '#333' },
  help: { fontSize: '0.8rem', color: '#777', margin: 0, lineHeight: 1.5 },
  input: { border: '1px solid #ddd', borderRadius: 4, padding: '0.55rem 0.7rem', fontSize: '0.9rem', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' },
  fieldFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  source: { fontSize: '0.75rem', color: '#999' },
  btnPrimary: { background: '#2d4a2d', color: 'white', border: 'none', borderRadius: 4, padding: '0.4rem 0.95rem', fontSize: '0.8rem', cursor: 'pointer' },
  btnDisabled: { background: '#eee', color: '#aaa', border: 'none', borderRadius: 4, padding: '0.4rem 0.95rem', fontSize: '0.8rem', cursor: 'default' },
};
