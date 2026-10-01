// src/services/SharedDocsService.ts
// Secret-link document shares (docs/wip/shared-docs.md). Admin manages shares, folders and files;
// anyone holding a share's link can browse and download (read-only).

import crypto from 'crypto';
import prisma from '../db';
import { brand } from '../lib/brand';
import * as storage from '../lib/storage';
import { stampPdf } from '../lib/watermark';

export class DocsError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

export const MAX_FILE_BYTES = 50 * 1024 * 1024;

function newToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function cleanName(raw: unknown, what: string): string {
  const name = typeof raw === 'string' ? raw.replace(/[\u0000-\u001f\/\\]/g, ' ').replace(/\s+/g, ' ').trim() : '';
  if (!name) throw new DocsError(`${what} name is required`);
  if (name.length > 200) throw new DocsError(`${what} name is too long`);
  return name;
}

/** Storage-safe version of a filename for the object key (the display name is kept separately). */
function keySafe(name: string): string {
  return name.normalize('NFKD').replace(/[^\w.\-]+/g, '_').replace(/_+/g, '_').slice(0, 120) || 'file';
}

// ─── Shares ───────────────────────────────────────────────────────────────────

export async function listShares() {
  const shares = await prisma.share.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { files: true, folders: true } } },
  });
  const sizes = await prisma.sharedFile.groupBy({ by: ['shareId'], _sum: { size: true } });
  return shares.map(({ _count, ...s }) => ({
    ...s,
    fileCount: _count.files,
    folderCount: _count.folders,
    totalBytes: sizes.find((x) => x.shareId === s.id)?._sum.size ?? 0,
  }));
}

export async function createShare(name: unknown) {
  return prisma.share.create({
    data: { name: cleanName(name, 'Share'), token: newToken(), sourceSite: brand.siteKey },
  });
}

async function requireShare(id: string) {
  const share = await prisma.share.findUnique({ where: { id } });
  if (!share) throw new DocsError('Share not found', 404);
  return share;
}

export interface ShareUpdate {
  name?: unknown;
  active?: unknown;
  regenerate?: unknown;
  allowDownload?: unknown;
  watermarkText?: unknown; // '' or null → default "Confidential · {name}"
}

export async function updateShare(id: string, input: ShareUpdate) {
  await requireShare(id);
  let watermark: string | null | undefined;
  if (input.watermarkText !== undefined) {
    const t = typeof input.watermarkText === 'string' ? input.watermarkText.replace(/\s+/g, ' ').trim() : '';
    if (t.length > 80) throw new DocsError('Watermark text must be 80 characters or fewer');
    watermark = t || null;
  }
  return prisma.share.update({
    where: { id },
    data: {
      ...(input.name !== undefined && { name: cleanName(input.name, 'Share') }),
      ...(typeof input.active === 'boolean' && { active: input.active }),
      ...(input.regenerate === true && { token: newToken() }),
      ...(typeof input.allowDownload === 'boolean' && { allowDownload: input.allowDownload }),
      ...(watermark !== undefined && { watermarkText: watermark }),
    },
  });
}

// ─── Watermarked delivery ─────────────────────────────────────────────────────

export function isPdf(file: { contentType: string; name: string }): boolean {
  return file.contentType === 'application/pdf' || /\.pdf$/i.test(file.name);
}

export function watermarkFor(share: { name: string; watermarkText: string | null }): string {
  return share.watermarkText ?? `Confidential · ${share.name}`;
}

/**
 * The served copy of a PDF: original from storage, stamped with the share's watermark and a dated
 * footer. Throws WatermarkError for PDFs that can't be stamped (encrypted/restricted) — callers must
 * NOT fall back to the original.
 */
export async function stampedPdf(share: { name: string; watermarkText: string | null }, file: { storageKey: string }) {
  const original = await storage.getObject(file.storageKey);
  const date = new Date().toLocaleDateString('en-US', { dateStyle: 'medium' });
  return stampPdf(original, {
    text: watermarkFor(share),
    footer: `Shared privately via ${brand.domain} · ${date} · Not for distribution`,
  });
}

export async function deleteShare(id: string) {
  await requireShare(id);
  const files = await prisma.sharedFile.findMany({ where: { shareId: id }, select: { storageKey: true } });
  await prisma.share.delete({ where: { id } }); // cascades folders + file rows
  await Promise.allSettled(files.map((f) => storage.deleteObject(f.storageKey)));
}

/** Full tree for the admin view: every folder and file in the share. */
export async function getShareTree(id: string) {
  const share = await requireShare(id);
  const [folders, files] = await Promise.all([
    prisma.sharedFolder.findMany({ where: { shareId: id }, orderBy: { name: 'asc' } }),
    prisma.sharedFile.findMany({ where: { shareId: id }, orderBy: { name: 'asc' } }),
  ]);
  return { share, folders, files };
}

// ─── Folders ──────────────────────────────────────────────────────────────────

async function requireFolderInShare(shareId: string, folderId: string | null) {
  if (!folderId) return null;
  const folder = await prisma.sharedFolder.findUnique({ where: { id: folderId } });
  if (!folder || folder.shareId !== shareId) throw new DocsError('Folder not found', 404);
  return folder;
}

