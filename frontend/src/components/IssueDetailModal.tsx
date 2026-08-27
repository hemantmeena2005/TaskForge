import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { useAuthStore } from "@/lib/auth";

interface UserPublic {
  id: string;
  username: string;
  full_name: string | null;
}

interface ProjectMember {
  id: string;
  user_id: string;
  role: string;
  user: UserPublic;
}

interface Label {
  id: string;
  name: string;
  color: string;
}

interface IssueDetail {
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

interface CommentItem {
  id: string;
  issue_id: string;
  author_id: string;
  body: string;
  created_at: string;
  updated_at: string;
  author: UserPublic | null;
}

interface SprintItem {
  id: string;
  name: string;
  status: string;
}

interface IssueDetailModalProps {
  issueId: string;
  projectId: string;
  onClose: () => void;
  onUpdated?: () => void;
}

const TYPE_CONFIG = {
  TASK: { label: "Task", color: "#BFD4FF", bg: "var(--steel-dim)", border: "var(--steel)" },
  BUG: { label: "Bug", color: "#F2A7A7", bg: "#3A1414", border: "var(--red)" },
  STORY: { label: "Story", color: "#8FE3B9", bg: "var(--teal-dim)", border: "var(--teal)" },
  FEATURE: { label: "Feature", color: "#FFB79A", bg: "var(--ember-dim)", border: "var(--ember)" },
};

const PRIORITY_CONFIG = {
  LOW: { label: "Low", color: "#7FD9AE", bg: "#122A1F" },
  MEDIUM: { label: "Medium", color: "#F0C97D", bg: "#3A2A10" },
  HIGH: { label: "High", color: "#F2A7A7", bg: "#3A1414" },
  URGENT: { label: "Urgent", color: "#FF8F8F", bg: "#4A1010" },
};

function formatDateTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function IssueDetailModal({
  issueId,
  projectId,
  onClose,
  onUpdated,
}: IssueDetailModalProps) {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState("");
  const [newCommentBody, setNewCommentBody] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentBody, setEditingCommentBody] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  // Fetch issue details
  const { data: issue, isLoading: issueLoading } = useQuery<IssueDetail>({
    queryKey: ["issue", issueId],
    queryFn: async () => {
      const res = await api.get(`/issues/${issueId}`);
      return res.data;
    },
  });

  // Fetch project members for assignment dropdown
  const { data: members } = useQuery<ProjectMember[]>({
    queryKey: ["project-members", projectId],
    queryFn: async () => {
      const res = await api.get(`/projects/${projectId}/members`);
      return res.data;
    },
    enabled: Boolean(projectId),
  });

  // Fetch project sprints
  const { data: sprints } = useQuery<SprintItem[]>({
    queryKey: ["sprints", projectId],
    queryFn: async () => {
      const res = await api.get(`/projects/${projectId}/sprints`);
      return res.data;
    },
    enabled: Boolean(projectId),
  });

  // Fetch comments
  const { data: comments, isLoading: commentsLoading } = useQuery<CommentItem[]>({
    queryKey: ["comments", issueId],
    queryFn: async () => {
      const res = await api.get(`/issues/${issueId}/comments`);
      return res.data;
    },
  });

