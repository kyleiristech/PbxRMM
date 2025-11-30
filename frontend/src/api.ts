import type { MaintenanceActionType, PbxSnapshot, TenantSummary } from './types';

const headers = { 'Content-Type': 'application/json' } as const;

const parseError = async (res: Response): Promise<Error> => {
  try {
    const data = await res.json();
    if (data?.message) {
      return new Error(data.message);
    }
  } catch (_) {
    /* ignore body parse failures */
  }
  return new Error(res.statusText || 'Unexpected API error');
};

export const fetchTenants = async (): Promise<TenantSummary[]> => {
  const res = await fetch('/api/tenants');
  if (!res.ok) {
    throw await parseError(res);
  }
  const payload = (await res.json()) as { tenants: TenantSummary[] };
  return payload.tenants;
};

export const fetchSnapshot = async (
  tenantId: string,
  options?: { refresh?: boolean }
): Promise<PbxSnapshot | null> => {
  const refresh = options?.refresh ?? false;
  const path = refresh ? `/api/tenants/${tenantId}/snapshot/refresh` : `/api/tenants/${tenantId}/snapshot`;
  const res = await fetch(path, { method: refresh ? 'POST' : 'GET' });

  if (res.status === 404) {
    return null;
  }

  if (!res.ok) {
    throw await parseError(res);
  }

  return (await res.json()) as PbxSnapshot;
};

export const runMaintenanceAction = async (
  tenantId: string,
  action: MaintenanceActionType,
  payload?: Record<string, unknown>
): Promise<{ accepted: boolean }> => {
  const res = await fetch(`/api/tenants/${tenantId}/actions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload ? { type: action, payload } : { type: action })
  });

  if (!res.ok) {
    throw await parseError(res);
  }

  return (await res.json()) as { accepted: boolean };
};
