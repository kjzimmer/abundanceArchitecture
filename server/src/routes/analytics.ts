import { Router, Request, Response } from 'express';
import prisma from '../db';
import { requireAdmin } from '../middleware/auth';

const router = Router();
router.use(requireAdmin);

let cache: { data: unknown; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 15 * 60 * 1000;

const CF_QUERY = `
  query($zoneTag: String!, $startDate: Date!, $endDate: Date!) {
    viewer {
      zones(filter: { zoneTag: $zoneTag }) {
        httpRequests1dGroups(
          limit: 31
          filter: { date_geq: $startDate, date_leq: $endDate }
          orderBy: [date_ASC]
        ) {
          dimensions { date }
          uniq { uniques }
          sum { requests pageViews bytes countryMap { clientCountryName requests } }
        }
      }
    }
  }
`;

async function fetchFromCloudflare(range: number) {
  const token = process.env.CF_ANALYTICS_TOKEN;
  const zoneTag = process.env.CF_ZONE_ID;
  if (!token || !zoneTag) return null;

  const endDate = new Date().toISOString().slice(0, 10);
  const startDate = new Date(Date.now() - range * 86400000).toISOString().slice(0, 10);

  const resp = await fetch('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: CF_QUERY, variables: { zoneTag, startDate, endDate } }),
  });

  if (!resp.ok) return null;
  const json = (await resp.json()) as {
    data?: { viewer?: { zones?: Array<{ httpRequests1dGroups: Array<{
      dimensions: { date: string };
      uniq: { uniques: number };
      sum: { requests: number; pageViews: number; bytes: number; countryMap: Array<{ clientCountryName: string; requests: number }> };
    }> }> } };
  };

  const groups = json.data?.viewer?.zones?.[0]?.httpRequests1dGroups ?? [];

  const daily = groups.map((g) => ({
    date: g.dimensions.date,
    uniqueVisitors: g.uniq.uniques,
    pageViews: g.sum.pageViews,
    requests: g.sum.requests,
    bytes: g.sum.bytes,
  }));

  const totals = daily.reduce(
    (acc, d) => ({
      uniqueVisitors: acc.uniqueVisitors + d.uniqueVisitors,
      pageViews: acc.pageViews + d.pageViews,
      requests: acc.requests + d.requests,
    }),
    { uniqueVisitors: 0, pageViews: 0, requests: 0 }
  );

  const countryMap: Record<string, number> = {};
  for (const g of groups) {
    for (const c of g.sum.countryMap) {
      countryMap[c.clientCountryName] = (countryMap[c.clientCountryName] ?? 0) + c.requests;
    }
  }
  const countries = Object.entries(countryMap)
    .map(([name, requests]) => ({ name, requests }))
    .sort((a, b) => b.requests - a.requests)
    .slice(0, 6);

  // Write daily aggregates for retention beyond Cloudflare's 30-day window
  for (const d of daily) {
    await prisma.dailyAnalytics.upsert({
      where: { date: new Date(d.date) },
      update: { uniqueVisitors: d.uniqueVisitors, pageViews: d.pageViews, requests: d.requests, bandwidthBytes: BigInt(d.bytes) },
      create: { date: new Date(d.date), site: 'abundance-architecture', uniqueVisitors: d.uniqueVisitors, pageViews: d.pageViews, requests: d.requests, bandwidthBytes: BigInt(d.bytes) },
    }).catch(() => { /* non-fatal */ });
  }

  return { source: 'cloudflare', totals, daily, countries };
}

router.get('/', async (req: Request<unknown, unknown, unknown, { range?: string }>, res: Response) => {
  const range = Math.min(30, Math.max(7, parseInt(req.query.range ?? '30', 10)));

  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    res.json(cache.data);
    return;
  }

  try {
    const data = await fetchFromCloudflare(range);
    if (data) {
      cache = { data, fetchedAt: Date.now() };
      res.json(data);
    } else {
      res.json({ source: 'unavailable', message: 'CF_ANALYTICS_TOKEN or CF_ZONE_ID not configured' });
    }
  } catch (err) {
    console.error('[analytics] error', err);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

export default router;
