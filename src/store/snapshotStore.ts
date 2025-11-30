import { PbxSnapshot } from '../types/monitoring';

export class SnapshotStore {
  private readonly snapshots = new Map<string, PbxSnapshot>();

  upsert(snapshot: PbxSnapshot): void {
    this.snapshots.set(snapshot.tenantId, snapshot);
  }

  get(tenantId: string): PbxSnapshot | undefined {
    return this.snapshots.get(tenantId);
  }

  list(): PbxSnapshot[] {
    return [...this.snapshots.values()];
  }
}