export async function createFolder(shareId: string, parentId: string | null, name: unknown) {
  await requireShare(shareId);
  await requireFolderInShare(shareId, parentId);
  const clean = cleanName(name, 'Folder');
  const clash = await prisma.sharedFolder.findFirst({ where: { shareId, parentId, name: clean } });
  if (clash) throw new DocsError(`A folder named “${clean}” already exists here`);
  return prisma.sharedFolder.create({ data: { shareId, parentId, name: clean } });
}

export async function renameFolder(shareId: string, folderId: string, name: unknown) {
  const folder = await requireFolderInShare(shareId, folderId);
  const clean = cleanName(name, 'Folder');
  const clash = await prisma.sharedFolder.findFirst({ where: { shareId, parentId: folder!.parentId, name: clean, id: { not: folderId } } });
  if (clash) throw new DocsError(`A folder named “${clean}” already exists here`);
  return prisma.sharedFolder.update({ where: { id: folderId }, data: { name: clean } });
}

/** Deletes the folder, everything below it, and the stored objects. */
export async function deleteFolder(shareId: string, folderId: string) {
  await requireFolderInShare(shareId, folderId);
  const all = await prisma.sharedFolder.findMany({ where: { shareId }, select: { id: true, parentId: true } });
  const doomed = new Set([folderId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const f of all) {
      if (f.parentId && doomed.has(f.parentId) && !doomed.has(f.id)) { doomed.add(f.id); grew = true; }
    }
  }
  const files = await prisma.sharedFile.findMany({ where: { folderId: { in: [...doomed] } }, select: { storageKey: true } });
  await prisma.sharedFolder.delete({ where: { id: folderId } }); // cascades subfolders + file rows
  await Promise.allSettled(files.map((f) => storage.deleteObject(f.storageKey)));
}

// ─── Files ────────────────────────────────────────────────────────────────────

export interface UploadInput {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export async function uploadFiles(shareId: string, folderId: string | null, uploads: UploadInput[]) {
  await requireShare(shareId);
  await requireFolderInShare(shareId, folderId);
  if (uploads.length === 0) throw new DocsError('No files received');

  const created = [];
  for (const u of uploads) {
    // multer decodes the multipart filename as latin1; browsers send UTF-8
    const name = cleanName(Buffer.from(u.originalname, 'latin1').toString('utf8'), 'File');
    const id = crypto.randomUUID();
    const storageKey = `shares/${shareId}/${id}/${keySafe(name)}`;
    const contentType = u.mimetype || 'application/octet-stream';
    await storage.putObject(storageKey, u.buffer, contentType);
    created.push(await prisma.sharedFile.create({
      data: { shareId, folderId, name, contentType, size: u.size, storageKey },
    }));
  }
  return created;
}

export async function renameFile(shareId: string, fileId: string, name: unknown) {
  const file = await prisma.sharedFile.findUnique({ where: { id: fileId } });
  if (!file || file.shareId !== shareId) throw new DocsError('File not found', 404);
  return prisma.sharedFile.update({ where: { id: fileId }, data: { name: cleanName(name, 'File') } });
}

export async function deleteFile(shareId: string, fileId: string) {
  const file = await prisma.sharedFile.findUnique({ where: { id: fileId } });
  if (!file || file.shareId !== shareId) throw new DocsError('File not found', 404);
  await prisma.sharedFile.delete({ where: { id: fileId } });
  await storage.deleteObject(file.storageKey).catch((err) => console.error('[docs] object delete failed:', err));
}

// ─── Public (token) access ───────────────────────────────────────────────────

/** Active share for a token, or null. Constant-shape lookup: unknown and revoked look the same. */
export async function shareByToken(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const share = await prisma.share.findUnique({ where: { token } });
  if (!share || !share.active) return null;
  prisma.share.update({ where: { id: share.id }, data: { lastAccessAt: new Date() } }).catch(() => undefined);
  return share;
}

/** One folder level of a share for the public page: breadcrumbs, subfolders, files. */
export async function publicListing(shareId: string, folderId: string | null) {
  const folder = folderId ? await prisma.sharedFolder.findUnique({ where: { id: folderId } }) : null;
  if (folderId && (!folder || folder.shareId !== shareId)) return null;

  const [folders, files, all] = await Promise.all([
    prisma.sharedFolder.findMany({ where: { shareId, parentId: folderId }, orderBy: { name: 'asc' } }),
    prisma.sharedFile.findMany({ where: { shareId, folderId }, orderBy: { name: 'asc' } }),
    prisma.sharedFolder.findMany({ where: { shareId }, select: { id: true, name: true, parentId: true } }),
  ]);

  const crumbs: { id: string; name: string }[] = [];
  let cur = folder ? all.find((f) => f.id === folder.id) : undefined;
  while (cur) {
    crumbs.unshift({ id: cur.id, name: cur.name });
    cur = cur.parentId ? all.find((f) => f.id === cur!.parentId) : undefined;
  }
  return { folders, files, crumbs };
}

export async function publicFile(shareId: string, fileId: string) {
  const file = await prisma.sharedFile.findUnique({ where: { id: fileId } });
  if (!file || file.shareId !== shareId) return null;
  return file;
}
