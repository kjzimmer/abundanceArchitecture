// src/lib/storage.ts
// Object storage for uploaded files. Drivers:
//   r2    — Cloudflare R2 via the S3 API (production). Downloads use short-lived presigned URLs.
//   local — files under server/.storage (development + tests). Downloads are streamed by the app.
// STORAGE_DRIVER=r2|local; default is r2 when the R2_* vars are set, otherwise local.

import fs from 'fs';
import path from 'path';
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export type StorageDriver = 'r2' | 'local';

const LOCAL_ROOT = path.join(__dirname, '..', '..', '.storage'); // server/.storage (dist → ../..)

function r2Configured(): boolean {
  return !!(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET);
}

export function storageDriver(): StorageDriver {
  const d = process.env.STORAGE_DRIVER;
  if (d === 'r2' || d === 'local') return d;
  return r2Configured() ? 'r2' : 'local';
}

let client: S3Client | null = null;
function r2(): S3Client {
  if (!r2Configured()) throw new Error('R2 is not configured (R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET)');
  if (!client) {
    client = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID!, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY! },
    });
  }
  return client;
}

function localPath(key: string): string {
  const full = path.resolve(LOCAL_ROOT, key);
  if (!full.startsWith(path.resolve(LOCAL_ROOT) + path.sep)) throw new Error('Invalid storage key');
  return full;
}

export async function putObject(key: string, body: Buffer, contentType: string): Promise<void> {
  if (storageDriver() === 'r2') {
    await r2().send(new PutObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key, Body: body, ContentType: contentType }));
    return;
  }
  const file = localPath(key);
  await fs.promises.mkdir(path.dirname(file), { recursive: true });
  await fs.promises.writeFile(file, body);
}

export async function deleteObject(key: string): Promise<void> {
  if (storageDriver() === 'r2') {
    await r2().send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key }));
    return;
  }
  await fs.promises.rm(localPath(key), { force: true });
}

/** R2: presigned GET URL (valid 5 minutes) that downloads with the given filename. Local: null. */
export async function downloadUrl(key: string, filename: string, contentType: string): Promise<string | null> {
  if (storageDriver() !== 'r2') return null;
  return getSignedUrl(
    r2(),
    new GetObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: key,
      ResponseContentDisposition: contentDisposition(filename),
      ResponseContentType: contentType,
    }),
    { expiresIn: 300 },
  );
}

/** Whole object as bytes (used when the server must transform a file, e.g. watermarking). */
export async function getObject(key: string): Promise<Buffer> {
  if (storageDriver() === 'r2') {
    const out = await r2().send(new GetObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key }));
    if (!out.Body) throw new Error(`Empty object: ${key}`);
    return Buffer.from(await out.Body.transformToByteArray());
  }
  return fs.promises.readFile(localPath(key));
}

/** Local driver only: a readable stream of the stored file. */
export function localReadStream(key: string): fs.ReadStream {
  return fs.createReadStream(localPath(key));
}

/** RFC 6266 attachment header with a UTF-8 filename and an ASCII fallback. */
export function contentDisposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
