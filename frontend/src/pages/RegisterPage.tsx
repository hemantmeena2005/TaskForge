import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "@/lib/api";
import { useAuthStore } from "@/lib/auth";

export default function RegisterPage() {
  const navigate = useNavigate();
  const setTokens = useAuthStore((s) => s.setTokens);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await api.post("/auth/register", {
        email,
        username,
        full_name: fullName || null,
        password,
      });
      setTokens(res.data.access_token, res.data.refresh_token);
      navigate("/dashboard");
    } catch (err) {
      setError((err as Error).message || "Registration failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "radial-gradient(circle at 30% 20%, #1c1510 0%, var(--bg-0) 55%)" }}>
      <div className="w-[380px] bg-[var(--bg-1)] border border-[var(--border)] rounded-xl p-8">
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-7 h-7 rounded-md bg-gradient-to-br from-[var(--ember)] to-[#C9401A] flex items-center justify-center text-xs font-bold text-[#1a0d05] font-display">
            TF
          </div>
          <span className="font-display font-bold text-[var(--text-hi)]">TaskForge</span>
        </div>
        <div className="font-display text-lg font-bold mb-1">Create account</div>
        <div className="text-[12px] text-[var(--text-mid)] mb-6">Get started with TaskForge</div>

        {error && (
          <div className="mb-4 bg-[var(--red)]/10 border border-[var(--red)]/30 text-[var(--red)] px-4 py-3 rounded-lg text-sm">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] text-[var(--text-mid)] mb-1.5">Email</label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[var(--bg-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-hi)] focus:outline-none focus:border-[var(--steel)]"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-[11px] text-[var(--text-mid)] mb-1.5">Username</label>
            <input
              type="text"
              required
              pattern="^[a-zA-Z0-9_-]+$"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-[var(--bg-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-hi)] focus:outline-none focus:border-[var(--steel)]"
              placeholder="janedoe"
            />
          </div>
          <div>
            <label className="block text-[11px] text-[var(--text-mid)] mb-1.5">Full Name <span className="text-[var(--text-lo)]">(optional)</span></label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full bg-[var(--bg-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-hi)] focus:outline-none focus:border-[var(--steel)]"
              placeholder="Jane Doe"
            />
          </div>
          <div>
            <label className="block text-[11px] text-[var(--text-mid)] mb-1.5">Password</label>
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[var(--bg-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-hi)] focus:outline-none focus:border-[var(--steel)]"
              placeholder="At least 8 characters"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-[var(--ember)] text-[#20100A] rounded-lg py-2.5 text-sm font-bold hover:opacity-90 disabled:opacity-50 transition mt-2"
          >
            {submitting ? "Creating account..." : "Create account"}
          </button>
        </form>

        <div className="text-center text-[12px] text-[var(--text-lo)] mt-5">
          Already have an account?{" "}
          <Link to="/login" className="text-[var(--steel)] hover:underline">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
