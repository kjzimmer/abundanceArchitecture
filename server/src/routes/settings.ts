// src/routes/settings.ts
// Admin: list and update app settings.

import { Router, Request, Response } from 'express';
import { requireAdmin } from '../middleware/auth';
import * as SettingsService from '../services/SettingsService';

const router = Router();
router.use(requireAdmin);

router.get('/', async (_req: Request, res: Response) => {
  res.json(await SettingsService.listSettings());
});

router.put('/:key', async (req: Request<{ key: string }>, res: Response) => {
  try {
    const value = (req.body as { value?: unknown } | undefined)?.value ?? null;
    res.json(await SettingsService.updateSetting(req.params.key, value, req.admin?.sub));
  } catch (err) {
    if (err instanceof SettingsService.SettingError) {
      res.status(400).json({ error: err.message });
      return;
    }
    console.error('[settings] update failed:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
