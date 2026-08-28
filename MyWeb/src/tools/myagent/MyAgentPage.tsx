import { type FormEvent, useRef, useState, useEffect } from "react";
import { sendChat, type ActionResponse } from "../../api/chat";
import { getSessionId } from "../../api/auth";

export interface Message {
  role: "user" | "agent";
  content: string;
  timestamp: number;
}

const STORAGE_KEY = "myagent.conversation";

function loadConversation(): Message[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Message[];
  } catch { /* ignore */ }
  return [];
}

function saveConversation(msgs: Message[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs));
}

export default function MyAgentPage() {
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<Message[]>(loadConversation);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sessionId] = useState(getSessionId);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    saveConversation(messages);
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = prompt.trim();
    if (!query || loading) return;

    setPrompt("");
    setLoading(true);
    setError("");

    const userMsg: Message = { role: "user", content: query, timestamp: Date.now() };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const responses = await sendChat({
        prompt: query,
        session_id: sessionId,
      });

      const agentContent = responses
        .map((r: ActionResponse) => r.content)
        .filter(Boolean)
        .join("\n");

      const agentMsg: Message = { role: "agent", content: agentContent, timestamp: Date.now() };
      setMessages((prev) => [...prev, agentMsg]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  function clearHistory() {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
  }

  return (
    <section className="myagent-page">
      <div className="chat-header">
        <h1>MyAgent</h1>
        <p>Local LLM chat with full conversation history.</p>
        <button type="button" className="clear-btn" onClick={clearHistory} disabled={messages.length === 0}>
          Clear history
        </button>
      </div>

      <div className="conversation">
        {messages.length === 0 && (
          <p className="empty-state">Send a message to start the conversation.</p>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.role}`}>
            <div className="message-role">{msg.role === "user" ? "You" : "Agent"}</div>
            <div className="message-content">{msg.content}</div>
          </div>
        ))}
        {loading && (
          <div className="message agent">
            <div className="message-role">Agent</div>
            <div className="message-content loading">Thinking...</div>
          </div>
        )}
        {error ? <p className="chat-error" role="alert">{error}</p> : null}
        <div ref={bottomRef} />
      </div>

      <form className="chat-form" onSubmit={handleSubmit}>
        <label htmlFor="agent-prompt">Message</label>
        <div className="chat-row">
          <input
            id="agent-prompt"
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ask anything..."
            disabled={loading}
          />
          <button type="submit" disabled={loading || !prompt.trim()}>
            {loading ? "Thinking..." : "Send"}
          </button>
        </div>
      </form>
    </section>
  );
}