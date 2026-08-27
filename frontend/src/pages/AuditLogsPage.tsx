import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import ProjectSelector from "@/components/ProjectSelector";
import { useProjectStore } from "@/lib/projectStore";
import { useAuthStore } from "@/lib/auth";

interface AuditLogItem {
  id: string;
  user_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  old_value: Record<string, any> | null;
  new_value: Record<string, any> | null;
  created_at: string;
}

interface ProjectMember {
  user_id: string;
  role: string;
  user: {
    id: string;
    username: string;
    full_name: string | null;
  };
}

const ACTION_CONFIG: Record<
  string,
  { label: string; bg: string; color: string; category: "issue" | "sprint" | "member" | "project" }
> = {
  ISSUE_CREATED: { label: "Issue Created", bg: "var(--teal-dim)", color: "#8FE3B9", category: "issue" },
  ISSUE_UPDATED: { label: "Issue Updated", bg: "var(--steel-dim)", color: "#BFD4FF", category: "issue" },
  ISSUE_DELETED: { label: "Issue Deleted", bg: "#3A1414", color: "#F2A7A7", category: "issue" },
  ISSUE_ASSIGNED: { label: "Issue Assigned", bg: "var(--steel-dim)", color: "#BFD4FF", category: "issue" },
  ISSUE_STATUS_CHANGED: { label: "Status Changed", bg: "var(--amber-dim)", color: "#F0C97D", category: "issue" },
  ISSUE_PRIORITY_CHANGED: { label: "Priority Changed", bg: "var(--ember-dim)", color: "#FFB79A", category: "issue" },
  SPRINT_CREATED: { label: "Sprint Created", bg: "var(--steel-dim)", color: "#BFD4FF", category: "sprint" },
  SPRINT_STARTED: { label: "Sprint Started", bg: "var(--ember-dim)", color: "#FFB79A", category: "sprint" },
  SPRINT_COMPLETED: { label: "Sprint Completed", bg: "var(--teal-dim)", color: "#8FE3B9", category: "sprint" },
  MEMBER_ADDED: { label: "Member Added", bg: "var(--teal-dim)", color: "#8FE3B9", category: "member" },
  MEMBER_REMOVED: { label: "Member Removed", bg: "#3A1414", color: "#F2A7A7", category: "member" },
  MEMBER_ROLE_CHANGED: { label: "Role Changed", bg: "var(--amber-dim)", color: "#F0C97D", category: "member" },
  PROJECT_CREATED: { label: "Project Created", bg: "var(--teal-dim)", color: "#8FE3B9", category: "project" },
  PROJECT_ARCHIVED: { label: "Project Archived", bg: "#3A1414", color: "#F2A7A7", category: "project" },
};

