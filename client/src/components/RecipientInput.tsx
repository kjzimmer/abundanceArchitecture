import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../api';

interface Match {
  id: string;
  name: string | null;
  email: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  onPick: (match: Match) => void;
  style?: React.CSSProperties;
  autoFocus?: boolean;
}

/**
 * Email field with type-ahead over People (GET /api/people/lookup). Typing an address that
 * isn't in People still works — the dropdown is only a shortcut.
 */
export default function RecipientInput({ value, onChange, onPick, style, autoFocus }: Props) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const timer = useRef<number | undefined>(undefined);
  const lastPicked = useRef<string | null>(null);

  useEffect(() => {
    window.clearTimeout(timer.current);
    const q = value.trim();
    if (q.length < 2 || q === lastPicked.current) {
      setMatches([]);
      return;
    }
    timer.current = window.setTimeout(async () => {
      try {
        const found = await apiFetch<Match[]>(`/api/people/lookup?q=${encodeURIComponent(q)}`);
        setMatches(found);
        setActive(0);
        setOpen(found.length > 0);
      } catch {
        setMatches([]);
      }
    }, 150);
    return () => window.clearTimeout(timer.current);
  }, [value]);

  function pick(m: Match) {
    lastPicked.current = m.email;
    onPick(m);
    setOpen(false);
    setMatches([]);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || matches.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (a + 1) % matches.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (a - 1 + matches.length) % matches.length); }
    else if (e.key === 'Enter' || e.key === 'Tab') { if (matches[active]) { e.preventDefault(); pick(matches[active]); } }
    else if (e.key === 'Escape') { setOpen(false); }
  }

  return (
    <div style={{ position: 'relative' }}>
      <input
        value={value}
        onChange={(e) => { lastPicked.current = null; onChange(e.target.value); }}
        onKeyDown={onKeyDown}
        onFocus={() => matches.length > 0 && setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)} // let a click on a match land first
        placeholder="To — type a name or email"
        style={{ ...style, width: '100%', boxSizing: 'border-box' }}
        autoFocus={autoFocus}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
      />
      {open && matches.length > 0 && (
        <ul style={styles.menu} role="listbox">
          {matches.map((m, i) => (
            <li key={m.id} role="option" aria-selected={i === active}
              onMouseDown={(e) => { e.preventDefault(); pick(m); }}
              onMouseEnter={() => setActive(i)}
              style={{ ...styles.item, ...(i === active ? styles.itemActive : {}) }}>
              <span style={{ fontWeight: 500 }}>{m.name || m.email}</span>
              {m.name && <span style={styles.email}>{m.email}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  menu: { position: 'absolute', top: 'calc(100% + 2px)', left: 0, right: 0, zIndex: 20, listStyle: 'none', margin: 0, padding: 4, background: 'white', border: '1px solid #ddd', borderRadius: 4, boxShadow: '0 4px 12px rgba(0,0,0,0.08)', maxHeight: 260, overflowY: 'auto' },
  item: { display: 'flex', flexDirection: 'column', padding: '0.4rem 0.55rem', borderRadius: 3, cursor: 'pointer', fontSize: '0.85rem' },
  itemActive: { background: '#eef3ee' },
  email: { fontSize: '0.75rem', color: '#888' },
};
