import { z } from 'zod';

export const TenantFeatureSchema = z.object({
  monitoring: z.boolean().default(true),
  actions: z.boolean().default(false)
});

export const TenantConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  baseUrl: z.string().url(),
  apiKey: z.string().min(1),
  timezone: z.string().min(1).default('UTC'),
  features: TenantFeatureSchema.default({ monitoring: true, actions: false })
});

export type TenantConfig = z.infer<typeof TenantConfigSchema>;

export const TenantsFileSchema = z.object({
  tenants: z.array(TenantConfigSchema)
});

export type TenantsFile = z.infer<typeof TenantsFileSchema>;
