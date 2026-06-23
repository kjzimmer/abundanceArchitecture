import { useEffect, useState } from 'react';
import { apiFetch } from '../api';

interface DailyPoint {
  date: string;
  uniqueVisitors: number;
  pageViews: number;
  requests: number;
}

interface CountryRow {
  name: string;
  requests: number;
}

interface AnalyticsData {
  source: string;
  message?: string;
  totals?: { uniqueVisitors: number; pageViews: number; requests: number };
  daily?: DailyPoint[];
  countries?: CountryRow[];
}

type Range = 7 | 14 | 30;

export default function AdminAnalytics() {
  const [range, setRange] = useState<Range>(30);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiFetch<AnalyticsData>(`/api/analytics?range=${range}`)
      .then(setData)
      .finally(() => setLoading(false));
  }, [range]);

  const unavailable = data?.source === 'unavailable';

  return (
    <div>
      <div style={styles.toolbar}>
        <h2 style={styles.heading}>Analytics</h2>
        <div style={styles.pills}>
          {([7, 14, 30] as Range[]).map((r) => (
            <button key={r} onClick={() => setRange(r)} style={{ ...styles.pill, ...(range === r ? styles.pillActive : {}) }}>
              {r}d
            </button>
          ))}
        </div>
      </div>

      {unavailable && (
        <div style={styles.notice}>
          <strong>Analytics not yet configured.</strong> Add CF_ANALYTICS_TOKEN, CF_ZONE_ID, and CF_ACCOUNT_ID to your environment variables to enable Cloudflare zone analytics.
        </div>
      )}

      {loading && <p style={{ color: '#888' }}>Loading…</p>}

      {!loading && data?.totals && (
        <>
          <div style={styles.statGrid}>
            <StatCard label="Unique Visitors" value={data.totals.uniqueVisitors} />
            <StatCard label="Page Views" value={data.totals.pageViews} />
            <StatCard label="Total Requests" value={data.totals.requests} />
          </div>

          {data.daily && data.daily.length > 0 && (
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Daily visitors (last {range} days)</h3>
              <SimpleBarChart data={data.daily} />
            </div>
          )}

          {data.countries && data.countries.length > 0 && (
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Top countries by requests</h3>
              {data.countries.map((c) => {
                const pct = data.totals ? Math.round((c.requests / data.totals.requests) * 100) : 0;
                return (
                  <div key={c.name} style={styles.countryRow}>
                    <span style={styles.countryName}>{c.name}</span>
                    <div style={styles.barWrap}>
                      <div style={{ ...styles.bar, width: `${pct}%` }} />
                    </div>
                    <span style={styles.countryPct}>{pct}%</span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statValue}>{value.toLocaleString()}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  );
}

function SimpleBarChart({ data }: { data: DailyPoint[] }) {
  const max = Math.max(...data.map((d) => d.uniqueVisitors), 1);
  return (
    <div style={styles.chart}>
      {data.map((d) => {
        const h = Math.max(4, Math.round((d.uniqueVisitors / max) * 80));
        return (
          <div key={d.date} style={styles.barCol} title={`${d.date}: ${d.uniqueVisitors} visitors`}>
            <div style={{ ...styles.chartBar, height: h }} />
            <div style={styles.chartLabel}>{d.date.slice(5)}</div>
          </div>
        );
      })}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  toolbar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' },
  heading: { fontSize: '1.1rem', fontWeight: 600 },
  pills: { display: 'flex', gap: 4 },
  pill: { background: 'white', border: '1px solid #ddd', borderRadius: 4, padding: '0.3rem 0.75rem', fontSize: '0.8rem', cursor: 'pointer' },
  pillActive: { background: '#2d4a2d', color: 'white', borderColor: '#2d4a2d' },
  notice: { background: '#fff8e1', border: '1px solid #ffe082', borderRadius: 6, padding: '1rem 1.25rem', fontSize: '0.88rem', color: '#5a4500', marginBottom: '1.5rem' },
  statGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' },
  statCard: { background: 'white', border: '1px solid #e5e5e5', borderRadius: 6, padding: '1.25rem', textAlign: 'center' },
  statValue: { fontSize: '1.8rem', fontWeight: 700, color: '#1a1917' },
  statLabel: { fontSize: '0.78rem', color: '#888', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.05em' },
  section: { background: 'white', border: '1px solid #e5e5e5', borderRadius: 6, padding: '1.25rem', marginBottom: '1rem' },
  sectionTitle: { fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#888', marginBottom: '1rem' },
  chart: { display: 'flex', alignItems: 'flex-end', gap: 3, height: 100, paddingBottom: 20, overflowX: 'auto' },
  barCol: { display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '1 0 auto', minWidth: 18 },
  chartBar: { width: '100%', background: '#2d4a2d', borderRadius: '2px 2px 0 0' },
  chartLabel: { fontSize: '0.55rem', color: '#aaa', marginTop: 4, whiteSpace: 'nowrap' },
  countryRow: { display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: 8 },
  countryName: { fontSize: '0.85rem', width: 160, flexShrink: 0 },
  barWrap: { flex: 1, background: '#f0f0ee', borderRadius: 2, height: 10, overflow: 'hidden' },
  bar: { height: '100%', background: '#2d4a2d', borderRadius: 2 },
  countryPct: { fontSize: '0.8rem', color: '#666', width: 36, textAlign: 'right' },
};
