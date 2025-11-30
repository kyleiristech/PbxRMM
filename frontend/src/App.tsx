import { type FormEvent, useEffect, useMemo, useState } from 'react';

import { fetchSnapshot, fetchTenants, runMaintenanceAction } from './api';
import type {
  MaintenanceActionType,
  PbxSnapshot,
  TenantSummary
} from './types';
import './App.css';

const actionOptions: { label: string; value: MaintenanceActionType; description: string }[] = [
  { label: 'Restart Services', value: 'restart-services', description: 'Gracefully restarts PBX services' },
  { label: 'Reboot Instance', value: 'reboot-instance', description: 'Reboots the host VM or appliance' },
  { label: 'Backup Now', value: 'backup-now', description: 'Triggers an immediate backup run' },
  { label: 'Apply Updates', value: 'apply-updates', description: 'Installs pending 3CX patches' },
  { label: 'Collect Logs', value: 'collect-logs', description: 'Bundles diagnostics for download' }
];

const formatDuration = (seconds: number): string => {
  if (!Number.isFinite(seconds)) return '—';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return [d ? `${d}d` : null, h ? `${h}h` : null, m ? `${m}m` : null]
    .filter(Boolean)
    .join(' ');
};

const formatDateTime = (iso?: string): string => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
};

const healthClass = (value: number): string => {
  if (value >= 85) return 'metric critical';
  if (value >= 70) return 'metric warning';
  return 'metric ok';
};

