import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  type HistoryEntry,
  type TranscriptionResponse,
  type VoiceAgentResponse,
  type VoiceTool,
  deleteTranscript,
  listTranscripts,
  transcribe,
  voiceAgent,
} from "../../api/whisper";

type RecorderState = "idle" | "recording" | "transcribing" | "error";
type Mode = "agent" | "transcribe";

const TOOL_LABELS: Record<VoiceTool, string> = {
  save_note: "Saved a note",
  recall_notes: "Searched notes",
  create_event: "Created event",
  list_events: "Listed events",
  read_mail: "Read mail",
  search_web: "Web search",
  answer: "Answered",
};

const TOOL_DEEPLINKS: Partial<Record<VoiceTool, string>> = {
  save_note: "/memory",
  recall_notes: "/memory",
  create_event: "/calendar",
  list_events: "/calendar",
  read_mail: "/mail",
};

const PREFERRED_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg",
];

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  for (const t of PREFERRED_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return undefined;
}

function formatTimestamp(seconds: number): string {
  return new Date(seconds * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function formatDuration(seconds: number | null): string {
  if (typeof seconds !== "number") return "?";
  return `${seconds.toFixed(1)}s`;
}

function truncate(text: string, max = 80): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

export default function WhisperPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("agent");
  const [state, setState] = useState<RecorderState>("idle");
  const [latest, setLatest] = useState<TranscriptionResponse | null>(null);
  const [latestAgent, setLatestAgent] = useState<VoiceAgentResponse | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState("");
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState("");

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let cancelled = false;
    listTranscripts(50)
      .then((entries) => {
        if (!cancelled) setHistory(entries);
      })
      .catch((err) => {
        if (!cancelled) setHistoryError(err instanceof Error ? err.message : "Failed to load history");
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function releaseStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
  }

  async function startRecording() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (evt) => {
        if (evt.data && evt.data.size > 0) {
          chunksRef.current.push(evt.data);
        }
      };
      recorder.onstop = () => {
        const recordedType = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: recordedType });
        releaseStream();
        if (blob.size === 0) {
          setState("idle");
          setError("No audio captured.");
          return;
        }
        void postBlob(blob);
      };
      recorder.start();
      setState("recording");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not access microphone");
      setState("error");
      releaseStream();
    }
  }

  function stopRecording() {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    setState("transcribing");
    recorder.stop();
  }

  async function postBlob(blob: Blob) {
    const extension = blob.type.includes("mp4") ? "m4a" : "webm";
    const filename = `clip-${Date.now()}.${extension}`;
    try {
      if (mode === "agent") {
        const result = await voiceAgent(blob, { filename });
        setLatestAgent(result);
        setLatest(null);
        setHistory((prev) => [
          {
            transcript_id: result.transcript_id,
            source: "web",
            text: result.transcript,
            language: null,
            duration_seconds: null,
            segments: [],
            model: "",
            captured_at: result.captured_at,
          },
          ...prev,
        ]);
      } else {
        const result = await transcribe(blob, { filename });
        setLatest(result);
        setLatestAgent(null);
        setHistory((prev) => [
          {
            transcript_id: result.transcript_id,
            source: result.source,
            text: result.text,
            language: result.language,
            duration_seconds: result.duration_seconds,
            segments: result.segments,
            model: result.model,
            captured_at: result.captured_at,
          },
          ...prev,
        ]);
      }
      setState("idle");
    } catch (err) {
      setError(err instanceof Error ? err.message : `${mode === "agent" ? "Voice agent" : "Transcription"} failed`);
      setState("error");
    }
  }

  function handleToolDeeplink() {
    if (!latestAgent) return;
    const path = TOOL_DEEPLINKS[latestAgent.tool];
    if (path) navigate(path);
  }

  async function handleDelete(transcriptId: string) {
    setDeletingId(transcriptId);
    const previous = history;
    setHistory((prev) => prev.filter((entry) => entry.transcript_id !== transcriptId));
    try {
      await deleteTranscript(transcriptId);
      if (latest?.transcript_id === transcriptId) setLatest(null);
    } catch (err) {
      setHistory(previous);
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeletingId("");
    }
  }

  function handleHistoryClick(entry: HistoryEntry) {
    setLatest({
      transcript_id: entry.transcript_id,
      text: entry.text,
      language: entry.language,
      duration_seconds: entry.duration_seconds,
      segments: entry.segments,
      model: entry.model,
      source: entry.source,
      captured_at: entry.captured_at,
    });
  }

  const recordLabel = state === "recording" ? "■ Stop" : "● Record";
  const recordDisabled = state === "transcribing";
  const statusLabel: Record<RecorderState, string> = {
    idle: "idle",
    recording: "recording…",
    transcribing: mode === "agent" ? "thinking…" : "transcribing…",
    error: "error",
  };
  const deeplinkPath = latestAgent ? TOOL_DEEPLINKS[latestAgent.tool] : undefined;

  return (
    <section className="whisper-page">
      <header className="whisper-header">
        <h1>Whisper</h1>
        <p>
          Talk to your personal agent. Default mode runs the voice agent —
          transcribes, picks a tool, and replies. Switch to <em>Transcribe</em>
          for raw speech-to-text.
        </p>
      </header>

      <div className="whisper-mode" role="tablist" aria-label="Whisper mode">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "agent"}
          className={`whisper-mode-btn${mode === "agent" ? " is-active" : ""}`}
          onClick={() => setMode("agent")}
          disabled={state === "recording" || state === "transcribing"}
        >
          Agent
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "transcribe"}
          className={`whisper-mode-btn${mode === "transcribe" ? " is-active" : ""}`}
          onClick={() => setMode("transcribe")}
          disabled={state === "recording" || state === "transcribing"}
        >
          Transcribe
        </button>
      </div>

      <div className="whisper-recorder">
        <button
          type="button"
          onClick={state === "recording" ? stopRecording : startRecording}
          disabled={recordDisabled}
          aria-label={state === "recording" ? "Stop recording" : "Start recording"}
        >
          {recordLabel}
        </button>
        <span className="whisper-status">status: {statusLabel[state]}</span>
      </div>

      {error && (
        <div className="whisper-error" role="alert">
          {error}
        </div>
      )}

      {latestAgent && (
        <section className="whisper-agent-card" data-testid="agent-reply-card">
          <div className="whisper-agent-transcript">
            <span className="whisper-agent-label">You said</span>
            <p>{latestAgent.transcript || <em>(empty)</em>}</p>
          </div>
          <div className="whisper-agent-reply">
            <span className="whisper-agent-label">Reply</span>
            <p>{latestAgent.reply}</p>
          </div>
          <div className="whisper-agent-toolbar">
            <span className={`whisper-tool-chip whisper-tool-chip-${latestAgent.tool}`}>
              {TOOL_LABELS[latestAgent.tool] ?? latestAgent.tool}
            </span>
            {deeplinkPath && (
              <button type="button" onClick={handleToolDeeplink} className="whisper-tool-link">
                Open {deeplinkPath} →
              </button>
            )}
            {latestAgent.error && (
              <span className="whisper-agent-error" role="alert">
                {latestAgent.error}
              </span>
            )}
          </div>
        </section>
      )}

      <section className="whisper-latest">
        <h2>{mode === "agent" ? "Raw agent response (JSON)" : "Latest transcript"}</h2>
        {latestAgent ? (
          <pre>{JSON.stringify(latestAgent, null, 2)}</pre>
        ) : latest ? (
          <pre>{JSON.stringify(latest, null, 2)}</pre>
        ) : (
          <p className="whisper-empty">Nothing captured yet in this session.</p>
        )}
      </section>

      <section className="whisper-history">
        <h2>
          History {history.length > 0 ? `(${history.length})` : ""}
        </h2>
        {historyLoading && <p>Loading…</p>}
        {historyError && (
          <p className="whisper-error" role="alert">
            {historyError}
          </p>
        )}
        {!historyLoading && !historyError && history.length === 0 && (
          <p className="whisper-empty">
            No transcripts yet. Hit Record above, or set up the iPhone Shortcut in Settings.
          </p>
        )}
        {history.length > 0 && (
          <ul>
            {history.map((entry) => (
              <li key={entry.transcript_id} className="whisper-history-row">
                <button
                  type="button"
                  className="whisper-history-text"
                  onClick={() => handleHistoryClick(entry)}
                >
                  <span className={`whisper-badge whisper-badge-${entry.source}`}>{entry.source}</span>
                  <span className="whisper-history-time">{formatTimestamp(entry.captured_at)}</span>
                  <span className="whisper-history-duration">{formatDuration(entry.duration_seconds)}</span>
                  <span className="whisper-history-snippet">{truncate(entry.text || "(empty)")}</span>
                </button>
                <button
                  type="button"
                  className="whisper-history-delete"
                  onClick={() => handleDelete(entry.transcript_id)}
                  disabled={deletingId === entry.transcript_id}
                  aria-label="Delete transcript"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