function formatTimestamp(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

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

function getBriefSummary(log: AuditLogItem): string {
  if (log.new_value) {
    if (typeof log.new_value === "object") {
      if ("status" in log.new_value) {
        const s = log.new_value.status;
        if (typeof s === "object" && s && "old" in s && "new" in s) {
          return `Changed status from ${s.old} → ${s.new}`;
        }
        return `Updated status to ${s}`;
      }
      if ("title" in log.new_value) {
        return `Updated title: "${log.new_value.title}"`;
      }
      if ("priority" in log.new_value) {
        return `Updated priority to ${log.new_value.priority}`;
      }
      if ("name" in log.new_value) {
        return `Updated name to "${log.new_value.name}"`;
      }
      if ("role" in log.new_value) {
        return `Changed role to ${log.new_value.role}`;
      }
    }
  }
  return `Updated ${log.resource_type}`;
}

function ValueDiffViewer({
  oldVal,
  newVal,
}: {
  oldVal: Record<string, any> | null;
  newVal: Record<string, any> | null;
}) {
  if (!oldVal && !newVal) return null;

  // Structured field diff e.g. {"status": {"old": "TODO", "new": "DONE"}}
  if (newVal && typeof newVal === "object" && !oldVal) {
    const changeKeys = Object.keys(newVal);
    const isStructuredDiff = changeKeys.every(
      (k) => newVal[k] && typeof newVal[k] === "object" && "old" in newVal[k] && "new" in newVal[k]
    );

    if (isStructuredDiff) {
      return (
        <div className="space-y-1.5 pt-2 border-t border-[var(--border)]">
          {changeKeys.map((key) => (
            <div key={key} className="flex items-center gap-2 text-xs font-mono">
              <span className="text-[var(--text-mid)] uppercase text-[10px]">{key}:</span>
              <span className="px-1.5 py-0.5 rounded bg-[var(--red)]/10 text-[var(--red)] line-through">
                {String(newVal[key].old ?? "none")}
              </span>
              <span className="text-[var(--text-lo)]">→</span>
              <span className="px-1.5 py-0.5 rounded bg-[var(--teal-dim)] text-[#8FE3B9]">
                {String(newVal[key].new ?? "none")}
              </span>
            </div>
          ))}
        </div>
      );
    }
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono pt-2 border-t border-[var(--border)]">
      {oldVal && (
        <div className="bg-[var(--bg-2)] p-2 rounded border border-[var(--border)]">
          <div className="text-[10px] uppercase text-[var(--red)] font-bold mb-1">Previous Payload</div>
          <pre className="text-[11px] text-[var(--text-mid)] whitespace-pre-wrap">
            {JSON.stringify(oldVal, null, 2)}
          </pre>
        </div>
      )}
      {newVal && (
        <div className="bg-[var(--bg-2)] p-2 rounded border border-[var(--border)]">
          <div className="text-[10px] uppercase text-[#8FE3B9] font-bold mb-1">New Payload</div>
          <pre className="text-[11px] text-[var(--text-hi)] whitespace-pre-wrap">
            {JSON.stringify(newVal, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export default function AuditLogsPage() {
  const selectedProjectId = useProjectStore((s) => s.selectedProjectId);
  const projectId = selectedProjectId || "";
  const currentUser = useAuthStore((s) => s.user);

  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [searchFilter, setSearchFilter] = useState<string>("");
  const [expandedLogIds, setExpandedLogIds] = useState<Set<string>>(new Set());

  // Fetch project members for mapping actor user_id to username and detecting admin role
  const { data: members } = useQuery<ProjectMember[]>({
    queryKey: ["project-members", projectId],
    queryFn: async () => {
      const res = await api.get(`/projects/${projectId}/members`);
      return res.data;
    },
    enabled: Boolean(projectId),
  });

  // Map user_id to user details
  const userMap = new Map<string, { username: string; full_name: string | null }>();
  members?.forEach((m) => {
    userMap.set(m.user_id, m.user);
  });

  // Check if current user is Admin / Project Manager in the selected project
  const currentMember = members?.find((m) => m.user_id === currentUser?.id);
  const isAdmin =
    currentMember?.role === "admin" ||
    currentMember?.role === "project_manager";

  // Fetch audit logs
  const { data: logs, isLoading, error } = useQuery<AuditLogItem[]>({
    queryKey: ["audit-logs", projectId],
    queryFn: async () => {
      const res = await api.get(`/projects/${projectId}/audit-logs?limit=100`);
      return res.data;
    },
    enabled: Boolean(projectId),
    retry: 1,
  });

  function toggleExpand(logId: string) {
    if (!isAdmin) return;
    setExpandedLogIds((prev) => {
      const next = new Set(prev);
      if (next.has(logId)) {
        next.delete(logId);
      } else {
        next.add(logId);
      }
      return next;
    });
  }

  // Filter logs by category and search
  const filteredLogs = logs?.filter((log) => {
    const config = ACTION_CONFIG[log.action];
    if (categoryFilter !== "ALL" && config?.category !== categoryFilter.toLowerCase()) {
      return false;
    }
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      const actionName = (config?.label || log.action).toLowerCase();
      const resType = log.resource_type.toLowerCase();
      const valStr = JSON.stringify({ old: log.old_value, new: log.new_value }).toLowerCase();
      return actionName.includes(q) || resType.includes(q) || valStr.includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-display text-xl font-bold">Audit Logs</h1>
            {isAdmin ? (
              <span className="text-[10px] font-bold uppercase tracking-wider bg-[var(--steel-dim)] text-[#BFD4FF] px-2 py-0.5 rounded-full font-mono">
                Admin View (Full Diff Access)
              </span>
            ) : (
              <span className="text-[10px] font-bold uppercase tracking-wider bg-[var(--bg-3)] text-[var(--text-mid)] px-2 py-0.5 rounded-full font-mono">
                Summary View
              </span>
            )}
          </div>
          <p className="text-sm text-[var(--text-mid)] mt-1">
            Immutable, append-only history of workspace actions and changes
          </p>
        </div>
        <ProjectSelector />
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[var(--bg-1)] border border-[var(--border)] p-3 rounded-lg shadow-sm">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {["ALL", "ISSUE", "SPRINT", "MEMBER", "PROJECT"].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
                categoryFilter === cat
                  ? "bg-[var(--steel-dim)] text-[#BFD4FF]"
                  : "text-[var(--text-mid)] hover:bg-[var(--bg-2)] hover:text-[var(--text-hi)]"
              }`}
            >
              {cat === "ALL" ? "All Activity" : cat.charAt(0) + cat.slice(1).toLowerCase() + "s"}
            </button>
          ))}
        </div>

        {/* Search Filter */}
        <div className="w-64 relative">
          <svg
            className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-lo)]"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            type="text"
            placeholder="Filter logs..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full bg-[var(--bg-2)] border border-[var(--border)] rounded-lg py-1.5 pl-9 pr-3 text-xs text-[var(--text-hi)] placeholder:text-[var(--text-lo)] focus:outline-none focus:border-[var(--steel)]"
          />
        </div>
      </div>

      {/* Content States */}
      {!projectId ? (
        <div className="text-[var(--text-mid)] py-12 text-center bg-[var(--bg-1)] border border-[var(--border)] rounded-lg">
          Please select a project above to inspect its audit trail.
        </div>
      ) : isLoading ? (
        <div className="text-[var(--text-mid)] py-12 text-center">Loading audit history...</div>
      ) : error ? (
        <div className="bg-[var(--red)]/10 border border-[var(--red)]/30 text-[var(--red)] p-4 rounded-lg text-sm">
          Failed to load audit logs: {(error as Error).message}
        </div>
      ) : filteredLogs && filteredLogs.length > 0 ? (
        /* Audit Timeline */
        <div className="space-y-2.5">
          {filteredLogs.map((log) => {
            const config = (ACTION_CONFIG[log.action] ?? {
              label: log.action.replace(/_/g, " "),
              bg: "var(--bg-3)",
              color: "var(--text-mid)",
            })!;
            const actor = log.user_id ? userMap.get(log.user_id) : null;
            const actorName = actor ? actor.full_name || actor.username : log.user_id ? `@${log.user_id.slice(0, 8)}` : "System";
            const summary = getBriefSummary(log);
            const isExpanded = expandedLogIds.has(log.id);

            return (
              <div
                key={log.id}
                className="bg-[var(--bg-1)] border border-[var(--border)] rounded-xl p-3.5 space-y-2 hover:border-[var(--text-lo)] transition shadow-sm"
              >
                {/* Summary Row */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded font-mono uppercase tracking-wider flex-shrink-0"
                      style={{ background: config.bg, color: config.color }}
                    >
                      {config.label}
                    </span>

                    <span className="text-xs font-semibold text-[var(--text-hi)] flex-shrink-0">
                      {actorName}
                    </span>

                    <span className="text-xs text-[var(--text-mid)] truncate">
                      {summary}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-[var(--text-lo)] flex-shrink-0">
                    <span title={formatTimestamp(log.created_at)}>{formatRelative(log.created_at)}</span>

                    {/* Admin-only expand button */}
                    {isAdmin && (
                      <button
                        onClick={() => toggleExpand(log.id)}
                        className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[var(--bg-2)] hover:bg-[var(--bg-3)] text-[var(--steel)] border border-[var(--border)] transition flex items-center gap-1"
                        title="Inspect full JSON diff & resource payloads"
                      >
                        {isExpanded ? "Collapse ▲" : "Expand ▼"}
                      </button>
                    )}
                  </div>
                </div>

                {/* Admin-only expanded payload diff */}
                {isAdmin && isExpanded && (
                  <div className="pt-2 animate-in fade-in duration-150">
                    <div className="text-[10px] text-[var(--text-lo)] font-mono mb-1">
                      Resource ID: <span className="text-[var(--text-mid)]">{log.resource_id || "none"}</span> • Exact Time:{" "}
                      <span className="text-[var(--text-mid)]">{formatTimestamp(log.created_at)}</span>
                    </div>
                    <ValueDiffViewer oldVal={log.old_value} newVal={log.new_value} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-[var(--text-lo)] py-12 text-center bg-[var(--bg-1)] border border-[var(--border)] rounded-lg text-sm">
          No audit log entries matching your current filters.
        </div>
      )}
    </div>
  );
}
