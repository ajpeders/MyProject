import { useState } from "react";
import type { DevTeamProject, DevTeamWebhook } from "../../../api/devteam";

const WEBHOOK_EVENTS = ["task.completed", "task.failed", "task.status_changed", "task.created", "task.approved"];

interface ConnectionPanelProps {
  apiKeyDraft: string;
  onApiKeyDraftChange: (v: string) => void;
  onSaveApiKey: (e: React.FormEvent) => void;
  apiKey: string;
  currentUser: { name: string; is_admin?: boolean } | null;
  projects: DevTeamProject[];
  selectedProjectId: string;
  onProjectChange: (id: string) => void;
  projectName: string;
  onProjectNameChange: (v: string) => void;
  projectRepo: string;
  onProjectRepoChange: (v: string) => void;
  onCreateProject: (e: React.FormEvent) => void;
  onDeleteProject: () => void;
  deletingProject: string;
  webhooks: DevTeamWebhook[];
  webhookUrl: string;
  onWebhookUrlChange: (v: string) => void;
  webhookEvent: string;
  onWebhookEventChange: (v: string) => void;
  onCreateWebhook: (e: React.FormEvent) => void;
  onDeleteWebhook: (w: DevTeamWebhook) => void;
  savingWebhook: boolean;
  deletingWebhook: string;
  createdWebhookSecret: string;
  connectionMessage: string;
}

export default function ConnectionPanel({
  apiKeyDraft,
  onApiKeyDraftChange,
  onSaveApiKey,
  apiKey,
  currentUser,
  projects,
  selectedProjectId,
  onProjectChange,
  projectName,
  onProjectNameChange,
  projectRepo,
  onProjectRepoChange,
  onCreateProject,
  onDeleteProject,
  deletingProject,
  webhooks,
  webhookUrl,
  onWebhookUrlChange,
  webhookEvent,
  onWebhookEventChange,
  onCreateWebhook,
  onDeleteWebhook,
  savingWebhook,
  deletingWebhook,
  createdWebhookSecret,
  connectionMessage,
}: ConnectionPanelProps) {
  const [confirmDeleteProject, setConfirmDeleteProject] = useState(false);
  const [confirmDeleteWebhookId, setConfirmDeleteWebhookId] = useState("");

  return (
    <div className="devteam-connection-panel" aria-label="DevTeam connection">
      <form onSubmit={(e) => void onSaveApiKey(e)} className="devteam-inline-form">
        <label>
          API key
          <input
            type="password"
            value={apiKeyDraft}
            onChange={(e) => onApiKeyDraftChange(e.target.value)}
            placeholder="Required by Python daemon"
          />
        </label>
        <button type="submit">Save Key</button>
      </form>
      {currentUser ? (
        <p className="devteam-connection-message">
          Signed in as {currentUser.name}{currentUser.is_admin ? " (admin)" : ""}
        </p>
      ) : null}
      {apiKey ? (
        <form onSubmit={(e) => void onCreateProject(e)} className="devteam-inline-form">
          <label>
            Project
            <select
              value={selectedProjectId}
              onChange={(e) => onProjectChange(e.target.value)}
              aria-label="DevTeam project"
            >
              <option value="">All available projects</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            New project
            <input
              type="text"
              value={projectName}
              onChange={(e) => onProjectNameChange(e.target.value)}
              placeholder="Name"
            />
          </label>
          <label>
            Repo URL
            <input
              type="text"
              value={projectRepo}
              onChange={(e) => onProjectRepoChange(e.target.value)}
              placeholder="file:///path/to/repo"
            />
          </label>
          <button type="submit" disabled={!projectName.trim() || !projectRepo.trim()}>Create Project</button>
          {confirmDeleteProject ? (
            <span className="settings-confirm-delete">
              Delete project?
              <button
                type="button"
                className="devteam-danger-inline-button"
                onClick={() => { setConfirmDeleteProject(false); void onDeleteProject(); }}
                disabled={deletingProject === selectedProjectId}
              >
                {deletingProject === selectedProjectId ? "Deleting..." : "Yes"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDeleteProject(false)}
              >
                No
              </button>
            </span>
          ) : (
            <button
              type="button"
              className="devteam-danger-inline-button"
              onClick={() => setConfirmDeleteProject(true)}
              disabled={!selectedProjectId || deletingProject === selectedProjectId}
            >
              Delete Project
            </button>
          )}
        </form>
      ) : null}
      {apiKey && selectedProjectId ? (
        <div className="devteam-webhooks-panel" aria-label="Project webhooks">
          <form onSubmit={(e) => void onCreateWebhook(e)} className="devteam-inline-form">
            <label>
              Webhook URL
              <input
                type="url"
                value={webhookUrl}
                onChange={(e) => onWebhookUrlChange(e.target.value)}
                placeholder="https://example.com/devteam"
              />
            </label>
            <label>
              Event
              <select
                value={webhookEvent}
                onChange={(e) => onWebhookEventChange(e.target.value)}
                aria-label="Webhook event"
              >
                <option value="">All events</option>
                {WEBHOOK_EVENTS.map((event) => (
                  <option key={event} value={event}>
                    {event}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" disabled={savingWebhook || !webhookUrl.trim()}>
              {savingWebhook ? "Registering..." : "Register Webhook"}
            </button>
          </form>
          {createdWebhookSecret ? (
            <p className="devteam-created-webhook-secret">
              New webhook secret: <code>{createdWebhookSecret}</code>
            </p>
          ) : null}
          {webhooks.length > 0 ? (
            <div className="devteam-webhooks-list">
              {webhooks.map((webhook) => (
                <div key={webhook.id} className="devteam-webhook-row">
                  <span>{webhook.url}</span>
                  <span>{webhook.events.length > 0 ? webhook.events.join(", ") : "All events"}</span>
                  {confirmDeleteWebhookId === webhook.id ? (
                    <span className="settings-confirm-delete">
                      Delete?
                      <button
                        type="button"
                        className="devteam-link-button"
                        onClick={() => { setConfirmDeleteWebhookId(""); void onDeleteWebhook(webhook); }}
                        disabled={deletingWebhook === webhook.id}
                      >
                        {deletingWebhook === webhook.id ? "..." : "Yes"}
                      </button>
                      <button
                        type="button"
                        className="devteam-link-button"
                        onClick={() => setConfirmDeleteWebhookId("")}
                      >
                        No
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="devteam-link-button"
                      onClick={() => setConfirmDeleteWebhookId(webhook.id)}
                      disabled={deletingWebhook === webhook.id}
                    >
                      Delete
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="devteam-connection-message">No webhooks registered for this project.</p>
          )}
        </div>
      ) : null}
      {connectionMessage ? <p className="devteam-connection-message">{connectionMessage}</p> : null}
    </div>
  );
}