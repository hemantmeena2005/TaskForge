import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import api from "@/lib/api";

export interface StatusCount {
  status: "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";
  count: number;
}

export interface PriorityCount {
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  count: number;
}

export interface ActiveSprintInfo {
  id: string;
  project_id: string;
  project_name: string;
  name: string;
  goal: string | null;
  start_date: string | null;
  end_date: string | null;
}

export interface SprintProgress {
  total_issues: number;
  completed_issues: number;
  remaining_issues: number;
  completion_percentage: number;
}

export interface DashboardActivityItem {
  id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  user_id: string | null;
  created_at: string;
}

export interface DashboardData {
  total_projects: number;
  open_issues: number;
  completed_issues: number;
  active_sprint: ActiveSprintInfo | null;
  sprint_progress: SprintProgress | null;
  issues_by_status: StatusCount[];
  issues_by_priority: PriorityCount[];
  recent_activity: DashboardActivityItem[];
}

const STATUS_META: Record<string, { label: string; color: string; bar: string }> = {
  TODO: { label: "To Do", color: "var(--text-lo)", bar: "var(--text-lo)" },
  IN_PROGRESS: { label: "In Progress", color: "var(--steel)", bar: "var(--steel)" },
  IN_REVIEW: { label: "In Review", color: "var(--amber)", bar: "var(--amber)" },
  DONE: { label: "Done", color: "var(--teal)", bar: "var(--teal)" },
};

const ACTION_LABELS: Record<string, string> = {
  ISSUE_CREATED: "created an issue",
  ISSUE_UPDATED: "updated an issue",
  ISSUE_DELETED: "deleted an issue",
  ISSUE_ASSIGNED: "assigned an issue",
  ISSUE_STATUS_CHANGED: "changed an issue status",
  ISSUE_PRIORITY_CHANGED: "changed an issue priority",
  SPRINT_CREATED: "created a sprint",
  SPRINT_STARTED: "started a sprint",
  SPRINT_COMPLETED: "completed a sprint",
  MEMBER_ADDED: "added a member",
  MEMBER_REMOVED: "removed a member",
  MEMBER_ROLE_CHANGED: "changed a member role",
  PROJECT_CREATED: "created a project",
  PROJECT_ARCHIVED: "archived a project",
};

