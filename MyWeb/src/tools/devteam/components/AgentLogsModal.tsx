interface AgentLogsModalProps {
  agentId: string;
  lines: string[];
  onClose: () => void;
}

export default function AgentLogsModal({ agentId, lines, onClose }: AgentLogsModalProps) {
  return (
    <div className="devteam-modal-overlay" onClick={onClose}>
      <div className="devteam-modal devteam-log-modal" onClick={(e) => e.stopPropagation()}>
        <div className="devteam-modal-header">
          <h2>Agent Logs</h2>
          <span className="agent-id">{agentId}</span>
          <button type="button" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="devteam-modal-body">
          {lines.length > 0 ? (
            <pre className="devteam-log-output">{lines.join("\n")}</pre>
          ) : (
            <p className="devteam-empty">No logs found.</p>
          )}
        </div>
      </div>
    </div>
  );
}