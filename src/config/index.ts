import { config as loadEnv } from 'dotenv';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

import { TenantConfig, TenantsFileSchema } from '../types/tenant';
import { logger } from '../utils/logger';

loadEnv();

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  TENANT_CONFIG_PATH: z.string().default('./config/tenants.json'),
  POLL_INTERVAL_SECONDS: z.coerce.number().int().min(15).default(60)
});

export type AppConfig = z.infer<typeof envSchema>;

export const appConfig = envSchema.parse(process.env);

export const loadTenantConfig = (): TenantConfig[] => {
  const resolvedPath = path.resolve(process.cwd(), appConfig.TENANT_CONFIG_PATH);

  try {
    const raw = readFileSync(resolvedPath, 'utf-8');
    const parsed = JSON.parse(raw);
    const safeTenants = TenantsFileSchema.parse(parsed);
    logger.info({ tenantCount: safeTenants.tenants.length, resolvedPath }, 'Loaded tenant configuration');
    return safeTenants.tenants;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      logger.warn({ resolvedPath }, 'Tenant configuration file not found. Monitoring disabled until provided.');
    } else {
      logger.error({ error, resolvedPath }, 'Unable to load tenant configuration file');
    }
    return [];
  }
};
