import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import ProjectSelector from "@/components/ProjectSelector";
import IssueDetailModal from "@/components/IssueDetailModal";
import { useProjectStore } from "@/lib/projectStore";

export interface Label {
  id: string;
  name: string;
  color: string;
}

export interface UserPublic {
  id: string;
  username: string;
  full_name: string | null;
}

export interface Issue {
  id: string;
  issue_number: number;
  issue_key: string;
  title: string;
  description: string | null;
  type: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  status: "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";
  version: number;
  assignee: UserPublic | null;
  labels: Label[];
}

export interface BoardColumn {
  status: "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";
  issues: Issue[];
  total_count: number;
}

export interface BoardData {
  project_id: string;
  columns: BoardColumn[];
}

const COLUMN_CONFIG: Record<string, { title: string; dot: string }> = {
  TODO: { title: "Todo", dot: "var(--text-lo)" },
  IN_PROGRESS: { title: "In progress", dot: "var(--steel)" },
  IN_REVIEW: { title: "In review", dot: "var(--amber)" },
  DONE: { title: "Done", dot: "var(--teal)" },
};

const TYPE_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  BUG: { bg: "#3A1414", color: "#F2A7A7", border: "var(--red)" },
  TASK: { bg: "var(--steel-dim)", color: "#BFD4FF", border: "var(--steel)" },
  STORY: { bg: "var(--teal-dim)", color: "#8FE3B9", border: "var(--teal)" },
  FEATURE: { bg: "var(--ember-dim)", color: "#FFB79A", border: "var(--ember)" },
};

const PRIORITY_STYLES: Record<string, { bg: string; color: string }> = {
  LOW: { bg: "#122A1F", color: "#7FD9AE" },
  MEDIUM: { bg: "#3A2A10", color: "#F0C97D" },
  HIGH: { bg: "#3A1414", color: "#F2A7A7" },
  URGENT: { bg: "#4A1010", color: "#FF8F8F" },
};

