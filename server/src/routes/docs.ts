// src/routes/docs.ts
// Admin: shared-docs shares, folders, files (/api/docs). Public pages live in routes/sharePages.ts.

import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { requireAdmin } from '../middleware/auth';
import * as Docs from '../services/SharedDocsService';
import { DocsError, MAX_FILE_BYTES } from '../services/SharedDocsService';
import { storageDriver } from '../lib/storage';

const router = Router();
router.use(requireAdmin);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE_BYTES, files: 20 } });

type Handler<P> = (req: Request<P>, res: Response) => Promise<void>;

function wrap<P = Record<string, string>>(fn: Handler<P>) {
  return (req: Request<P>, res: Response, next: NextFunction) => {
    fn(req, res).catch((err) => {
      if (err instanceof DocsError) {
        res.status(err.status).json({ error: err.message });
        return;
      }
      next(err);
    });
  };
}

const body = (req: Request<unknown>) => (req.body ?? {}) as Record<string, unknown>;
const optId = (v: unknown) => (typeof v === 'string' && v ? v : null);

router.get('/config', (_req, res) => {
  res.json({ driver: storageDriver(), maxFileBytes: MAX_FILE_BYTES });
});

router.get('/shares', wrap(async (_req, res) => { res.json(await Docs.listShares()); }));
router.post('/shares', wrap(async (req, res) => { res.status(201).json(await Docs.createShare(body(req).name)); }));
router.get('/shares/:id', wrap<{ id: string }>(async (req, res) => { res.json(await Docs.getShareTree(req.params.id)); }));
router.patch('/shares/:id', wrap<{ id: string }>(async (req, res) => {
  const b = body(req);
  res.json(await Docs.updateShare(req.params.id, {
    name: b.name, active: b.active, regenerate: b.regenerate, allowDownload: b.allowDownload, watermarkText: b.watermarkText,
  }));
}));
router.delete('/shares/:id', wrap<{ id: string }>(async (req, res) => {
  await Docs.deleteShare(req.params.id);
  res.status(204).send();
}));

router.post('/shares/:id/folders', wrap<{ id: string }>(async (req, res) => {
  const b = body(req);
  res.status(201).json(await Docs.createFolder(req.params.id, optId(b.parentId), b.name));
}));
router.patch('/shares/:id/folders/:folderId', wrap<{ id: string; folderId: string }>(async (req, res) => {
  res.json(await Docs.renameFolder(req.params.id, req.params.folderId, body(req).name));
}));
router.delete('/shares/:id/folders/:folderId', wrap<{ id: string; folderId: string }>(async (req, res) => {
  await Docs.deleteFolder(req.params.id, req.params.folderId);
  res.status(204).send();
}));

router.post('/shares/:id/files', (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  upload.array('files')(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      const msg = err.code === 'LIMIT_FILE_SIZE'
        ? `Each file must be ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} MB or smaller`
        : err.code === 'LIMIT_FILE_COUNT' ? 'Upload at most 20 files at a time' : err.message;
      res.status(413).json({ error: msg });
      return;
    }
    if (err) return next(err);
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    Docs.uploadFiles(req.params.id, optId(req.query.folderId), files)
      .then((created) => res.status(201).json(created))
      .catch((e) => (e instanceof DocsError ? res.status(e.status).json({ error: e.message }) : next(e)));
  });
});
router.patch('/shares/:id/files/:fileId', wrap<{ id: string; fileId: string }>(async (req, res) => {
  res.json(await Docs.renameFile(req.params.id, req.params.fileId, body(req).name));
}));
router.delete('/shares/:id/files/:fileId', wrap<{ id: string; fileId: string }>(async (req, res) => {
  await Docs.deleteFile(req.params.id, req.params.fileId);
  res.status(204).send();
}));

export default router;