  // Mutation to update issue fields
  const updateIssueMutation = useMutation({
    mutationFn: async (payload: Partial<{
      title: string;
      description: string | null;
      type: string;
      priority: string;
      status: string;
      assignee_id: string | null;
      sprint_id: string | null;
      due_date: string | null;
    }>) => {
      setActionError(null);
      const res = await api.patch(`/issues/${issueId}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["issue", issueId] });
      queryClient.invalidateQueries({ queryKey: ["board", projectId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      onUpdated?.();
    },
    onError: (err: Error) => {
      setActionError(err.message || "Failed to update issue");
    },
  });

  // Mutation to create comment
  const createCommentMutation = useMutation({
    mutationFn: async (body: string) => {
      setActionError(null);
      const res = await api.post(`/issues/${issueId}/comments`, { body });
      return res.data;
    },
    onSuccess: () => {
      setNewCommentBody("");
      queryClient.invalidateQueries({ queryKey: ["comments", issueId] });
    },
    onError: (err: Error) => {
      setActionError(err.message || "Failed to add comment");
    },
  });

  // Mutation to update comment
  const updateCommentMutation = useMutation({
    mutationFn: async ({ commentId, body }: { commentId: string; body: string }) => {
      setActionError(null);
      const res = await api.patch(`/comments/${commentId}`, { body });
      return res.data;
    },
    onSuccess: () => {
      setEditingCommentId(null);
      setEditingCommentBody("");
      queryClient.invalidateQueries({ queryKey: ["comments", issueId] });
    },
    onError: (err: Error) => {
      setActionError(err.message || "Failed to edit comment");
    },
  });

  // Mutation to delete comment
  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      setActionError(null);
      const res = await api.delete(`/comments/${commentId}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comments", issueId] });
    },
    onError: (err: Error) => {
      setActionError(err.message || "Failed to delete comment");
    },
  });

  // Mutation to delete issue
  const deleteIssueMutation = useMutation({
    mutationFn: async () => {
      setActionError(null);
      const res = await api.delete(`/issues/${issueId}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board", projectId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      onUpdated?.();
      onClose();
    },
    onError: (err: Error) => {
      setActionError(err.message || "Failed to delete issue");
    },
  });

  function handleSaveTitle() {
    if (titleDraft.trim() && titleDraft !== issue?.title) {
      updateIssueMutation.mutate({ title: titleDraft.trim() });
    }
    setIsEditingTitle(false);
  }

  function handleSaveDesc() {
    updateIssueMutation.mutate({ description: descDraft.trim() || null });
    setIsEditingDesc(false);
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--bg-1)] border border-[var(--border)] rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between bg-[var(--bg-2)]/50">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs font-semibold px-2.5 py-1 rounded bg-[var(--bg-3)] text-[var(--steel)]">
              {issue?.issue_key || "..."}
            </span>
            {issue && (
              <>
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded border"
                  style={{
                    background: TYPE_CONFIG[issue.type].bg,
                    color: TYPE_CONFIG[issue.type].color,
                    borderColor: TYPE_CONFIG[issue.type].border,
                  }}
                >
                  {TYPE_CONFIG[issue.type].label}
                </span>
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded"
                  style={{
                    background: PRIORITY_CONFIG[issue.priority].bg,
                    color: PRIORITY_CONFIG[issue.priority].color,
                  }}
                >
                  {PRIORITY_CONFIG[issue.priority].label}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (window.confirm("Are you sure you want to delete this issue?")) {
                  deleteIssueMutation.mutate();
                }
              }}
              disabled={deleteIssueMutation.isPending}
              className="text-xs text-[var(--red)] hover:bg-[var(--red)]/10 px-2.5 py-1.5 rounded transition"
            >
              Delete
            </button>
            <button
              onClick={onClose}
              className="text-[var(--text-lo)] hover:text-[var(--text-hi)] p-1.5 rounded-lg hover:bg-[var(--bg-3)] transition text-lg leading-none"
            >
              &times;
            </button>
          </div>
        </div>

        {/* Error notification banner */}
        {actionError && (
          <div className="bg-[var(--red)]/10 border-b border-[var(--red)]/30 text-[var(--red)] px-6 py-2.5 text-xs flex justify-between items-center">
            <span>{actionError}</span>
            <button onClick={() => setActionError(null)} className="font-bold ml-2">&times;</button>
          </div>
        )}

        {issueLoading ? (
          <div className="p-12 text-center text-[var(--text-mid)]">Loading issue details...</div>
        ) : !issue ? (
          <div className="p-12 text-center text-[var(--red)]">Issue not found.</div>
        ) : (
          /* Modal Content Grid */
          <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[var(--border)]">
            
            {/* Main Area: Title, Description, Comments (2 Cols) */}
            <div className="p-6 md:col-span-2 space-y-6">
              
              {/* Title Section */}
              <div>
                {isEditingTitle ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={titleDraft}
                      onChange={(e) => setTitleDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveTitle();
                        if (e.key === "Escape") setIsEditingTitle(false);
                      }}
                      autoFocus
                      className="w-full bg-[var(--bg-2)] border border-[var(--steel)] rounded-lg px-3 py-1.5 text-base font-bold text-[var(--text-hi)] focus:outline-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveTitle}
                        className="px-3 py-1 bg-[var(--ember)] text-[#20100A] text-xs font-semibold rounded"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setIsEditingTitle(false)}
                        className="px-3 py-1 text-xs text-[var(--text-mid)] hover:bg-[var(--bg-2)] rounded"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <h2
                    onClick={() => {
                      setTitleDraft(issue.title);
                      setIsEditingTitle(true);
                    }}
                    className="text-lg font-bold text-[var(--text-hi)] hover:bg-[var(--bg-2)] p-1 -ml-1 rounded cursor-pointer transition flex items-center justify-between group"
                  >
                    <span>{issue.title}</span>
                    <span className="text-[10px] text-[var(--text-lo)] opacity-0 group-hover:opacity-100 transition">
                      ✎ Edit
                    </span>
                  </h2>
                )}
              </div>

              {/* Description Section */}
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-mid)]">
                  Description
                </div>
                {isEditingDesc ? (
                  <div className="space-y-2">
                    <textarea
                      rows={4}
                      value={descDraft}
                      onChange={(e) => setDescDraft(e.target.value)}
                      placeholder="Add a detailed description..."
                      className="w-full bg-[var(--bg-2)] border border-[var(--steel)] rounded-lg p-3 text-sm text-[var(--text-hi)] focus:outline-none resize-y"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveDesc}
                        className="px-3 py-1 bg-[var(--ember)] text-[#20100A] text-xs font-semibold rounded"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setIsEditingDesc(false)}
                        className="px-3 py-1 text-xs text-[var(--text-mid)] hover:bg-[var(--bg-2)] rounded"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => {
                      setDescDraft(issue.description || "");
                      setIsEditingDesc(true);
                    }}
                    className="bg-[var(--bg-2)] border border-[var(--border)] rounded-lg p-3 text-sm min-h-[70px] cursor-pointer hover:border-[var(--text-lo)] transition text-[var(--text-hi)]"
                  >
                    {issue.description ? (
                      <p className="whitespace-pre-wrap">{issue.description}</p>
                    ) : (
                      <span className="text-[var(--text-lo)] italic text-xs">Add a description...</span>
                    )}
                  </div>
                )}
              </div>

              {/* Comments & Activity Section */}
              <div className="space-y-4 pt-4 border-t border-[var(--border)]">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-mid)]">
                    Activity & Discussion ({comments?.length || 0})
                  </h3>
                </div>

                {/* Add new comment */}
                <div className="space-y-2">
                  <textarea
                    rows={2}
                    value={newCommentBody}
                    onChange={(e) => setNewCommentBody(e.target.value)}
                    placeholder="Write a comment..."
                    className="w-full bg-[var(--bg-2)] border border-[var(--border)] rounded-lg p-2.5 text-xs text-[var(--text-hi)] focus:outline-none focus:border-[var(--steel)]"
                  />
                  <div className="flex justify-end">
                    <button
                      disabled={!newCommentBody.trim() || createCommentMutation.isPending}
                      onClick={() => createCommentMutation.mutate(newCommentBody.trim())}
                      className="px-3 py-1.5 bg-[var(--steel)] text-[#0d1b2a] text-xs font-semibold rounded hover:opacity-90 disabled:opacity-50 transition"
                    >
                      {createCommentMutation.isPending ? "Posting..." : "Comment"}
                    </button>
                  </div>
                </div>

                {/* Comments List */}
                <div className="space-y-3 pt-2">
                  {commentsLoading ? (
                    <div className="text-xs text-[var(--text-lo)] py-2">Loading discussion...</div>
                  ) : comments && comments.length > 0 ? (
                    comments.map((comment) => {
                      const isAuthor = currentUser?.id === comment.author_id;
                      const isEditing = editingCommentId === comment.id;

                      return (
                        <div key={comment.id} className="bg-[var(--bg-2)] border border-[var(--border)] rounded-lg p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-5 h-5 rounded-full bg-[var(--steel-dim)] text-[#BFD4FF] text-[9px] font-semibold flex items-center justify-center font-display">
                                {comment.author?.username?.slice(0, 2).toUpperCase() || "??"}
                              </div>
                              <span className="text-xs font-medium text-[var(--text-hi)]">
                                {comment.author?.full_name || comment.author?.username || "Unknown"}
                              </span>
                              <span className="text-[10px] text-[var(--text-lo)]">
                                {formatDateTime(comment.created_at)}
                              </span>
                            </div>

                            {isAuthor && !isEditing && (
                              <div className="flex items-center gap-2 text-[10px]">
                                <button
                                  onClick={() => {
                                    setEditingCommentId(comment.id);
                                    setEditingCommentBody(comment.body);
                                  }}
                                  className="text-[var(--text-lo)] hover:text-[var(--text-hi)]"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => {
                                    if (window.confirm("Delete this comment?")) {
                                      deleteCommentMutation.mutate(comment.id);
                                    }
                                  }}
                                  className="text-[var(--red)] hover:opacity-80"
                                >
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>

                          {isEditing ? (
                            <div className="space-y-2 pt-1">
                              <textarea
                                rows={2}
                                value={editingCommentBody}
                                onChange={(e) => setEditingCommentBody(e.target.value)}
                                className="w-full bg-[var(--bg-1)] border border-[var(--steel)] rounded p-2 text-xs text-[var(--text-hi)] focus:outline-none"
                              />
                              <div className="flex gap-2 justify-end">
                                <button
                                  onClick={() => setEditingCommentId(null)}
                                  className="px-2 py-1 text-[10px] text-[var(--text-mid)] hover:bg-[var(--bg-3)] rounded"
                                >
                                  Cancel
                                </button>
                                <button
                                  disabled={!editingCommentBody.trim()}
                                  onClick={() =>
                                    updateCommentMutation.mutate({
                                      commentId: comment.id,
                                      body: editingCommentBody.trim(),
                                    })
                                  }
                                  className="px-2 py-1 bg-[var(--steel)] text-[#0d1b2a] text-[10px] font-semibold rounded"
                                >
                                  Save
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-[var(--text-mid)] whitespace-pre-wrap">
                              {comment.body}
                            </p>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-xs text-[var(--text-lo)] py-2">No comments yet.</div>
                  )}
                </div>
              </div>
            </div>

            {/* Sidebar Controls (1 Col) */}
            <div className="p-6 space-y-5 bg-[var(--bg-2)]/30">
              
              {/* Status */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-[var(--text-mid)]">Status</label>
                <select
                  value={issue.status}
                  onChange={(e) => updateIssueMutation.mutate({ status: e.target.value })}
                  className="w-full bg-[var(--bg-2)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-hi)] focus:outline-none focus:border-[var(--steel)]"
                >
                  <option value="TODO">To Do</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="IN_REVIEW">In Review</option>
                  <option value="DONE">Done</option>
                </select>
              </div>

              {/* Assignee */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-[var(--text-mid)]">Assignee</label>
                <select
                  value={issue.assignee_id || ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    updateIssueMutation.mutate({ assignee_id: val === "" ? "" : val });
                  }}
                  className="w-full bg-[var(--bg-2)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-hi)] focus:outline-none focus:border-[var(--steel)]"
                >
                  <option value="">Unassigned</option>
                  {members?.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.user.full_name || m.user.username} ({m.role})
                    </option>
                  ))}
                </select>
              </div>

              {/* Priority */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-[var(--text-mid)]">Priority</label>
                <select
                  value={issue.priority}
                  onChange={(e) => updateIssueMutation.mutate({ priority: e.target.value })}
                  className="w-full bg-[var(--bg-2)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-hi)] focus:outline-none focus:border-[var(--steel)]"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>

              {/* Issue Type */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-[var(--text-mid)]">Type</label>
                <select
                  value={issue.type}
                  onChange={(e) => updateIssueMutation.mutate({ type: e.target.value })}
                  className="w-full bg-[var(--bg-2)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-hi)] focus:outline-none focus:border-[var(--steel)]"
                >
                  <option value="TASK">Task</option>
                  <option value="BUG">Bug</option>
                  <option value="STORY">Story</option>
                  <option value="FEATURE">Feature</option>
                </select>
              </div>

              {/* Sprint */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-[var(--text-mid)]">Sprint</label>
                <select
                  value={issue.sprint_id || ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    updateIssueMutation.mutate({ sprint_id: val === "" ? null : val });
                  }}
                  className="w-full bg-[var(--bg-2)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-hi)] focus:outline-none focus:border-[var(--steel)]"
                >
                  <option value="">Backlog (No sprint)</option>
                  {sprints?.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.status})
                    </option>
                  ))}
                </select>
              </div>

              {/* Metadata */}
              <div className="pt-4 border-t border-[var(--border)] space-y-2 text-[11px] text-[var(--text-lo)]">
                <div className="flex justify-between">
                  <span>Reporter</span>
                  <span className="text-[var(--text-mid)] font-medium">
                    {issue.reporter?.full_name || issue.reporter?.username || "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Created</span>
                  <span className="text-[var(--text-mid)]">{formatDateTime(issue.created_at)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Updated</span>
                  <span className="text-[var(--text-mid)]">{formatDateTime(issue.updated_at)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Version</span>
                  <span className="font-mono text-[var(--text-mid)]">v{issue.version}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
