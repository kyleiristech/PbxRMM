export type ServiceStatus = {
  name: string;
  status: 'running' | 'stopped' | 'warning';
  lastRestartUtc?: string;
};

export type ResourceUsage = {
  cpu: number;
  memory: number;
  disk: number;
  alerts: string[];
};

export type ExtensionStatus = {
  extension: string;
  displayName: string;
  registered: boolean;
  lastSeenUtc?: string;
};

export type QueueStat = {
  queue: string;
  waitingCalls: number;
  longestWaitSeconds: number;
  agentsAvailable: number;
};

export type TrunkStatus = {
  trunk: string;
  status: 'up' | 'down' | 'degraded';
  latencyMs?: number;
};

export type ActiveCall = {
  id: string;
  from: string;
  to: string;
  direction: 'inbound' | 'outbound' | 'local';
  startedAtUtc: string;
  durationSeconds: number;
};

export type MaintenanceRecommendation = {
  severity: 'info' | 'warning' | 'critical';
  message: string;
  ref?: string;
};

export type SystemHealth = {
  version: string;
  build: string;
  licenseStatus: string;
  uptimeSeconds: number;
  resource: ResourceUsage;
  services: ServiceStatus[];
};

export type PbxSnapshot = {
  tenantId: string;
  fetchedAtUtc: string;
  systemHealth: SystemHealth;
  activeCalls: ActiveCall[];
  queueStats: QueueStat[];
  extensionStats: ExtensionStatus[];
  trunkStats: TrunkStatus[];
  recommendations: MaintenanceRecommendation[];
};

export type MaintenanceActionType =
  | 'restart-services'
  | 'reboot-instance'
  | 'backup-now'
  | 'apply-updates'
  | 'collect-logs';

export type MaintenanceActionRequest = {
  type: MaintenanceActionType;
  payload?: Record<string, unknown>;
};