export default function BoardPage() {
  const queryClient = useQueryClient();
  const selectedProjectId = useProjectStore((s) => s.selectedProjectId);
  const projectId: string = selectedProjectId || "";
  const [search, setSearch] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);

  // Form states for creating issue
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState<"LOW" | "MEDIUM" | "HIGH" | "URGENT">("MEDIUM");
  const [newType, setNewType] = useState<"TASK" | "BUG" | "STORY" | "FEATURE">("TASK");
  const [newAssigneeId, setNewAssigneeId] = useState<string>("");

  const { data: members } = useQuery<{ user_id: string; role: string; user: UserPublic }[]>({
    queryKey: ["project-members", projectId],
    queryFn: async () => {
      const res = await api.get(`/projects/${projectId}/members`);
      return res.data;
    },
    enabled: Boolean(projectId),
  });

  const { data: board, isLoading, isError } = useQuery<BoardData>({
    queryKey: ["board", projectId, search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      const res = await api.get(`/projects/${projectId}/board?${params.toString()}`);
      return res.data;
    },
    enabled: Boolean(projectId),
  });

  const moveMutation = useMutation({
    mutationFn: async ({ issueId, newStatus, version }: { issueId: string; newStatus: string; version: number }) => {
      setErrorMessage(null);
      const res = await api.post(`/issues/${issueId}/move`, { status: newStatus, version });
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["board", projectId] }),
    onError: (err: Error) => setErrorMessage(err.message || "Failed to move issue"),
  });

  const createIssueMut = useMutation({
    mutationFn: async () => {
      setErrorMessage(null);
      const res = await api.post(`/projects/${projectId}/issues`, {
        title: newTitle,
        priority: newPriority,
        type: newType,
        assignee_id: newAssigneeId || null,
      });
      return res.data;
    },
    onSuccess: (created) => {
      setNewTitle("");
      setNewAssigneeId("");
      setShowCreate(false);
      queryClient.invalidateQueries({ queryKey: ["board", projectId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setSelectedIssueId(created.id);
    },
    onError: (err: Error) => setErrorMessage(err.message),
  });

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-xl font-bold">Board</h1>
          <p className="text-sm text-[var(--text-mid)] mt-1">Track and move issues across workflow stages</p>
        </div>
      </div>

      {errorMessage && (
        <div className="bg-[var(--red)]/10 border border-[var(--red)]/30 text-[var(--red)] px-4 py-3 rounded-lg text-sm flex justify-between">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)}>&times;</button>
        </div>
      )}

      <div className="flex items-center gap-3">
        <ProjectSelector />
        <button
          onClick={() => setShowCreate(true)}
          disabled={!projectId}
          className="px-3 py-1.5 bg-[var(--bg-2)] border border-[var(--border)] text-sm rounded-lg hover:bg-[var(--bg-3)] disabled:opacity-50 transition"
        >
          <span className="mr-1">+</span> Add issue
        </button>
        <div className="flex-1 max-w-xs relative">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-lo)]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            type="text"
            placeholder="Search issues..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[var(--bg-2)] border border-[var(--border)] rounded-lg py-1.5 pl-9 pr-3 text-xs text-[var(--text-hi)] placeholder:text-[var(--text-lo)] focus:outline-none focus:border-[var(--steel)]"
          />
        </div>
      </div>

      {isLoading && <div className="text-[var(--text-mid)] py-12 text-center">Loading board...</div>}
      {isError && <div className="text-[var(--text-mid)] py-12 text-center">Select a project to view its board.</div>}

      {board && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {board.columns.map((col) => {
            const config = (COLUMN_CONFIG[col.status] ?? COLUMN_CONFIG.TODO)!;
            return (
              <div key={col.status} className="bg-[var(--bg-1)] border border-[var(--border)] rounded-lg p-3 min-h-[460px]">
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[var(--text-mid)]">
                    <span className="w-2 h-2 rounded-full" style={{ background: config.dot }} />
                    {config.title}
                  </div>
                  <span className="text-[10px] text-[var(--text-lo)] bg-[var(--bg-2)] px-2 py-0.5 rounded-full font-mono">{col.total_count}</span>
                </div>

                <div className="space-y-2.5">
                  {col.issues.map((issue) => {
                    const typeStyle = (TYPE_STYLES[issue.type] ?? TYPE_STYLES.TASK)!;
                    const priStyle = (PRIORITY_STYLES[issue.priority] ?? PRIORITY_STYLES.MEDIUM)!;
                    const assigneeInitials = issue.assignee?.username?.slice(0, 2).toUpperCase() || null;

                    return (
                      <div
                        key={issue.id}
                        onClick={() => setSelectedIssueId(issue.id)}
                        className="bg-[var(--bg-2)] border border-[var(--border)] rounded-lg p-3 relative overflow-hidden hover:border-[var(--steel)] cursor-pointer transition shadow-sm group"
                        style={{ borderLeftWidth: 3, borderLeftColor: typeStyle.border }}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-mono text-[10px] text-[var(--text-lo)] group-hover:text-[var(--steel)] transition">
                            {issue.issue_key}
                          </span>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center justify-center" style={{ background: typeStyle.bg, color: typeStyle.color }}>
                            {issue.type}
                          </span>
                        </div>
                        
                        <div className="text-[12px] font-medium text-[var(--text-hi)] leading-snug mb-3 line-clamp-2">
                          {issue.title}
                        </div>

                        {issue.labels.length > 0 && (
                          <div className="flex gap-1 flex-wrap mb-3">
                            {issue.labels.map((lbl) => (
                              <span key={lbl.id} className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--bg-3)] text-[var(--text-mid)]">
                                {lbl.name}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold" style={{ background: priStyle.bg, color: priStyle.color }}>
                              {issue.priority}
                            </span>
                            {assigneeInitials ? (
                              <div
                                title={`Assigned to: ${issue.assignee?.full_name || issue.assignee?.username}`}
                                className="w-5 h-5 rounded-full bg-[var(--steel-dim)] text-[#BFD4FF] text-[9px] font-bold flex items-center justify-center font-display"
                              >
                                {assigneeInitials}
                              </div>
                            ) : (
                              <div
                                title="Unassigned"
                                className="w-5 h-5 rounded-full border border-dashed border-[var(--text-lo)] text-[var(--text-lo)] text-[8px] flex items-center justify-center"
                              >
                                —
                              </div>
                            )}
                          </div>

                          <select
                            value={issue.status}
                            onChange={(e) => {
                              e.stopPropagation();
                              moveMutation.mutate({ issueId: issue.id, newStatus: e.target.value, version: issue.version });
                            }}
                            className="text-[10px] border border-[var(--border)] rounded px-1.5 py-0.5 bg-[var(--bg-3)] text-[var(--text-mid)] focus:outline-none focus:border-[var(--steel)]"
                          >
                            <option value="TODO">Todo</option>
                            <option value="IN_PROGRESS">In progress</option>
                            <option value="IN_REVIEW">In review</option>
                            <option value="DONE">Done</option>
                          </select>
                        </div>
                      </div>
                    );
                  })}

                  <div
                    className="text-[12px] text-[var(--text-lo)] text-center py-2.5 border border-dashed border-[var(--border)] rounded-lg cursor-pointer hover:text-[var(--text-mid)] hover:border-[var(--text-lo)] transition"
                    onClick={() => setShowCreate(true)}
                  >
                    + Add issue
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Quick Create Issue Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-1)] border border-[var(--border)] rounded-xl p-6 w-full max-w-md space-y-4 shadow-xl">
            <h3 className="font-semibold text-[var(--text-hi)]">Create Issue</h3>
            <div>
              <label className="block text-[11px] text-[var(--text-mid)] mb-1.5">Title</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full bg-[var(--bg-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-hi)] focus:outline-none focus:border-[var(--steel)]"
                placeholder="Issue title"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-[var(--text-mid)] mb-1.5">Type</label>
                <select value={newType} onChange={(e) => setNewType(e.target.value as typeof newType)} className="w-full bg-[var(--bg-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-hi)]">
                  <option value="TASK">Task</option>
                  <option value="BUG">Bug</option>
                  <option value="STORY">Story</option>
                  <option value="FEATURE">Feature</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-[var(--text-mid)] mb-1.5">Priority</label>
                <select value={newPriority} onChange={(e) => setNewPriority(e.target.value as typeof newPriority)} className="w-full bg-[var(--bg-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-hi)]">
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-[11px] text-[var(--text-mid)] mb-1.5">Assignee</label>
              <select
                value={newAssigneeId}
                onChange={(e) => setNewAssigneeId(e.target.value)}
                className="w-full bg-[var(--bg-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-hi)]"
              >
                <option value="">Unassigned</option>
                {members?.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.user.full_name || m.user.username} (@{m.user.username})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-[var(--text-mid)] hover:bg-[var(--bg-2)] rounded-lg">Cancel</button>
              <button
                disabled={!newTitle.trim() || createIssueMut.isPending}
                onClick={() => createIssueMut.mutate()}
                className="px-4 py-2 text-sm bg-[var(--ember)] text-[#20100A] font-semibold rounded-lg disabled:opacity-50"
              >
                {createIssueMut.isPending ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comprehensive Issue Detail & Comments Modal */}
      {selectedIssueId && projectId && (
        <IssueDetailModal
          issueId={selectedIssueId}
          projectId={projectId}
          onClose={() => setSelectedIssueId(null)}
          onUpdated={() => queryClient.invalidateQueries({ queryKey: ["board", projectId] })}
        />
      )}
    </div>
  );
}
