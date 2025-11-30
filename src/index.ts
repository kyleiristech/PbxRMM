import { existsSync } from 'node:fs';
import path from 'node:path';

import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';

import { appConfig, loadTenantConfig } from './config';
import { buildPbxRouter } from './routes/pbxRoutes';
import { MonitoringService } from './services/monitoringService';
import { SnapshotStore } from './store/snapshotStore';
import { Poller } from './jobs/poller';
import { logger } from './utils/logger';

const app = express();
app.use(helmet());
app.use(express.json({ limit: '64kb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('tiny'));

const tenants = loadTenantConfig();
const monitoringService = new MonitoringService(tenants);
const snapshotStore = new SnapshotStore();

const poller = new Poller(monitoringService, snapshotStore, appConfig.POLL_INTERVAL_SECONDS);
if (tenants.length > 0) {
  poller.start();
} else {
  logger.warn('No tenants configured. Waiting for tenant configuration before polling.');
}

app.get('/healthz', (_req, res) => {
  res.json({
    status: 'ok',
    tenants: tenants.length,
    intervalSeconds: appConfig.POLL_INTERVAL_SECONDS
  });
});

app.use('/api', buildPbxRouter(monitoringService, snapshotStore));

const frontendDir = path.resolve(__dirname, '../frontend/dist');
if (existsSync(frontendDir)) {
  logger.info({ frontendDir }, 'Serving static frontend assets');
  app.use(express.static(frontendDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    return res.sendFile(path.join(frontendDir, 'index.html'));
  });
} else {
  logger.warn({ frontendDir }, 'Frontend build not found. UI will be unavailable until built.');
}

const server = app.listen(appConfig.PORT, () => {
  logger.info({ port: appConfig.PORT }, '3CX Remote Management service started');
});

const shutdown = () => {
  logger.info('Received shutdown signal, stopping server...');
  poller.stop();
  server.close(() => process.exit(0));
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
