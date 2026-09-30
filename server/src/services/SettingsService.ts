// src/services/SettingsService.ts
// Reads/writes admin-editable settings (definitions in lib/settings.ts), scoped to brand.siteKey.

import prisma from '../db';
import { brand } from '../lib/brand';
import { SETTINGS, SettingDefinition, SettingKey, settingDefinition } from '../lib/settings';

export type SettingSource = 'saved' | 'env' | 'default';

export interface ResolvedSetting extends SettingDefinition {
  value: string | null;
  source: SettingSource;
  updatedAt: string | null;
}

function fromEnv(def: SettingDefinition): string | null {
  if (!def.envFallback) return null;
  // Env editors rarely allow real newlines, so accept a literal "\n"
  return process.env[def.envFallback]?.replace(/\\n/g, '\n').trim() || null;
}

export async function getSetting(key: SettingKey): Promise<string | null> {
  const def = settingDefinition(key)!;
  const row = await prisma.setting.findUnique({ where: { siteKey_key: { siteKey: brand.siteKey, key } } });
  if (row && row.value.trim()) return row.value;
  return fromEnv(def) ?? def.default;
}

export async function listSettings(): Promise<ResolvedSetting[]> {
  const rows = await prisma.setting.findMany({ where: { siteKey: brand.siteKey } });
  return (SETTINGS as readonly SettingDefinition[]).map((def) => {
    const row = rows.find((r) => r.key === def.key);
    if (row && row.value.trim()) {
      return { ...def, value: row.value, source: 'saved', updatedAt: row.updatedAt.toISOString() };
    }
    const env = fromEnv(def);
    return { ...def, value: env ?? def.default, source: env ? 'env' : 'default', updatedAt: null };
  });
}

export class SettingError extends Error {}

/** Saves a setting. An empty value clears it (falls back to env/default). */
export async function updateSetting(key: string, rawValue: unknown, adminId?: string): Promise<ResolvedSetting> {
  const def = settingDefinition(key);
  if (!def) throw new SettingError(`Unknown setting: ${key}`);
  if (rawValue !== null && typeof rawValue !== 'string') throw new SettingError('Value must be text');

  const value = (rawValue ?? '').replace(/\r\n/g, '\n').trim();
  if (def.maxLength && value.length > def.maxLength) {
    throw new SettingError(`${def.label} must be ${def.maxLength} characters or fewer`);
  }
  if (def.type === 'number' && value && !Number.isFinite(Number(value))) {
    throw new SettingError(`${def.label} must be a number`);
  }

  const where = { siteKey_key: { siteKey: brand.siteKey, key } };
  if (!value) {
    await prisma.setting.deleteMany({ where: { siteKey: brand.siteKey, key } });
  } else {
    await prisma.setting.upsert({
      where,
      update: { value, updatedById: adminId ?? null },
      create: { siteKey: brand.siteKey, key, value, updatedById: adminId ?? null },
    });
  }
  return (await listSettings()).find((s) => s.key === key)!;
}
