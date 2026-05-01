interface DevTeamHeaderProps {
  nodeInfo: { node_id?: string; status?: string; version?: string } | null;
  wsConnected: boolean;
}

export default function DevTeamHeader({ nodeInfo, wsConnected }: DevTeamHeaderProps) {
  return (
    <div className="devteam-header">
      <div className="devteam-header-row">
        <div>
          <h1>DevTeam Agent Dashboard</h1>
          <p>Task pipeline: Dev → Review → QA → Deploy</p>
        </div>
        <div className="devteam-ws-indicator" title={wsConnected ? "Real-time connected" : "Reconnecting..."}>
          <span className={`ws-dot ${wsConnected ? "ws-connected" : "ws-dead"}`} />
          {wsConnected ? "Live" : "Reconnecting"}
        </div>
      </div>
      {nodeInfo ? (
        <div className="devteam-node-info" aria-label="Node info">
          {nodeInfo.node_id ? <span>Node {String(nodeInfo.node_id)}</span> : null}
          {nodeInfo.status ? <span>{String(nodeInfo.status)}</span> : null}
          {nodeInfo.version ? <span>v{String(nodeInfo.version)}</span> : null}
        </div>
      ) : null}
    </div>
  );
}