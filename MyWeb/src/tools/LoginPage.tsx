import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { loginAccount, registerAccount, storeAuthResponse } from "../api/auth";

export default function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");

    if (mode === "register" && password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const result = mode === "login"
        ? await loginAccount(email, password)
        : await registerAccount(email, password);
      storeAuthResponse(result, email);

      // After register, stay on page — user can add IMAP accounts next
      if (mode === "register") {
        window.location.href = "/";
        return;
      }

      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>MyAgent</h1>
        <p>{mode === "login" ? "Sign in to your account" : "Create your account"}</p>

        <nav className="auth-tabs">
          <button
            type="button"
            className={mode === "login" ? "active" : ""}
            onClick={() => { setMode("login"); setError(""); }}
          >
            Login
          </button>
          <button
            type="button"
            className={mode === "register" ? "active" : ""}
            onClick={() => { setMode("register"); setError(""); }}
          >
            Register
          </button>
        </nav>

        <form onSubmit={handleSubmit}>
          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              required placeholder="you@example.com" />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              required placeholder="••••••••" />
          </label>
          {mode === "register" && (
            <label>
              Confirm Password
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                required placeholder="••••••••" />
            </label>
          )}
          {error ? <p className="auth-error">{error}</p> : null}
          <button type="submit" disabled={loading || !email || !password || (mode === "register" && !confirmPassword)}>
            {loading ? "Connecting..." : mode === "login" ? "Sign In" : "Create Account"}
          </button>
        </form>
      </div>
    </div>
  );
}
