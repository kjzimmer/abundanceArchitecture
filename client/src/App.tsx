import { useState, useEffect, useCallback } from 'react';
import { apiFetch, tryRestoreSession } from './api';
import Login from './components/Login';
import AdminLayout from './components/AdminLayout';
import type { Tab } from './components/AdminLayout';
import AdminPeople from './components/AdminPeople';
import AdminInbox from './components/AdminInbox';
import AdminAnalytics from './components/AdminAnalytics';
import AdminSettings from './components/AdminSettings';
import AdminNewsletter from './components/AdminNewsletter';

interface InboxSummary { open: number; waiting: number; closed: number; unread: number }

export default function App() {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [tab, setTab] = useState<Tab>('analytics');
  // Inbox nav badge = conversations that need a response (Open)
  const [openCount, setOpenCount] = useState(0);

  useEffect(() => {
    tryRestoreSession().then((ok) => {
      setAuthed(ok);
      setChecking(false);
    });
  }, []);

  // Load the badge on login so it's correct before the Inbox is opened
  useEffect(() => {
    if (!authed) return;
    apiFetch<InboxSummary>('/api/inbox/summary')
      .then((s) => setOpenCount(s.open))
      .catch(() => {});
  }, [authed]);

  const onInboxSummary = useCallback((s: InboxSummary) => setOpenCount(s.open), []);

  if (checking) return null;

  if (!authed) {
    return <Login onLogin={() => setAuthed(true)} />;
  }

  return (
    <AdminLayout activeTab={tab} onTabChange={setTab} unreadCount={openCount}>
      {tab === 'analytics' && <AdminAnalytics />}
      {tab === 'people' && <AdminPeople />}
      {tab === 'inbox' && <AdminInbox onSummaryChange={onInboxSummary} />}
      {tab === 'newsletter' && <AdminNewsletter />}
      {tab === 'settings' && <AdminSettings />}
    </AdminLayout>
  );
}
