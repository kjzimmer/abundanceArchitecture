import { useState, useEffect } from 'react';
import { apiFetch, tryRestoreSession } from './api';
import Login from './components/Login';
import AdminLayout from './components/AdminLayout';
import type { Tab } from './components/AdminLayout';
import AdminPeople from './components/AdminPeople';
import AdminContact from './components/AdminContact';
import AdminAnalytics from './components/AdminAnalytics';
import AdminEmail from './components/AdminEmail';

export default function App() {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [tab, setTab] = useState<Tab>('dashboard');
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    tryRestoreSession().then((ok) => {
      setAuthed(ok);
      setChecking(false);
    });
  }, []);

  // Load unread count on login so the Inbox badge is correct before the Inbox is opened
  useEffect(() => {
    if (!authed) return;
    apiFetch<{ read: boolean }[]>('/api/contact')
      .then((data) => setUnreadCount(data.filter((m) => !m.read).length))
      .catch(() => {});
  }, [authed]);

  if (checking) return null;

  if (!authed) {
    return <Login onLogin={() => setAuthed(true)} />;
  }

  return (
    <AdminLayout activeTab={tab} onTabChange={setTab} unreadCount={unreadCount}>
      {tab === 'dashboard' && <AdminAnalytics />}
      {tab === 'people' && <AdminPeople />}
      {tab === 'inbox' && <AdminContact onUnreadChange={setUnreadCount} />}
      {tab === 'email' && <AdminEmail />}
    </AdminLayout>
  );
}
