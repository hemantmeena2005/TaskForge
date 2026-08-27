import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";

export default function HomePage() {
  const [health, setHealth] = useState<string>("checking...");

  useEffect(() => {
    api
      .get("/health")
      .then((res) => setHealth(res.data.status))
      .catch(() => setHealth("backend unreachable"));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Welcome to TaskForge</h1>
        <p className="text-[var(--text-mid)] mt-2">A project and issue management platform.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Link to="/dashboard" className="bg-[var(--bg-1)] border border-[var(--border)] rounded-lg p-6 hover:border-[var(--steel)] transition">
          <h2 className="font-display font-bold text-lg mb-2">Dashboard</h2>
          <p className="text-sm text-[var(--text-mid)]">View project overview and statistics</p>
        </Link>
        <Link to="/organizations" className="bg-[var(--bg-1)] border border-[var(--border)] rounded-lg p-6 hover:border-[var(--steel)] transition">
          <h2 className="font-display font-bold text-lg mb-2">Organizations</h2>
          <p className="text-sm text-[var(--text-mid)]">Create and manage organizations</p>
        </Link>
        <Link to="/board" className="bg-[var(--bg-1)] border border-[var(--border)] rounded-lg p-6 hover:border-[var(--steel)] transition">
          <h2 className="font-display font-bold text-lg mb-2">Board</h2>
          <p className="text-sm text-[var(--text-mid)]">Kanban board for your issues</p>
        </Link>
        <Link to="/sprints" className="bg-[var(--bg-1)] border border-[var(--border)] rounded-lg p-6 hover:border-[var(--steel)] transition">
          <h2 className="font-display font-bold text-lg mb-2">Sprints</h2>
          <p className="text-sm text-[var(--text-mid)]">Manage sprints and track progress</p>
        </Link>
      </div>

      <div className="bg-[var(--bg-1)] border border-[var(--border)] rounded-lg p-6">
        <h2 className="font-semibold text-sm mb-2">System Status</h2>
        <p className="text-sm text-[var(--text-mid)]">
          Backend API:{" "}
          <span className={health === "healthy" ? "text-[var(--teal)]" : "text-[var(--red)]"}>
            {health}
          </span>
        </p>
      </div>
    </div>
  );
}
