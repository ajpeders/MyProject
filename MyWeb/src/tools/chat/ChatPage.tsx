import { type FormEvent, useState } from "react";
import { searchWeb } from "../../api/search";

export default function ChatPage() {
  const [prompt, setPrompt] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = prompt.trim();
    if (!query) return;
    setLoading(true);
    setError("");
    try {
      const response = await searchWeb(query);
      setAnswer(response.answer);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
      setAnswer("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="chat-page">
      <div className="chat-header">
        <h1>Chat</h1>
        <p>Ask a web-backed question.</p>
      </div>

      <form className="chat-form" onSubmit={handleSubmit}>
        <label htmlFor="chat-prompt">Message</label>
        <div className="chat-row">
          <input
            id="chat-prompt"
            type="text"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Search the web for..."
            disabled={loading}
          />
          <button type="submit" disabled={loading || !prompt.trim()}>
            {loading ? "Thinking..." : "Send"}
          </button>
        </div>
      </form>

      {error ? <p className="chat-error" role="alert">{error}</p> : null}

      {answer ? (
        <section className="chat-answer" aria-label="Search answer">
          <h2>Answer</h2>
          <p>{answer}</p>
        </section>
      ) : null}
    </section>
  );
}
