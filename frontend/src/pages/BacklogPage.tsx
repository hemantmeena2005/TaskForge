import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import ProjectSelector from "@/components/ProjectSelector";
import IssueDetailModal from "@/components/IssueDetailModal";
import { useProjectStore } from "@/lib/projectStore";
import { IssueRowSkeleton } from "@/components/LoadingSkeleton";

interface UserPublic {
  id: string;
  username: string;
  full_name: string | null;
}

interface Label {
  id: string;
  name: string;
  color: string;
}

interface Issue {
  id: string;
  issue_number: number;
  issue_key: string;
  title: string;
  description: string | null;
  type: "TASK" | "BUG" | "STORY" | "FEATURE";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  status: "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";
  version: number;
  reporter_id: string;
  assignee_id: string | null;
  sprint_id: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  reporter: UserPublic | null;
  assignee: UserPublic | null;
  labels: Label[];
}

interface IssueListResponse {
  items: Issue[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

const PRIORITY_CONFIG: Record<"LOW" | "MEDIUM" | "HIGH" | "URGENT", { label: string; bg: string; color: string; border: string }> = {
  LOW: { label: "Low", bg: "#122A1F", color: "#7FD9AE", border: "rgba(127, 217, 174, 0.3)" },
  MEDIUM: { label: "Medium", bg: "#3A2A10", color: "#F0C97D", border: "rgba(240, 201, 125, 0.3)" },
  HIGH: { label: "High", bg: "#3A1414", color: "#F2A7A7", border: "rgba(242, 167, 167, 0.3)" },
  URGENT: { label: "Urgent", bg: "#4A1010", color: "#FF8F8F", border: "rgba(255, 143, 143, 0.4)" },
};

const STATUS_CONFIG: Record<"TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE", { label: string; bg: string; color: string }> = {
  TODO: { label: "To Do", bg: "var(--bg-3)", color: "var(--text-mid)" },
  IN_PROGRESS: { label: "In Progress", bg: "var(--steel-dim)", color: "#BFD4FF" },
  IN_REVIEW: { label: "In Review", bg: "var(--amber-dim)", color: "#F0C97D" },
  DONE: { label: "Done", bg: "var(--teal-dim)", color: "#8FE3B9" },
};

const TYPE_CONFIG: Record<"TASK" | "BUG" | "STORY" | "FEATURE", { label: string; color: string; bg: string }> = {
  TASK: { label: "Task", color: "#BFD4FF", bg: "var(--steel-dim)" },
  BUG: { label: "Bug", color: "#F2A7A7", bg: "#3A1414" },
  STORY: { label: "Story", color: "#8FE3B9", bg: "var(--teal-dim)" },
  FEATURE: { label: "Feature", color: "#FFB79A", bg: "var(--ember-dim)" },
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

export default function BacklogPage() {
  const queryClient = useQueryClient();
  const selectedProjectId = useProjectStore((s) => s.selectedProjectId);
  const projectId = selectedProjectId || "";

  const [viewMode, setViewMode] = useState<"assigned_to_me" | "project_backlog">("assigned_to_me");
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchFilter, setSearchFilter] = useState<string>("");

  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState<"LOW" | "MEDIUM" | "HIGH" | "URGENT">("MEDIUM");
  const [newType, setNewType] = useState<"TASK" | "BUG" | "STORY" | "FEATURE">("TASK");

  // Query 1: Assigned to Me (cross-project or filtered by current project)
  const { data: myAssignedIssues, isLoading: loadingMyIssues } = useQuery<Issue[]>({
    queryKey: ["issues-assigned-to-me", priorityFilter, statusFilter, searchFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (priorityFilter !== "ALL") params.append("priority", priorityFilter);
      if (statusFilter !== "ALL") params.append("status", statusFilter);
      if (searchFilter.trim()) params.append("search", searchFilter.trim());
      const res = await api.get(`/issues/assigned-to-me?${params.toString()}`);
      return res.data;
    },
    enabled: viewMode === "assigned_to_me",
  });

  // Query 2: Project Backlog (unscheduled issues in current project)
  const { data: projectBacklogData, isLoading: loadingBacklog } = useQuery<IssueListResponse>({
    queryKey: ["project-backlog", projectId, priorityFilter, statusFilter, searchFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ sprint_id: "backlog", page_size: "100" });
      if (priorityFilter !== "ALL") params.append("priority", priorityFilter);
      if (statusFilter !== "ALL") params.append("status", statusFilter);
      if (searchFilter.trim()) params.append("search", searchFilter.trim());
      const res = await api.get(`/projects/${projectId}/issues?${params.toString()}`);
      return res.data;
    },
    enabled: viewMode === "project_backlog" && Boolean(projectId),
  });

