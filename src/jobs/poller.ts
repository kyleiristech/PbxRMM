import { MonitoringService } from '../services/monitoringService';
import { SnapshotStore } from '../store/snapshotStore';
import { logger } from '../utils/logger';

export class Poller {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly monitoringService: MonitoringService,
    private readonly snapshotStore: SnapshotStore,
    private readonly intervalSeconds: number
  ) {}

  start(): void {
    if (this.timer) {
      return;
    }

    logger.info({ intervalSeconds: this.intervalSeconds }, 'Starting 3CX polling job');
    this.runCycle();
    this.timer = setInterval(() => this.runCycle(), this.intervalSeconds * 1000);
  }

  stop(): void {
    if (this.timer === null) {
      return;
    }

    clearInterval(this.timer);
    this.timer = null;
  }

  private async runCycle(): Promise<void> {
    if (this.running) {
      logger.warn('Previous polling cycle still running, skipping tick');
      return;
    }

    this.running = true;
    const tenants = this.monitoringService.listTenants();

    try {
      await Promise.all(
        tenants.map(async (tenant) => {
          try {
            const snapshot = await this.monitoringService.collectSnapshot(tenant.id);
            this.snapshotStore.upsert(snapshot);
          } catch (error) {
            logger.error({ tenantId: tenant.id, error }, 'Unable to refresh PBX snapshot');
          }
        })
      );
    } finally {
      this.running = false;
    }
  }
}
