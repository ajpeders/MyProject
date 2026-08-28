import type { Agent } from "../../../api/devteam";

function formatTime(ts: string) {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

function truncateId(id: string, len = 12) {
  return id.length > len ? id.slice(0, len) + "…" : id;
}

interface AgentsPanelProps {
  agents: Agent[];
  agentsCollapsed: boolean;
  onToggleCollapse: () => void;
  onShowConfig: (agent: Agent) => void;
  onShowLogs: (agent: Agent) => void;
  loadingConfig: string;
  loadingLogs: string;
}

export default function AgentsPanel({
  agents,
  agentsCollapsed,
  onToggleCollapse,
  onShowConfig,
  onShowLogs,
  loadingConfig,
  loadingLogs,
}: AgentsPanelProps) {
  return (
    <div className="devteam-agents-panel">
      <button
        type="button"
        className="devteam-agents-toggle"
        onClick={onToggleCollapse}
      >
        Agents ({agents.length}) {agentsCollapsed ? "▶" : "▼"}
      </button>
      {!agentsCollapsed && (
        <div className="devteam-agents-list">
          {agents.length === 0 ? (
            <p className="devteam-empty">No agents running</p>
          ) : (
            <table className="devteam-agents-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Memory Limit</th>
                  <th>CPU Limit</th>
                  <th>Last Heartbeat</th>
                  <th>Config</th>
                  <th>Logs</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((agent) => (
                  <tr key={agent.id}>
                    <td>
                      <span className="agent-id">{truncateId(agent.id, 12)}</span>
                    </td>
                    <td>
                      <span className={`type-badge type-${agent.type}`}>{agent.type}</span>
                    </td>
                    <td>
                      <span className={`status-dot ${agent.status === "running" ? "dot-green" : "dot-red"}`} />
                      {agent.status}
                    </td>
                    <td>{agent.max_memory_mb != null ? `${agent.max_memory_mb} MB` : "—"}</td>
                    <td>{agent.max_cpu_percent != null ? `${agent.max_cpu_percent}%` : "—"}</td>
                    <td>{agent.last_heart ? formatTime(agent.last_heart) : "—"}</td>
                    <td>
                      <button
                        type="button"
                        className="devteam-link-button"
                        onClick={() => void onShowConfig(agent)}
                        disabled={loadingConfig === agent.type}
                      >
                        {loadingConfig === agent.type ? "Loading..." : "Config"}
                      </button>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="devteam-link-button"
                        onClick={() => void onShowLogs(agent)}
                        disabled={loadingLogs === agent.id}
                      >
                        {loadingLogs === agent.id ? "Loading..." : "Logs"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}