  // Create issue mutation
  const createIssueMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/projects/${projectId}/issues`, {
        title: newTitle,
        priority: newPriority,
        type: newType,
        assignee_id: viewMode === "assigned_to_me" ? "me" : null,
      });
      return res.data;
    },
    onSuccess: (created) => {
      setNewTitle("");
      setShowCreateModal(false);
      queryClient.invalidateQueries({ queryKey: ["issues-assigned-to-me"] });
      queryClient.invalidateQueries({ queryKey: ["project-backlog", projectId] });
      queryClient.invalidateQueries({ queryKey: ["board", projectId] });
      setSelectedIssueId(created.id);
    },
  });

  const issuesList: Issue[] =
    viewMode === "assigned_to_me"
      ? myAssignedIssues || []
      : projectBacklogData?.items || [];

  const isLoading = viewMode === "assigned_to_me" ? loadingMyIssues : loadingBacklog;

  // Counts by priority for quick filter badges
  const priorityCounts = {
    LOW: issuesList.filter((i) => i.priority === "LOW").length,
    MEDIUM: issuesList.filter((i) => i.priority === "MEDIUM").length,
    HIGH: issuesList.filter((i) => i.priority === "HIGH").length,
    URGENT: issuesList.filter((i) => i.priority === "URGENT").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-bold">Backlog & My Tasks</h1>
          <p className="text-sm text-[var(--text-mid)] mt-1">
            Review and prioritize work assigned to you and backlog items
          </p>
        </div>

        <div className="flex items-center gap-3">
          <ProjectSelector />
          <button
            onClick={() => setShowCreateModal(true)}
            disabled={!projectId}
            className="px-3.5 py-2 bg-[var(--ember)] text-[#20100A] text-xs font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 transition flex items-center gap-1.5 shadow-sm"
          >
            <span>+</span> Create Issue
          </button>
        </div>
      </div>

      {/* Mode & Filters Toolbar */}
      <div className="bg-[var(--bg-1)] border border-[var(--border)] rounded-xl p-4 space-y-4 shadow-sm">
        {/* Scope Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode("assigned_to_me")}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-2 ${
                viewMode === "assigned_to_me"
                  ? "bg-[var(--steel-dim)] text-[#BFD4FF]"
                  : "text-[var(--text-mid)] hover:text-[var(--text-hi)] hover:bg-[var(--bg-2)]"
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Assigned to Me ({myAssignedIssues?.length || 0})
            </button>

            <button
              onClick={() => setViewMode("project_backlog")}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-2 ${
                viewMode === "project_backlog"
                  ? "bg-[var(--steel-dim)] text-[#BFD4FF]"
                  : "text-[var(--text-mid)] hover:text-[var(--text-hi)] hover:bg-[var(--bg-2)]"
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              Project Backlog ({projectBacklogData?.total || 0})
            </button>
          </div>

          {/* Search bar */}
          <div className="w-64 relative">
            <svg
              className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-lo)]"
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
              placeholder="Filter tasks..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full bg-[var(--bg-2)] border border-[var(--border)] rounded-lg py-1.5 pl-8 pr-3 text-xs text-[var(--text-hi)] placeholder:text-[var(--text-lo)] focus:outline-none focus:border-[var(--steel)]"
            />
          </div>
        </div>

        {/* Priority Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-semibold text-[var(--text-mid)] uppercase tracking-wider mr-1">
              Priority:
            </span>

            <button
              onClick={() => setPriorityFilter("ALL")}
              className={`px-2.5 py-1 text-xs rounded-md transition font-medium ${
                priorityFilter === "ALL"
                  ? "bg-[var(--bg-3)] text-[var(--text-hi)] font-bold"
                  : "text-[var(--text-lo)] hover:text-[var(--text-hi)]"
              }`}
            >
              All ({issuesList.length})
            </button>

            {(["URGENT", "HIGH", "MEDIUM", "LOW"] as const).map((p) => {
              const conf = PRIORITY_CONFIG[p];
              const isSelected = priorityFilter === p;
              return (
                <button
                  key={p}
                  onClick={() => setPriorityFilter(isSelected ? "ALL" : p)}
                  className="px-2.5 py-1 text-xs rounded-md font-medium transition flex items-center gap-1.5"
                  style={{
                    background: isSelected ? conf.bg : "transparent",
                    color: isSelected ? conf.color : "var(--text-mid)",
                    border: `1px solid ${isSelected ? conf.border : "var(--border)"}`,
                  }}
                >
                  <span>{conf.label}</span>
                  {priorityCounts[p] > 0 && (
                    <span className="text-[10px] opacity-75 font-mono">({priorityCounts[p]})</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Status Filter Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[var(--text-mid)]">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-[var(--bg-2)] border border-[var(--border)] rounded-md px-2.5 py-1 text-xs text-[var(--text-hi)] focus:outline-none focus:border-[var(--steel)]"
            >
              <option value="ALL">All Statuses</option>
              <option value="TODO">To Do</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="IN_REVIEW">In Review</option>
              <option value="DONE">Done</option>
            </select>
          </div>
        </div>
      </div>

      {/* Issues List */}
      {viewMode === "project_backlog" && !projectId ? (
        <div className="text-[var(--text-mid)] py-12 text-center bg-[var(--bg-1)] border border-[var(--border)] rounded-xl">
          Please select a project from the header above to inspect its backlog items.
        </div>
      ) : isLoading ? (
        <IssueRowSkeleton count={5} />
      ) : issuesList.length > 0 ? (
        <div className="divide-y divide-[var(--border)] border border-[var(--border)] rounded-xl bg-[var(--bg-1)] overflow-hidden shadow-sm">
          {issuesList.map((issue) => {
            const pConf = PRIORITY_CONFIG[issue.priority] ?? PRIORITY_CONFIG.MEDIUM;
            const sConf = STATUS_CONFIG[issue.status] ?? STATUS_CONFIG.TODO;
            const tConf = TYPE_CONFIG[issue.type] ?? TYPE_CONFIG.TASK;

            return (
              <div
                key={issue.id}
                onClick={() => setSelectedIssueId(issue.id)}
                className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[var(--bg-2)]/60 cursor-pointer transition group"
              >
                {/* Left Side: Key, Type, Title */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded font-mono uppercase flex-shrink-0"
                    style={{ background: tConf.bg, color: tConf.color }}
                  >
                    {tConf.label}
                  </span>

                  <span className="font-mono text-xs font-bold text-[var(--steel)] group-hover:underline flex-shrink-0">
                    {issue.issue_key}
                  </span>

                  <span className="text-sm font-medium text-[var(--text-hi)] truncate">
                    {issue.title}
                  </span>
                </div>

                {/* Right Side: Status, Priority, Assignee, Time */}
                <div className="flex items-center gap-2.5 flex-shrink-0">
                  {/* Status Pill */}
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded font-mono"
                    style={{ background: sConf.bg, color: sConf.color }}
                  >
                    {sConf.label}
                  </span>

                  {/* Priority Pill */}
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded font-mono"
                    style={{ background: pConf.bg, color: pConf.color, border: `1px solid ${pConf.border}` }}
                  >
                    {pConf.label}
                  </span>

                  {/* Assignee Avatar */}
                  {issue.assignee ? (
                    <div
                      className="w-6 h-6 rounded-full bg-[var(--steel-dim)] text-[#BFD4FF] text-[10px] font-bold flex items-center justify-center font-display"
                      title={`Assigned to ${issue.assignee.full_name || issue.assignee.username}`}
                    >
                      {issue.assignee.username.slice(0, 2).toUpperCase()}
                    </div>
                  ) : (
                    <span className="text-[10px] text-[var(--text-lo)] italic">Unassigned</span>
                  )}

                  <span className="text-[11px] text-[var(--text-lo)] min-w-[55px] text-right font-mono">
                    {formatRelative(issue.created_at)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16 bg-[var(--bg-1)] border border-[var(--border)] rounded-xl space-y-2">
          <div className="text-sm font-semibold text-[var(--text-hi)]">No tasks found</div>
          <p className="text-xs text-[var(--text-lo)] max-w-sm mx-auto">
            {viewMode === "assigned_to_me"
              ? "You don't have any tasks matching your selected priority/status filters."
              : "There are no unscheduled backlog issues in this project matching your filters."}
          </p>
        </div>
      )}

      {/* Create Issue Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-1)] border border-[var(--border)] rounded-xl p-6 w-full max-w-md space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <h3 className="font-semibold text-sm text-[var(--text-hi)]">Create Backlog Issue</h3>
            <div>
              <label className="block text-[11px] text-[var(--text-mid)] mb-1.5 font-medium">Title</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full bg-[var(--bg-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-hi)] focus:outline-none focus:border-[var(--steel)]"
                placeholder="e.g. Implement user authentication"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-[var(--text-mid)] mb-1.5 font-medium">Type</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as typeof newType)}
                  className="w-full bg-[var(--bg-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs text-[var(--text-hi)] focus:outline-none focus:border-[var(--steel)]"
                >
                  <option value="TASK">Task</option>
                  <option value="BUG">Bug</option>
                  <option value="STORY">Story</option>
                  <option value="FEATURE">Feature</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-[var(--text-mid)] mb-1.5 font-medium">Priority</label>
                <select
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value as typeof newPriority)}
                  className="w-full bg-[var(--bg-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs text-[var(--text-hi)] focus:outline-none focus:border-[var(--steel)]"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-xs text-[var(--text-mid)] hover:bg-[var(--bg-2)] rounded-lg font-medium"
              >
                Cancel
              </button>
              <button
                disabled={!newTitle.trim() || createIssueMutation.isPending}
                onClick={() => createIssueMutation.mutate()}
                className="px-4 py-2 text-xs bg-[var(--ember)] text-[#20100A] font-semibold rounded-lg disabled:opacity-50 transition"
              >
                {createIssueMutation.isPending ? "Creating..." : "Create Task"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comprehensive Issue Detail & Comments Drawer */}
      {selectedIssueId && (
        <IssueDetailModal
          issueId={selectedIssueId}
          projectId={projectId || (issuesList.find((i) => i.id === selectedIssueId)?.assignee_id ? "" : "")}
          onClose={() => setSelectedIssueId(null)}
          onUpdated={() => {
            queryClient.invalidateQueries({ queryKey: ["issues-assigned-to-me"] });
            queryClient.invalidateQueries({ queryKey: ["project-backlog", projectId] });
          }}
        />
      )}
    </div>
  );
}
