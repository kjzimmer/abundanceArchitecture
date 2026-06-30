import { useState, FormEvent } from 'react';
import { setAccessToken } from '../api';

interface Props {
  onLogin: () => void;
}

export default function Login({ onLogin }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json() as { success?: boolean; accessToken?: string; error?: string };
      if (!res.ok || !data.accessToken) {
        setError(data.error ?? 'Login failed');
        return;
      }
      setAccessToken(data.accessToken);
      onLogin();
    } catch {
      setError('Network error — please try again');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <h1 style={styles.title}>Abundance Architecture</h1>
        <p style={styles.sub}>Admin</p>
        <form onSubmit={handleSubmit}>
          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={styles.input}
              required
              autoFocus
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
              required
            />
          </div>
          {error && <p style={styles.error}>{error}</p>}
          <button type="submit" disabled={loading} style={styles.btn}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f0ee' },
  card: { background: 'white', borderRadius: 6, padding: '2.5rem', width: 360, boxShadow: '0 2px 12px rgba(0,0,0,0.08)' },
  title: { fontSize: '1.1rem', fontWeight: 600, color: '#1a1917', marginBottom: 4 },
  sub: { fontSize: '0.85rem', color: '#888', marginBottom: '2rem' },
  field: { marginBottom: '1rem' },
  label: { display: 'block', fontSize: '0.8rem', fontWeight: 500, color: '#444', marginBottom: 4 },
  input: { width: '100%', border: '1px solid #ddd', borderRadius: 4, padding: '0.55rem 0.75rem', fontSize: '0.9rem', outline: 'none' },
  error: { fontSize: '0.82rem', color: '#c33', marginBottom: '0.75rem' },
  btn: { width: '100%', background: '#2d4a2d', color: 'white', border: 'none', borderRadius: 4, padding: '0.65rem', fontSize: '0.9rem', fontWeight: 500, cursor: 'pointer', marginTop: 4 },
};
