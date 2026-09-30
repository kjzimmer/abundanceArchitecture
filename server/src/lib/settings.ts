// src/lib/settings.ts
// Registry of admin-editable settings. Add a setting by adding an entry here — the admin
// Settings page renders it automatically. Secrets (API keys etc.) do NOT belong here;
// they stay in env vars.
//
// Resolution order for a value: saved in DB → env var fallback (if defined) → default.

export type SettingType = 'text' | 'multiline' | 'number';

export interface SettingDefinition {
  key: string;
  group: string;         // section heading on the Settings page
  label: string;
  help: string;
  type: SettingType;
  default: string | null;
  envFallback?: string;  // legacy/bootstrap env var, used only when nothing is saved
  placeholder?: string;
  maxLength?: number;
}

export const SETTINGS = [
  {
    key: 'newsletter.postalAddress',
    group: 'Newsletter',
    label: 'Postal address',
    help: 'Shown in every newsletter footer. US law (CAN-SPAM) requires a valid physical postal address — a PO box or mailbox service is fine. Newsletters can’t be sent until this is set.',
    type: 'multiline',
    default: null,
    envFallback: 'NEWSLETTER_POSTAL_ADDRESS',
    placeholder: 'Abundance Architecture\nPO Box 123\nCity, ST 12345',
    maxLength: 300,
  },
  {
    key: 'inbox.signature',
    group: 'Inbox',
    label: 'Email signature',
    help: 'Added below every reply and new email sent from the Inbox.',
    type: 'multiline',
    default: '— Abundance Architecture\nhttps://abundancearchitecture.world',
    placeholder: 'Karl Zimmer\nAbundance Architecture\nhttps://abundancearchitecture.world',
    maxLength: 500,
  },
] as const satisfies readonly SettingDefinition[];

export type SettingKey = (typeof SETTINGS)[number]['key'];

export function settingDefinition(key: string): SettingDefinition | undefined {
  return (SETTINGS as readonly SettingDefinition[]).find((s) => s.key === key);
}
