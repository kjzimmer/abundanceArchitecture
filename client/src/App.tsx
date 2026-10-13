import { useState, useEffect, useCallback } from 'react';
import { apiFetch, tryRestoreSession } from './api';
import Login from './components/Login';
import AdminLayout from './components/AdminLayout';
import type { Tab } from './components/AdminLayout';
import AdminPeople from './components/AdminPeople';
import AdminInbox from './components/AdminInbox';
import type { ComposeRequest } from './components/AdminInbox';
import AdminGroups from './components/AdminGroups';
import AdminAnalytics from './components/AdminAnalytics';
import AdminSettings from './components/AdminSettings';
import AdminNewsletter from './components/AdminNewsletter';
import AdminDocs from './components/AdminDocs';

interface InboxSummary { open: number; waiting: number; closed: number; unread: number }

export default function App() {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [tab, setTab] = useState<Tab>('analytics');
  // Inbox nav badge = conversations that need a response (Open)
  const [openCount, setOpenCount] = useState(0);
  // "Email this group" (Groups) → Inbox opens Compose with the members
  const [composeRequest, setComposeRequest] = useState<ComposeRequest | null>(null);

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
  const clearComposeRequest = useCallback(() => setComposeRequest(null), []);

  if (checking) return null;

  if (!authed) {
    return <Login onLogin={() => setAuthed(true)} />;
  }

  return (
    <AdminLayout activeTab={tab} onTabChange={setTab} unreadCount={openCount}>
      {tab === 'analytics' && <AdminAnalytics />}
      {tab === 'people' && <AdminPeople />}
      {tab === 'groups' && <AdminGroups onEmailGroup={(groupId) => { setComposeRequest({ groupId }); setTab('inbox'); }} />}
      {tab === 'inbox' && <AdminInbox onSummaryChange={onInboxSummary}
        composeRequest={composeRequest} onComposeRequestHandled={clearComposeRequest} />}
      {tab === 'newsletter' && <AdminNewsletter />}
      {tab === 'documents' && <AdminDocs />}
      {tab === 'settings' && <AdminSettings />}
    </AdminLayout>
  );
}