function App() {
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [snapshot, setSnapshot] = useState<PbxSnapshot | null>(null);
  const [loadingTenants, setLoadingTenants] = useState(true);
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [actionType, setActionType] = useState<MaintenanceActionType>('restart-services');
  const [actionNotes, setActionNotes] = useState('');
  const [runningAction, setRunningAction] = useState(false);

  useEffect(() => {
    const loadTenants = async () => {
      try {
        const data = await fetchTenants();
        setTenants(data);
        if (data.length > 0) {
          setSelectedTenantId((current) => current || data[0].id);
        }
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoadingTenants(false);
      }
    };

    loadTenants();
  }, []);

  useEffect(() => {
    if (!selectedTenantId) {
      setSnapshot(null);
      return;
    }

    void loadSnapshot(selectedTenantId);
  }, [selectedTenantId]);

  const loadSnapshot = async (tenantId: string, options?: { refresh?: boolean }) => {
    setLoadingSnapshot(true);
    setError(null);
    try {
      const data = await fetchSnapshot(tenantId, options);
      setSnapshot(data);
      if (!data) {
        setInfoMessage('No cached snapshot yet. Hit “Refresh snapshot” to pull live data.');
      } else if (options?.refresh) {
        setInfoMessage(`Snapshot refreshed at ${formatDateTime(data.fetchedAtUtc)}`);
      } else {
        setInfoMessage(null);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoadingSnapshot(false);
    }
  };

  const handleRefresh = async () => {
    if (!selectedTenantId) return;
    await loadSnapshot(selectedTenantId, { refresh: true });
  };

  const handleAction = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedTenantId) return;

    setRunningAction(true);
    setError(null);
    setInfoMessage(null);

    try {
      await runMaintenanceAction(selectedTenantId, actionType, actionNotes ? { note: actionNotes } : undefined);
      setActionNotes('');
      setInfoMessage('Maintenance action forwarded to PBX. Track status in Recommendations.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRunningAction(false);
    }
  };

  const selectedTenant = tenants.find((tenant) => tenant.id === selectedTenantId);
  const uptime = useMemo(() => (snapshot ? formatDuration(snapshot.systemHealth.uptimeSeconds) : '—'), [snapshot]);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1>3CX Remote Management</h1>
          <p>Monitor tenants, trigger maintenance, and review live health at a glance.</p>
        </div>
        <span className="badge">Beta</span>
      </header>

      <section className="panel">
        <div className="panel-header">
          <h2>Tenants</h2>
          {loadingTenants && <span className="subtle">Loading...</span>}
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        {infoMessage && <div className="alert alert-info">{infoMessage}</div>}
        <div className="tenant-row">
          <label htmlFor="tenant-select">Select tenant</label>
          <select
            id="tenant-select"
            value={selectedTenantId}
            onChange={(event) => setSelectedTenantId(event.target.value)}
            disabled={loadingTenants || tenants.length === 0}
          >
            {tenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.name}
              </option>
            ))}
          </select>
          <button className="ghost" onClick={handleRefresh} disabled={!selectedTenantId || loadingSnapshot}>
            {loadingSnapshot ? 'Refreshing…' : 'Refresh snapshot'}
          </button>
        </div>
        {selectedTenant && (
          <p className="subtle">
            {selectedTenant.baseUrl} • Timezone {selectedTenant.timezone}
          </p>
        )}
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>System health</h2>
          {snapshot && <span className="subtle">Updated {formatDateTime(snapshot.fetchedAtUtc)}</span>}
        </div>
        {!snapshot && !loadingSnapshot && <p>No snapshot yet. Trigger a refresh to ingest the current PBX state.</p>}
        {loadingSnapshot && <p>Loading live data…</p>}
        {snapshot && (
          <div className="metrics-grid">
            <div className="metric-card">
              <h3>Version</h3>
              <p className="metric-text">{snapshot.systemHealth.version} (build {snapshot.systemHealth.build})</p>
              <p className="subtle">License: {snapshot.systemHealth.licenseStatus}</p>
            </div>
            <div className="metric-card">
              <h3>Uptime</h3>
              <p className="metric-text">{uptime}</p>
            </div>
            <div className="metric-card">
              <h3>Resource usage</h3>
              <div className="metric-group">
                <span className={healthClass(snapshot.systemHealth.resource.cpu)}>CPU {snapshot.systemHealth.resource.cpu}%</span>
                <span className={healthClass(snapshot.systemHealth.resource.memory)}>MEM {snapshot.systemHealth.resource.memory}%</span>
                <span className={healthClass(snapshot.systemHealth.resource.disk)}>DISK {snapshot.systemHealth.resource.disk}%</span>
              </div>
            </div>
          </div>
        )}
        {snapshot && (
          <div className="status-columns">
            <div>
              <h4>Services</h4>
              <ul className="status-list">
                {snapshot.systemHealth.services.map((service) => (
                  <li key={service.name} className={`status-pill ${service.status}`}>
                    <span>{service.name}</span>
                    <span>{service.status}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4>Trunks</h4>
              <ul className="status-list">
                {snapshot.trunkStats.map((trunk) => (
                  <li key={trunk.trunk} className={`status-pill ${trunk.status}`}>
                    <span>{trunk.trunk}</span>
                    <span>{trunk.status}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4>Recommendations</h4>
              <ul className="recommendations">
                {snapshot.recommendations.map((item, index) => (
                  <li key={index} className={`recommendation ${item.severity}`}>
                    <strong>{item.severity.toUpperCase()}</strong>
                    <span>{item.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </section>

      {snapshot && (
        <section className="panel data-panel">
          <div className="data-grid">
            <div>
              <h3>Active calls ({snapshot.activeCalls.length})</h3>
              {snapshot.activeCalls.length === 0 ? (
                <p className="subtle">No active calls</p>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>From</th>
                      <th>To</th>
                      <th>Direction</th>
                      <th>Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.activeCalls.map((call) => (
                      <tr key={call.id}>
                        <td>{call.from}</td>
                        <td>{call.to}</td>
                        <td>{call.direction}</td>
                        <td>{formatDuration(call.durationSeconds)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div>
              <h3>Queues</h3>
              {snapshot.queueStats.length === 0 ? (
                <p className="subtle">No queue data</p>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Queue</th>
                      <th>Waiting</th>
                      <th>Longest wait</th>
                      <th>Agents</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.queueStats.map((queue) => (
                      <tr key={queue.queue}>
                        <td>{queue.queue}</td>
                        <td>{queue.waitingCalls}</td>
                        <td>{queue.longestWaitSeconds}s</td>
                        <td>{queue.agentsAvailable}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div>
              <h3>Extensions</h3>
              {snapshot.extensionStats.length === 0 ? (
                <p className="subtle">No extension data</p>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Extension</th>
                      <th>Name</th>
                      <th>Status</th>
                      <th>Last seen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.extensionStats.slice(0, 8).map((ext) => (
                      <tr key={ext.extension}>
                        <td>{ext.extension}</td>
                        <td>{ext.displayName}</td>
                        <td>{ext.registered ? 'Registered' : 'Offline'}</td>
                        <td>{formatDateTime(ext.lastSeenUtc)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {snapshot.extensionStats.length > 8 && (
                <p className="subtle">Showing first 8 of {snapshot.extensionStats.length} entries</p>
              )}
            </div>
          </div>
        </section>
      )}

      <section className="panel">
        <div className="panel-header">
          <h2>Maintenance actions</h2>
          <span className="subtle">Forward safe commands to 3CX</span>
        </div>
        <form className="action-form" onSubmit={handleAction}>
          <label htmlFor="action-select">Action</label>
          <select
            id="action-select"
            value={actionType}
            onChange={(event) => setActionType(event.target.value as MaintenanceActionType)}
            disabled={!selectedTenantId}
          >
            {actionOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="subtle">
            {actionOptions.find((option) => option.value === actionType)?.description}
          </p>

          <label htmlFor="action-notes">Notes (optional)</label>
          <textarea
            id="action-notes"
            placeholder="Why are you running this action?"
            value={actionNotes}
            onChange={(event) => setActionNotes(event.target.value)}
            rows={3}
          />

          <button type="submit" disabled={!selectedTenantId || runningAction}>
            {runningAction ? 'Sending…' : 'Send action'}
          </button>
        </form>
      </section>
    </div>
  );
}

export default App;
