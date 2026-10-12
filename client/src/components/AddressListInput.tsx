import { useState } from 'react';
import RecipientInput from './RecipientInput';

interface Props {
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * A list of addresses shown as chips, with People type-ahead for the next one. Enter, comma,
 * semicolon, Tab or leaving the field adds what's typed; pasting "a@x.com, b@y.com" adds both.
 */
export default function AddressListInput({ label, value, onChange, placeholder, autoFocus }: Props) {
  const [draft, setDraft] = useState('');

  function add(raw: string) {
    const next = [...value];
    for (const part of raw.split(/[,;\s]+/)) {
      const a = part.trim().toLowerCase();
      if (a && !next.includes(a)) next.push(a);
    }
    onChange(next);
    setDraft('');
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (['Enter', ',', ';', 'Tab'].includes(e.key) && draft.trim()) {
      e.preventDefault();
      add(draft);
    } else if (e.key === 'Backspace' && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  }

  function onType(v: string) {
    if (/[,;]/.test(v)) add(v); // pasted list
    else setDraft(v);
  }

  return (
    <div style={styles.row}>
      <span style={styles.label}>{label}</span>
      <div style={styles.box}>
        {value.map((a) => (
          <span key={a} style={{ ...styles.chip, ...(EMAIL_PATTERN.test(a) ? {} : styles.chipBad) }} title={a}>
            {a}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== a))} style={styles.chipX} aria-label={`Remove ${a}`}>×</button>
          </span>
        ))}
        <div style={{ flex: 1, minWidth: 180 }}>
          <RecipientInput value={draft} onChange={onType} onPick={(m) => add(m.email)}
            onKeyDownExtra={onKeyDown} onBlur={() => draft.trim() && add(draft)}
            placeholder={value.length ? '' : placeholder ?? 'Type a name or email'} style={styles.input} autoFocus={autoFocus} />
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  row: { display: 'flex', alignItems: 'flex-start', gap: 8 },
  label: { width: 34, flexShrink: 0, fontSize: '0.8rem', color: '#777', paddingTop: 8 },
  box: { flex: 1, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4, border: '1px solid #ddd', borderRadius: 4, padding: '2px 4px', background: 'white', minWidth: 0 },
  chip: { display: 'inline-flex', alignItems: 'center', gap: 2, background: '#eef3ee', color: '#1a1917', borderRadius: 10, fontSize: '0.78rem', padding: '1px 4px 1px 8px', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' },
  chipBad: { background: '#fbe9e9', color: '#a22' },
  chipX: { background: 'transparent', border: 'none', cursor: 'pointer', color: '#888', fontSize: '0.9rem', lineHeight: 1, padding: '0 3px' },
  input: { border: 'none', outline: 'none', padding: '0.35rem 0.3rem', fontSize: '0.86rem', fontFamily: 'inherit' },
};
