import { ThreeCxClient } from '../clients/threeCxClient';
import { TenantConfig } from '../types/tenant';
import {
  MaintenanceActionRequest,
  MaintenanceRecommendation,
  PbxSnapshot,
  SystemHealth,
  TrunkStatus
} from '../types/monitoring';
import { logger } from '../utils/logger';

export class MonitoringService {
  private readonly clientCache = new Map<string, ThreeCxClient>();

  constructor(private readonly tenants: TenantConfig[]) {}

  listTenants(): Array<Omit<TenantConfig, 'apiKey'>> {
    return this.tenants.map(({ apiKey: _apiKey, ...rest }) => rest);
  }

  getTenant(tenantId: string): TenantConfig | undefined {
    return this.tenants.find((tenant) => tenant.id === tenantId);
  }

  async collectSnapshot(tenantId: string): Promise<PbxSnapshot> {
    const tenant = this.ensureTenant(tenantId);
    const client = this.getClient(tenant);

    const [systemHealth, activeCalls, queueStats, trunkStats, extensionStats] = await Promise.all([
      client.getSystemHealth(),
      client.getActiveCalls(),
      client.getQueueStats(),
      client.getTrunkStatus(),
      client.getExtensionStatus()
    ]);

    const recommendations = this.buildRecommendations(systemHealth, trunkStats);

    const snapshot: PbxSnapshot = {
      tenantId: tenant.id,
      fetchedAtUtc: new Date().toISOString(),
      systemHealth,
      activeCalls,
      queueStats,
      extensionStats,
      trunkStats,
      recommendations
    };

    logger.debug({ tenantId }, 'Collected latest PBX snapshot');
    return snapshot;
  }

  async runMaintenanceAction(tenantId: string, action: MaintenanceActionRequest): Promise<{ accepted: boolean }> {
    const tenant = this.ensureTenant(tenantId);
    const client = this.getClient(tenant);

    logger.info({ tenantId, action: action.type }, 'Forwarding maintenance action to 3CX');
    return client.runMaintenanceAction(action);
  }

  private getClient(tenant: TenantConfig): ThreeCxClient {
    if (!this.clientCache.has(tenant.id)) {
      this.clientCache.set(tenant.id, new ThreeCxClient(tenant));
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return this.clientCache.get(tenant.id)!;
  }

  private ensureTenant(tenantId: string): TenantConfig {
    const tenant = this.getTenant(tenantId);
    if (!tenant) {
      throw new Error(`Tenant ${tenantId} not found`);
    }
    return tenant;
  }

  private buildRecommendations(systemHealth: SystemHealth, trunks: TrunkStatus[]): MaintenanceRecommendation[] {
    const recommendations: MaintenanceRecommendation[] = [];

    if (systemHealth.resource.cpu > 80) {
      recommendations.push({
        severity: 'warning',
        message: 'CPU usage above 80% — investigate call load or VM sizing'
      });
    }

    if (systemHealth.resource.memory > 85) {
      recommendations.push({
        severity: 'warning',
        message: 'Memory usage approaching limit — consider restarting services'
      });
    }

    const failingServices = systemHealth.services.filter((service) => service.status !== 'running');
    failingServices.forEach((service) =>
      recommendations.push({
        severity: 'critical',
        message: `Service ${service.name} reported status ${service.status}`
      })
    );

    const downTrunks = trunks.filter((trunk) => trunk.status !== 'up');
    downTrunks.forEach((trunk) =>
      recommendations.push({
        severity: 'critical',
        message: `Trunk ${trunk.trunk} currently ${trunk.status}`
      })
    );

    if (recommendations.length === 0) {
      recommendations.push({
        severity: 'info',
        message: 'All monitored subsystems healthy'
      });
    }

    return recommendations;
  }
}
