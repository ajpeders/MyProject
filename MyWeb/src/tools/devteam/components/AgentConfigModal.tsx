import type { AgentConfig } from "../../../api/devteam";

interface AgentConfigModalProps {
  config: AgentConfig;
  onClose: () => void;
}

export default function AgentConfigModal({ config, onClose }: AgentConfigModalProps) {
  return (
    <div className="devteam-modal-overlay" onClick={onClose}>
      <div className="devteam-modal" onClick={(e) => e.stopPropagation()}>
        <div className="devteam-modal-header">
          <h2>Agent Config</h2>
          <span className={`type-badge type-${config.type}`}>{config.type}</span>
          <button type="button" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="devteam-modal-body">
          <dl className="devteam-detail-grid">
            <dt>Type</dt>
            <dd>{config.type}</dd>

            <dt>LLM Model</dt>
            <dd>{config.llm_model ?? "—"}</dd>

            <dt>Memory Limit</dt>
            <dd>{config.max_memory_mb != null ? `${config.max_memory_mb} MB` : "—"}</dd>

            <dt>CPU Limit</dt>
            <dd>{config.max_cpu_percent != null ? `${config.max_cpu_percent}%` : "—"}</dd>
          </dl>
        </div>
      </div>
    </div>
  );
}