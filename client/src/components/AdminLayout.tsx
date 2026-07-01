import { ReactNode } from 'react';
import { apiFetch, clearAccessToken } from '../api';

export type Tab = 'dashboard' | 'people' | 'inbox';

interface Props {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  unreadCount?: number;
  children: ReactNode;
}

const NAV_ITEMS: { id: Tab; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'people', label: 'People' },
  { id: 'inbox', label: 'Inbox' },
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
      <nav style={styles.nav}>
        <div style={styles.navTop}>
          <a href="/" target="_blank" rel="noopener noreferrer" style={styles.siteLink}>
            <div style={styles.siteName}>Abundance Architecture</div>
            <div style={styles.siteLabel}>Admin</div>
          </a>
          <div style={styles.navItems}>
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                style={{ ...styles.navItem, ...(activeTab === item.id ? styles.navItemActive : {}) }}
              >
                {item.label}
                {item.id === 'inbox' && unreadCount > 0 && (
                  <span style={styles.badge}>{unreadCount}</span>
                )}
              </button>
            ))}
          </div>
        </div>
        <button onClick={handleLogout} style={styles.logout}>Sign out</button>
      </nav>
      <main style={styles.main}>{children}</main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  shell: { display: 'flex', minHeight: '100vh', background: '#f5f5f3' },
  nav: { width: 240, flexShrink: 0, background: '#1a1917', display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, height: '100vh', overflowY: 'auto' },
  navTop: { flex: 1, display: 'flex', flexDirection: 'column' },
  siteLink: { display: 'block', padding: '1.5rem 1.25rem 1.25rem', textDecoration: 'none', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: '0.5rem' },
  siteName: { fontSize: '0.82rem', fontWeight: 600, color: 'white', letterSpacing: '0.04em', lineHeight: 1.3 },
  siteLabel: { fontSize: '0.7rem', color: 'rgba(255,255,255,0.38)', marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.08em' },
  navItems: { display: 'flex', flexDirection: 'column' },
  navItem: { display: 'flex', alignItems: 'center', width: '100%', background: 'transparent', border: 'none', borderLeft: '3px solid transparent', color: 'rgba(255,255,255,0.5)', padding: '0.7rem 1.25rem', fontSize: '0.85rem', fontWeight: 500, cursor: 'pointer', textAlign: 'left' as const },
  navItemActive: { color: 'white', background: 'rgba(255,255,255,0.07)', borderLeftColor: '#6a9e6a' },
  badge: { marginLeft: 'auto', background: '#c44', color: 'white', borderRadius: 10, fontSize: '0.68rem', fontWeight: 700, padding: '1px 6px' },
  logout: { width: '100%', background: 'transparent', border: 'none', borderTop: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.38)', padding: '1rem 1.25rem', fontSize: '0.8rem', cursor: 'pointer', textAlign: 'left' as const },
  main: { flex: 1, padding: '2rem', minWidth: 0, overflowY: 'auto' },
};