function formatRelative(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function StatCard({ label, value, delta }: { label: string; value: ReactNode; delta?: string }) {
  return (
    <div className="bg-[var(--bg-1)] border border-[var(--border)] rounded-lg p-4">
      <div className="text-[11px] uppercase tracking-wider text-[var(--text-mid)] mb-2">{label}</div>
      <div className="font-display text-2xl font-bold">{value}</div>
      {delta && <div className="text-[11px] mt-1 text-[var(--teal)]">{delta}</div>}
    </div>
  );
}

function BarRow({ label, count, total, barColor }: { label: string; count: number; total: number; barColor: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex flex-col items-center gap-2 h-full justify-end">
      <div className="w-full rounded-t flex-1 relative" style={{ background: "var(--bg-3)" }}>
        <div className="absolute bottom-0 left-0 right-0 rounded-t transition-all" style={{ height: `${pct}%`, background: barColor }} />
      </div>
      <div className="text-[10px] text-[var(--text-lo)]">{label}</div>
    </div>
  );
}

export default function DashboardPage() {
  const { data, isLoading, error } = useQuery<DashboardData>({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const res = await api.get("/dashboard");
      return res.data;
    },
  });

  if (isLoading) {
    return <div className="text-[var(--text-mid)] py-12 text-center">Loading dashboard...</div>;
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-xl font-bold">Dashboard</h1>
        <div className="bg-[var(--red)]/10 border border-[var(--red)]/30 text-[var(--red)] px-4 py-3 rounded-lg text-sm">
          {(error as Error)?.message || "Failed to load dashboard"}
        </div>
      </div>
    );
  }

  const statusTotal = data.issues_by_status.reduce((s, x) => s + x.count, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-xl font-bold">Dashboard</h1>
          <p className="text-sm text-[var(--text-mid)] mt-1">Overview of your projects and issues</p>
        </div>
        <Link to="/board" className="px-4 py-2 bg-[var(--ember)] text-[#20100A] text-sm font-semibold rounded-lg hover:opacity-90 transition flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
          New issue
        </Link>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total Projects" value={data.total_projects} />
        <StatCard label="Open Issues" value={data.open_issues} />
        <StatCard label="Completed Issues" value={data.completed_issues} />
        <StatCard label="Sprint Progress" value={data.sprint_progress ? `${data.sprint_progress.completion_percentage}%` : "—"} />
      </div>

      {data.active_sprint && data.sprint_progress && (
        <div className="bg-[var(--bg-1)] border border-[var(--border)] rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-[var(--steel-dim)] text-[#BFD4FF] rounded-full">Active Sprint</span>
              <h2 className="font-display font-bold">{data.active_sprint.name}</h2>
            </div>
            <span className="text-lg font-bold text-[var(--ember)]">{data.sprint_progress.completion_percentage}%</span>
          </div>
          <div className="w-full h-2 bg-[var(--bg-3)] rounded-full overflow-hidden mb-4">
            <div className="h-full bg-[var(--ember)] rounded-full transition-all" style={{ width: `${data.sprint_progress.completion_percentage}%` }} />
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="bg-[var(--bg-2)] p-3 rounded-lg">
              <div className="text-xs text-[var(--text-mid)]">Total Issues</div>
              <div className="font-display text-xl font-bold mt-1">{data.sprint_progress.total_issues}</div>
            </div>
            <div className="bg-[var(--teal-dim)] p-3 rounded-lg">
              <div className="text-xs text-[var(--teal)]">Completed</div>
              <div className="font-display text-xl font-bold text-[#8FE3B9] mt-1">{data.sprint_progress.completed_issues}</div>
            </div>
            <div className="bg-[var(--amber)]/10 p-3 rounded-lg">
              <div className="text-xs text-[var(--amber)]">Remaining</div>
              <div className="font-display text-xl font-bold text-[var(--amber)] mt-1">{data.sprint_progress.remaining_issues}</div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-5 gap-4">
        <div className="col-span-3 bg-[var(--bg-1)] border border-[var(--border)] rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm">Issues by Status</h3>
            <Link to="/board" className="text-[11px] text-[var(--steel)] hover:underline">View board</Link>
          </div>
          <div className="flex items-end gap-3 h-36">
            {data.issues_by_status.map((s) => (
              <BarRow key={s.status} label={STATUS_META[s.status]?.label || s.status} count={s.count} total={statusTotal} barColor={STATUS_META[s.status]?.bar || "var(--text-lo)"} />
            ))}
          </div>
        </div>

        <div className="col-span-2 bg-[var(--bg-1)] border border-[var(--border)] rounded-lg p-5">
          <h3 className="font-semibold text-sm mb-4">Recent Activity</h3>
          {data.recent_activity.length === 0 ? (
            <p className="text-[var(--text-lo)] text-sm py-6 text-center">No recent activity</p>
          ) : (
            <div className="space-y-3">
              {data.recent_activity.slice(0, 5).map((a) => (
                <div key={a.id} className="flex gap-3 items-start">
                  <div className="w-6 h-6 rounded-full bg-[var(--steel-dim)] text-[#BFD4FF] text-[9px] font-semibold flex items-center justify-center flex-shrink-0">
                    {a.user_id ? a.user_id.slice(0, 2).toUpperCase() : "??"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] text-[var(--text-mid)] truncate">
                      {ACTION_LABELS[a.action] || a.action.replace(/_/g, " ").toLowerCase()}
                    </div>
                    <div className="text-[10px] text-[var(--text-lo)] mt-0.5">{formatRelative(a.created_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
