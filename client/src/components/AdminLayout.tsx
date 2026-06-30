import { ReactNode } from 'react';
import { apiFetch, clearAccessToken } from '../api';

type Tab = 'people' | 'contact' | 'analytics';

interface Props {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  unreadCount?: number;
  children: ReactNode;
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'people', label: 'People' },
  { id: 'contact', label: 'Inbox' },
  { id: 'analytics', label: 'Analytics' },
];

export default function AdminLayout({ activeTab, onTabChange, unreadCount = 0, children }: Props) {
  async function handleLogout() {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // proceed regardless
    }
    clearAccessToken();
    window.location.reload();
  }

  return (
    <div style={styles.shell}>
      <header style={styles.header}>
        <span style={styles.brand}>Abundance Architecture · Admin</span>
        <nav style={styles.nav}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => onTabChange(t.id)}
              style={{ ...styles.tab, ...(activeTab === t.id ? styles.tabActive : {}) }}
            >
              {t.label}
              {t.id === 'contact' && unreadCount > 0 && (
                <span style={styles.badge}>{unreadCount}</span>
              )}
            </button>
          ))}
        </nav>
        <button onClick={handleLogout} style={styles.logout}>Sign out</button>
      </header>
      <main style={styles.main}>{children}</main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  shell: { minHeight: '100vh', background: '#f5f5f3', display: 'flex', flexDirection: 'column' },
  header: { background: '#1a1917', color: 'white', padding: '0 1.5rem', height: 52, display: 'flex', alignItems: 'center', gap: '1.5rem', position: 'sticky', top: 0, zIndex: 100 },
  brand: { fontSize: '0.78rem', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)', marginRight: '0.5rem' },
  nav: { display: 'flex', gap: 2, flex: 1 },
  tab: { background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.55)', padding: '0 0.85rem', height: 52, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 500, position: 'relative', borderBottom: '2px solid transparent' },
  tabActive: { color: 'white', borderBottom: '2px solid #6a9e6a' },
  badge: { background: '#c44', color: 'white', borderRadius: 10, fontSize: '0.68rem', fontWeight: 700, padding: '1px 5px', marginLeft: 5 },
  logout: { background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.6)', borderRadius: 4, padding: '0.3rem 0.75rem', fontSize: '0.78rem', cursor: 'pointer' },
  main: { flex: 1, padding: '2rem 1.5rem', maxWidth: 1100, width: '100%', margin: '0 auto' },
};
