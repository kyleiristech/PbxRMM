import { Router } from 'express';
import { z } from 'zod';

import { MonitoringService } from '../services/monitoringService';
import { SnapshotStore } from '../store/snapshotStore';
import { MaintenanceActionRequest } from '../types/monitoring';

const actionSchema = z.object({
  type: z.enum(['restart-services', 'reboot-instance', 'backup-now', 'apply-updates', 'collect-logs']),
  payload: z.record(z.string(), z.unknown()).optional()
});

export const buildPbxRouter = (monitoringService: MonitoringService, snapshotStore: SnapshotStore): Router => {
  const router = Router();

  router.get('/tenants', (_req, res) => {
    res.json({ tenants: monitoringService.listTenants() });
  });

  router.get('/tenants/:tenantId/snapshot', (req, res) => {
    const snapshot = snapshotStore.get(req.params.tenantId);
    if (!snapshot) {
      return res.status(404).json({ message: 'No snapshot available for tenant' });
    }

    return res.json(snapshot);
  });

  router.post('/tenants/:tenantId/snapshot/refresh', async (req, res) => {
    try {
      const snapshot = await monitoringService.collectSnapshot(req.params.tenantId);
      snapshotStore.upsert(snapshot);
      return res.json(snapshot);
    } catch (error) {
      return res.status(400).json({ message: (error as Error).message });
    }
  });

  router.post('/tenants/:tenantId/actions', async (req, res) => {
    const parsed = actionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({ message: 'Invalid action payload', issues: parsed.error.issues });
    }

    try {
      const action: MaintenanceActionRequest = parsed.data.payload
        ? { type: parsed.data.type, payload: parsed.data.payload }
        : { type: parsed.data.type };

      const result = await monitoringService.runMaintenanceAction(req.params.tenantId, action);
      return res.json(result);
    } catch (error) {
      return res.status(400).json({ message: (error as Error).message });
    }
  });

  return router;
};
