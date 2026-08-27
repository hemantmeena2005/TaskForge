import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import ProjectSelector from "@/components/ProjectSelector";
import IssueDetailModal from "@/components/IssueDetailModal";
import { useProjectStore } from "@/lib/projectStore";
import { Spinner, SprintSkeleton, IssueRowSkeleton } from "@/components/LoadingSkeleton";

export interface Sprint {
  id: string;
  project_id: string;
  name: string;
  goal: string | null;
  status: "PLANNED" | "ACTIVE" | "COMPLETED";
  start_date: string | null;
  end_date: string | null;
  completed_at: string | null;
  issue_count: number;
}

export interface SprintStats {
  sprint_id: string;
  total_issues: number;
  completed_issues: number;
  remaining_issues: number;
  completion_percentage: number;
}

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

export default function SprintPage() {
  const queryClient = useQueryClient();
  const selectedProjectId = useProjectStore((s) => s.selectedProjectId);
  const projectId: string = selectedProjectId || "";

  const [newSprintName, setNewSprintName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [showAddIssuesModal, setShowAddIssuesModal] = useState(false);
  const [selectedBacklogIssueIds, setSelectedBacklogIssueIds] = useState<string[]>([]);

  // 1. Fetch Sprints
  const { data: sprints, isLoading: loadingSprints } = useQuery<Sprint[]>({
    queryKey: ["sprints", projectId],
    queryFn: async () => {
      const res = await api.get(`/projects/${projectId}/sprints`);
      return res.data;
    },
    enabled: Boolean(projectId),
  });

  const activeSprint = sprints?.find((s) => s.status === "ACTIVE");

  // 2. Fetch Active Sprint Stats
  const { data: activeStats } = useQuery<SprintStats>({
    queryKey: ["sprint-stats", activeSprint?.id],
    queryFn: async () => {
      const res = await api.get(`/sprints/${activeSprint?.id}/stats`);
      return res.data;
    },
    enabled: Boolean(activeSprint),
  });

  // 3. Fetch Issues inside Active Sprint
  const { data: sprintIssuesData, isLoading: loadingSprintIssues } = useQuery<IssueListResponse>({
    queryKey: ["sprint-issues", activeSprint?.id],
    queryFn: async () => {
      const res = await api.get(`/projects/${projectId}/issues?sprint_id=${activeSprint?.id}&page_size=100`);
      return res.data;
    },
    enabled: Boolean(activeSprint && projectId),
  });

  // 4. Fetch Backlog Issues (not in any sprint) for the "Add to Sprint" modal
  const { data: backlogIssuesData, isLoading: loadingBacklog } = useQuery<IssueListResponse>({
    queryKey: ["backlog-for-sprint", projectId],
    queryFn: async () => {
      const res = await api.get(`/projects/${projectId}/issues?sprint_id=backlog&page_size=100`);
      return res.data;
    },
    enabled: showAddIssuesModal && Boolean(projectId),
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: async () => {
      setErrorMessage(null);
      const res = await api.post(`/projects/${projectId}/sprints`, { name: newSprintName });
      return res.data;
    },
    onSuccess: () => {
      setNewSprintName("");
      setIsCreating(false);
      queryClient.invalidateQueries({ queryKey: ["sprints", projectId] });
    },
    onError: (err: Error) => setErrorMessage(err.message),
  });

  const startMutation = useMutation({
    mutationFn: async (sprintId: string) => {
      setErrorMessage(null);
      const res = await api.post(`/sprints/${sprintId}/start`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sprints", projectId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (err: Error) => setErrorMessage(err.message),
  });

  const completeMutation = useMutation({
    mutationFn: async (sprintId: string) => {
      setErrorMessage(null);
      const res = await api.post(`/sprints/${sprintId}/complete`, { destination_sprint_id: null });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sprints", projectId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (err: Error) => setErrorMessage(err.message),
  });

  const addIssuesMutation = useMutation({
    mutationFn: async () => {
      if (!activeSprint || selectedBacklogIssueIds.length === 0) return;
      await api.post(`/sprints/${activeSprint.id}/issues`, {
        issue_ids: selectedBacklogIssueIds,
      });
    },
    onSuccess: () => {
      setSelectedBacklogIssueIds([]);
      setShowAddIssuesModal(false);
      queryClient.invalidateQueries({ queryKey: ["sprint-issues", activeSprint?.id] });
      queryClient.invalidateQueries({ queryKey: ["sprint-stats", activeSprint?.id] });
      queryClient.invalidateQueries({ queryKey: ["project-backlog", projectId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (err: Error) => setErrorMessage(err.message),
  });

  const removeIssueMutation = useMutation({
    mutationFn: async (issueId: string) => {
      if (!activeSprint) return;
      await api.delete(`/sprints/${activeSprint.id}/issues/${issueId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sprint-issues", activeSprint?.id] });
      queryClient.invalidateQueries({ queryKey: ["sprint-stats", activeSprint?.id] });
      queryClient.invalidateQueries({ queryKey: ["project-backlog", projectId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const moveStatusMutation = useMutation({
    mutationFn: async ({ issueId, newStatus, version }: { issueId: string; newStatus: string; version: number }) => {
      await api.post(`/issues/${issueId}/move`, { status: newStatus, version });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sprint-issues", activeSprint?.id] });
      queryClient.invalidateQueries({ queryKey: ["sprint-stats", activeSprint?.id] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["board", projectId] });
    },
  });

  const sprintIssues = sprintIssuesData?.items || [];
  const backlogIssues = backlogIssuesData?.items || [];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-xl font-bold">Sprints</h1>
          <p className="text-sm text-[var(--text-mid)] mt-1">Plan sprints, assign backlog issues, track delivery</p>
        </div>
        <div className="flex items-center gap-3">
          <ProjectSelector />
          <button
            onClick={() => setIsCreating(true)}
            disabled={!projectId}
            className="px-4 py-2 bg-[var(--ember)] text-[#20100A] text-sm font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 transition"
          >
            + Create Sprint
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="bg-[var(--red)]/10 border border-[var(--red)]/30 text-[var(--red)] px-4 py-3 rounded-lg text-sm flex justify-between">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)}>&times;</button>
        </div>
      )}

      {/* Create Sprint Form */}
      {isCreating && (
        <div className="bg-[var(--bg-1)] border border-[var(--border)] rounded-xl p-5 space-y-4 shadow-sm">
          <h3 className="font-semibold text-[var(--text-hi)]">Create New Sprint</h3>
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="e.g. Sprint 1, Q3 Release"
              value={newSprintName}
              onChange={(e) => setNewSprintName(e.target.value)}
              className="flex-1 bg-[var(--bg-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-hi)] focus:outline-none focus:border-[var(--steel)]"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setIsCreating(false)}
              className="px-4 py-2 text-sm text-[var(--text-mid)] hover:bg-[var(--bg-2)] rounded-lg"
            >
              Cancel
            </button>
            <button
              disabled={!newSprintName.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate()}
              className="px-4 py-2 text-sm bg-[var(--ember)] text-[#20100A] font-semibold rounded-lg disabled:opacity-50"
            >
              {createMutation.isPending ? "Creating..." : "Create Sprint"}
            </button>
          </div>
        </div>
      )}

      {/* Active Sprint Section */}
      {loadingSprints ? (
        <SprintSkeleton />
      ) : activeSprint ? (
        <div className="bg-[var(--bg-1)] border border-[var(--border)] rounded-xl p-6 space-y-5 shadow-sm animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-[var(--steel-dim)] text-[#BFD4FF] rounded-full">
                Active Sprint
              </span>
              <h2 className="font-display font-bold text-lg text-[var(--text-hi)]">{activeSprint.name}</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAddIssuesModal(true)}
                className="px-3.5 py-2 bg-[var(--bg-2)] border border-[var(--border)] text-xs font-semibold rounded-lg hover:bg-[var(--bg-3)] transition flex items-center gap-1.5"
              >
                <span>+</span> Add Issues to Sprint
              </button>
              <button
                onClick={() => completeMutation.mutate(activeSprint.id)}
                className="px-3.5 py-2 bg-[var(--bg-2)] border border-[var(--border)] text-xs font-semibold text-[var(--text-hi)] rounded-lg hover:bg-[var(--bg-3)] transition"
              >
                Complete Sprint
              </button>
            </div>
          </div>

          {/* Progress & Stat Cards */}
          {activeStats && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-[var(--text-mid)]">
                <span>Sprint Completion</span>
                <span className="font-bold text-sm text-[var(--ember)]">{activeStats.completion_percentage}%</span>
              </div>
              <div className="w-full h-2 bg-[var(--bg-3)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--ember)] rounded-full transition-all duration-300"
                  style={{ width: `${activeStats.completion_percentage}%` }}
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-[var(--bg-2)] p-3.5 rounded-lg text-center">
                  <div className="text-[10px] text-[var(--text-mid)] uppercase tracking-wider font-semibold">
                    Total Issues
                  </div>
                  <div className="font-display text-xl font-bold mt-1 text-[var(--text-hi)]">
                    {activeStats.total_issues}
                  </div>
                </div>
                <div className="bg-[var(--teal-dim)] p-3.5 rounded-lg text-center">
                  <div className="text-[10px] text-[var(--teal)] uppercase tracking-wider font-semibold">Completed</div>
                  <div className="font-display text-xl font-bold text-[#8FE3B9] mt-1">
                    {activeStats.completed_issues}
                  </div>
                </div>
                <div className="bg-[var(--amber)]/10 p-3.5 rounded-lg text-center">
                  <div className="text-[10px] text-[var(--amber)] uppercase tracking-wider font-semibold">Remaining</div>
                  <div className="font-display text-xl font-bold text-[var(--amber)] mt-1">
                    {activeStats.remaining_issues}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Sprint Issues List */}
          <div className="pt-2 border-t border-[var(--border)] space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-mid)]">
                Issues in this Sprint ({sprintIssues.length})
              </h3>
              {sprintIssues.length === 0 && (
                <button
                  onClick={() => setShowAddIssuesModal(true)}
                  className="text-xs text-[var(--steel)] hover:underline font-semibold"
                >
                  + Add issues from backlog
                </button>
              )}
            </div>

            {loadingSprintIssues ? (
              <IssueRowSkeleton count={3} />
            ) : sprintIssues.length === 0 ? (
              <div className="text-center py-8 bg-[var(--bg-2)]/50 border border-[var(--border)] rounded-lg text-xs text-[var(--text-mid)]">
                No issues in this sprint yet. Click{" "}
                <button onClick={() => setShowAddIssuesModal(true)} className="text-[var(--steel)] underline font-semibold">
                  + Add Issues to Sprint
                </button>{" "}
                to pull tasks from the backlog!
              </div>
            ) : (
              <div className="divide-y divide-[var(--border)] border border-[var(--border)] rounded-lg bg-[var(--bg-2)]/40 overflow-hidden">
                {sprintIssues.map((issue) => {
                  const pConf = PRIORITY_CONFIG[issue.priority] ?? PRIORITY_CONFIG.MEDIUM;

                  return (
                    <div
                      key={issue.id}
                      className="p-3 flex items-center justify-between gap-3 hover:bg-[var(--bg-3)]/60 transition group"
                    >
                      <div
                        onClick={() => setSelectedIssueId(issue.id)}
                        className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                      >
                        <span className="font-mono text-xs font-bold text-[var(--steel)] flex-shrink-0">
                          {issue.issue_key}
                        </span>
                        <span className="text-xs font-medium text-[var(--text-hi)] truncate">{issue.title}</span>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Quick Status Toggle */}
                        <select
                          value={issue.status}
                          onChange={(e) =>
                            moveStatusMutation.mutate({
                              issueId: issue.id,
                              newStatus: e.target.value,
                              version: issue.version,
                            })
                          }
                          className="text-[10px] font-bold px-2 py-0.5 rounded font-mono bg-[var(--bg-1)] border border-[var(--border)] text-[var(--text-hi)] focus:outline-none"
                        >
                          <option value="TODO">To Do</option>
                          <option value="IN_PROGRESS">In Progress</option>
                          <option value="IN_REVIEW">In Review</option>
                          <option value="DONE">Done</option>
                        </select>

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
                            className="w-5 h-5 rounded-full bg-[var(--steel-dim)] text-[#BFD4FF] text-[9px] font-bold flex items-center justify-center font-display"
                            title={`Assigned to ${issue.assignee.full_name || issue.assignee.username}`}
                          >
                            {issue.assignee.username.slice(0, 2).toUpperCase()}
                          </div>
                        ) : (
                          <span className="text-[10px] text-[var(--text-lo)] italic">Unassigned</span>
                        )}

                        {/* Remove from sprint button */}
                        <button
                          onClick={() => removeIssueMutation.mutate(issue.id)}
                          className="text-[var(--text-lo)] hover:text-[var(--red)] p-1 text-xs transition ml-1"
                          title="Move back to Backlog"
                        >
                          &times;
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-[var(--bg-1)] border border-[var(--border)] rounded-xl p-8 text-center space-y-3">
          <div className="text-sm font-semibold text-[var(--text-hi)]">No Active Sprint</div>
          <p className="text-xs text-[var(--text-mid)] max-w-md mx-auto">
            You don&apos;t have an active sprint running for this project. Start one of the planned sprints below to
            track progress!
          </p>
        </div>
      )}

      {/* Sprint History / Planned Sprints */}
      <div className="bg-[var(--bg-1)] border border-[var(--border)] rounded-xl p-5 shadow-sm">
        <h3 className="font-semibold text-sm text-[var(--text-hi)] mb-4">All Sprints</h3>
        {loadingSprints && <div className="py-4"><Spinner size="sm" label="Loading sprints..." /></div>}
        {sprints && sprints.length === 0 && (
          <div className="text-[var(--text-lo)] text-center py-8 text-xs">No sprints created yet for this project</div>
        )}
        <div className="space-y-2">
          {sprints?.map((sprint) => (
            <div
              key={sprint.id}
              className="flex items-center justify-between p-3.5 rounded-lg border border-[var(--border)] hover:bg-[var(--bg-2)] transition"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded font-mono ${
                    sprint.status === "ACTIVE"
                      ? "bg-[var(--steel-dim)] text-[#BFD4FF]"
                      : sprint.status === "COMPLETED"
                      ? "bg-[var(--teal-dim)] text-[#8FE3B9]"
                      : "bg-[var(--bg-3)] text-[var(--text-mid)]"
                  }`}
                >
                  {sprint.status}
                </span>
                <span className="font-semibold text-sm text-[var(--text-hi)]">{sprint.name}</span>
                <span className="text-xs text-[var(--text-lo)] font-mono">({sprint.issue_count} issues)</span>
              </div>
              {sprint.status === "PLANNED" && (
                <button
                  disabled={Boolean(activeSprint) || startMutation.isPending}
                  onClick={() => startMutation.mutate(sprint.id)}
                  className="px-3 py-1.5 text-xs bg-[var(--steel)] text-[#20100A] font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 transition"
                  title={activeSprint ? "Complete current active sprint first" : "Start this sprint"}
                >
                  Start Sprint
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Modal: Add Backlog Issues into Sprint */}
      {showAddIssuesModal && activeSprint && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-1)] border border-[var(--border)] rounded-xl p-6 w-full max-w-lg space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm text-[var(--text-hi)]">
                Add Backlog Issues to &quot;{activeSprint.name}&quot;
              </h3>
              <button
                onClick={() => setShowAddIssuesModal(false)}
                className="text-[var(--text-lo)] hover:text-[var(--text-hi)] text-lg"
              >
                &times;
              </button>
            </div>

            <p className="text-xs text-[var(--text-mid)]">
              Select issues from your backlog to move into this sprint:
            </p>

            <div className="max-h-60 overflow-y-auto divide-y divide-[var(--border)] border border-[var(--border)] rounded-lg bg-[var(--bg-2)]/30">
              {loadingBacklog ? (
                <div className="py-6">
                  <Spinner size="sm" label="Fetching backlog issues..." />
                </div>
              ) : backlogIssues.length === 0 ? (
                <div className="p-4 text-center text-xs text-[var(--text-lo)]">
                  No unscheduled backlog issues found. Create new issues first!
                </div>
              ) : (
                backlogIssues.map((issue) => {
                  const isChecked = selectedBacklogIssueIds.includes(issue.id);
                  return (
                    <label
                      key={issue.id}
                      className="p-2.5 flex items-center gap-3 hover:bg-[var(--bg-3)] cursor-pointer transition text-xs"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedBacklogIssueIds((prev) => [...prev, issue.id]);
                          } else {
                            setSelectedBacklogIssueIds((prev) => prev.filter((id) => id !== issue.id));
                          }
                        }}
                        className="rounded border-[var(--border)] text-[var(--steel)]"
                      />
                      <span className="font-mono text-xs font-bold text-[var(--steel)]">{issue.issue_key}</span>
                      <span className="text-[var(--text-hi)] truncate flex-1">{issue.title}</span>
                      <span className="text-[10px] text-[var(--text-lo)] font-mono uppercase">{issue.priority}</span>
                    </label>
                  );
                })
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
              <button
                onClick={() => setShowAddIssuesModal(false)}
                className="px-4 py-2 text-xs text-[var(--text-mid)] hover:bg-[var(--bg-2)] rounded-lg font-medium"
              >
                Cancel
              </button>
              <button
                disabled={selectedBacklogIssueIds.length === 0 || addIssuesMutation.isPending}
                onClick={() => addIssuesMutation.mutate()}
                className="px-4 py-2 text-xs bg-[var(--ember)] text-[#20100A] font-semibold rounded-lg disabled:opacity-50 transition"
              >
                {addIssuesMutation.isPending
                  ? "Adding..."
                  : `Add ${selectedBacklogIssueIds.length} Issue${selectedBacklogIssueIds.length === 1 ? "" : "s"}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comprehensive Issue Detail Drawer */}
      {selectedIssueId && (
        <IssueDetailModal
          issueId={selectedIssueId}
          projectId={projectId}
          onClose={() => setSelectedIssueId(null)}
          onUpdated={() => {
            queryClient.invalidateQueries({ queryKey: ["sprint-issues", activeSprint?.id] });
            queryClient.invalidateQueries({ queryKey: ["sprint-stats", activeSprint?.id] });
            queryClient.invalidateQueries({ queryKey: ["dashboard"] });
          }}
        />
      )}
    </div>
  );
}
