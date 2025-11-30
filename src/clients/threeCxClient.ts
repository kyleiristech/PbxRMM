import axios, { AxiosError, AxiosInstance } from 'axios';

import { TenantConfig } from '../types/tenant';
import {
  ActiveCall,
  MaintenanceActionRequest,
  QueueStat,
  SystemHealth,
  TrunkStatus,
  ExtensionStatus
} from '../types/monitoring';

export class ThreeCxClient {
  private readonly http: AxiosInstance;

  constructor(private readonly tenant: TenantConfig) {
    const base = this.normalizeBaseUrl(tenant.baseUrl);
    this.http = axios.create({
      baseURL: `${base}/api`,
      timeout: 15_000,
      headers: {
        Authorization: `Bearer ${tenant.apiKey}`,
        'Content-Type': 'application/json'
      }
    });
  }

  async getSystemHealth(): Promise<SystemHealth> {
    return this.get<SystemHealth>('/system/health');
  }

  async getActiveCalls(): Promise<ActiveCall[]> {
    return this.get<ActiveCall[]>('/calls/active');
  }

  async getQueueStats(): Promise<QueueStat[]> {
    return this.get<QueueStat[]>('/status/queues');
  }

  async getTrunkStatus(): Promise<TrunkStatus[]> {
    return this.get<TrunkStatus[]>('/status/trunks');
  }

  async getExtensionStatus(): Promise<ExtensionStatus[]> {
    return this.get<ExtensionStatus[]>('/status/extensions');
  }

  async runMaintenanceAction(action: MaintenanceActionRequest): Promise<{ accepted: boolean }> {
    return this.post('/maintenance/actions', action);
  }

  private normalizeBaseUrl(url: string): string {
    return url.endsWith('/') ? url.slice(0, -1) : url;
  }

  private async get<T>(url: string): Promise<T> {
    try {
      const { data } = await this.http.get<T>(url);
      return data;
    } catch (error) {
      throw this.toApiError(error);
    }
  }

  private async post<T>(url: string, body?: unknown): Promise<T> {
    try {
      const { data } = await this.http.post<T>(url, body);
      return data;
    } catch (error) {
      throw this.toApiError(error);
    }
  }

  private toApiError(error: unknown): Error {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{ message?: string }>;
      const status = axiosError.response?.status;
      const message = axiosError.response?.data?.message ?? axiosError.message;
      return new Error(`3CX API error [${this.tenant.name}]${status ? ` (${status})` : ''}: ${message}`);
    }

    return error as Error;
  }
}
