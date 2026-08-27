import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";

interface UserPublic {
  id: string;
  username: string;
  full_name: string | null;
}

interface ProjectMember {
  id: string;
  user_id: string;
  role: "ADMIN" | "PROJECT_MANAGER" | "DEVELOPER" | "VIEWER";
  created_at: string;
  user: UserPublic;
}

interface OrgMember {
  id: string;
  user_id: string;
  role: string;
  user: UserPublic;
}

const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
  ADMIN: { bg: "#3A1414", color: "#F2A7A7" },
  PROJECT_MANAGER: { bg: "var(--amber-dim)", color: "#F0C97D" },
  DEVELOPER: { bg: "var(--steel-dim)", color: "#BFD4FF" },
  VIEWER: { bg: "var(--bg-3)", color: "var(--text-mid)" },
};

export default function ProjectMembersManager({
  projectId,
  orgId,
}: {
  projectId: string;
  orgId: string;
}) {
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<"ADMIN" | "PROJECT_MANAGER" | "DEVELOPER" | "VIEWER">("DEVELOPER");
  const [actionError, setActionError] = useState<string | null>(null);

  // Fetch project members
  const { data: projectMembers, isLoading: loadingMembers } = useQuery<ProjectMember[]>({
    queryKey: ["project-members", projectId],
    queryFn: async () => {
      const res = await api.get(`/projects/${projectId}/members`);
      return res.data;
    },
    enabled: Boolean(projectId),
  });

  // Fetch organization members (to pick from)
  const { data: orgMembers } = useQuery<OrgMember[]>({
    queryKey: ["org-members", orgId],
    queryFn: async () => {
      const res = await api.get(`/organizations/${orgId}/members`);
      return res.data;
    },
    enabled: Boolean(orgId) && showAddModal,
  });

  // Add project member mutation
  const addProjectMemberMutation = useMutation({
    mutationFn: async () => {
      setActionError(null);
      if (!selectedUserId) return;
      const res = await api.post(`/projects/${projectId}/members`, {
        user_id: selectedUserId,
        role: selectedRole,
      });
      return res.data;
    },
    onSuccess: () => {
      setShowAddModal(false);
      setSelectedUserId("");
      queryClient.invalidateQueries({ queryKey: ["project-members", projectId] });
    },
    onError: (err: Error) => {
      setActionError(err.message || "Failed to add project member");
    },
  });

  // Remove project member mutation
  const removeProjectMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      setActionError(null);
      const res = await api.delete(`/projects/${projectId}/members/${userId}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-members", projectId] });
    },
    onError: (err: Error) => {
      setActionError(err.message || "Failed to remove project member");
    },
  });

  const existingProjectUserIds = new Set(projectMembers?.map((m) => m.user_id) || []);
  const availableOrgMembers = orgMembers?.filter((om) => !existingProjectUserIds.has(om.user_id)) || [];

  return (
    <div className="space-y-3 pt-2">
      <div className="flex items-center justify-between">
        <h5 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-mid)]">
          Project Team ({projectMembers?.length || 0})
        </h5>
        <button
          onClick={() => {
            setShowAddModal(true);
            setSelectedUserId(availableOrgMembers[0]?.user_id || "");
          }}
          className="text-[11px] font-medium text-[var(--steel)] hover:underline flex items-center gap-1"
        >
          <span>+</span> Add Member
        </button>
      </div>

      {actionError && (
        <div className="bg-[var(--red)]/10 border border-[var(--red)]/30 text-[var(--red)] px-3 py-1.5 rounded text-[11px] flex justify-between items-center">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)}>&times;</button>
        </div>
      )}

      {loadingMembers ? (
        <div className="text-[11px] text-[var(--text-lo)] py-2">Loading team...</div>
      ) : projectMembers && projectMembers.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {projectMembers.map((m) => {
            const roleStyle = (ROLE_COLORS[m.role] ?? ROLE_COLORS.VIEWER)!;
            return (
              <div
                key={m.id}
                className="bg-[var(--bg-2)] border border-[var(--border)] rounded-lg p-2.5 flex items-center justify-between"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-full bg-[var(--steel-dim)] text-[#BFD4FF] text-[10px] font-semibold flex items-center justify-center font-display flex-shrink-0">
                    {m.user.username.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="truncate">
                    <div className="text-xs font-medium text-[var(--text-hi)] truncate">
                      {m.user.full_name || m.user.username}
                    </div>
                    <div className="text-[10px] text-[var(--text-lo)] font-mono">@{m.user.username}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  <span
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded font-mono"
                    style={{ background: roleStyle.bg, color: roleStyle.color }}
                  >
                    {m.role}
                  </span>
                  <button
                    disabled={removeProjectMemberMutation.isPending}
                    onClick={() => {
                      if (window.confirm(`Remove @${m.user.username} from this project?`)) {
                        removeProjectMemberMutation.mutate(m.user_id);
                      }
                    }}
                    className="text-[10px] text-[var(--red)] hover:opacity-80 transition"
                  >
                    &times;
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-[11px] text-[var(--text-lo)] py-2">No team members assigned.</div>
      )}

      {/* Add Project Member Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-1)] border border-[var(--border)] rounded-xl p-5 w-full max-w-sm space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <h3 className="font-semibold text-xs text-[var(--text-hi)]">Add Member to Project</h3>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-medium text-[var(--text-mid)]">
                Select from Organization Members
              </label>
              {availableOrgMembers.length > 0 ? (
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full bg-[var(--bg-2)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-hi)] focus:outline-none focus:border-[var(--steel)]"
                >
                  <option value="">-- Choose member --</option>
                  {availableOrgMembers.map((om) => (
                    <option key={om.user_id} value={om.user_id}>
                      {om.user.full_name || om.user.username} (@{om.user.username})
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-[11px] text-[var(--text-lo)] italic">
                  All organization members are already in this project.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-medium text-[var(--text-mid)]">Project Role</label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as typeof selectedRole)}
                className="w-full bg-[var(--bg-2)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-hi)] focus:outline-none focus:border-[var(--steel)]"
              >
                <option value="DEVELOPER">DEVELOPER</option>
                <option value="PROJECT_MANAGER">PROJECT_MANAGER</option>
                <option value="ADMIN">ADMIN</option>
                <option value="VIEWER">VIEWER</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-3 py-1.5 text-xs text-[var(--text-mid)] hover:bg-[var(--bg-2)] rounded-lg"
              >
                Cancel
              </button>
              <button
                disabled={!selectedUserId || addProjectMemberMutation.isPending}
                onClick={() => addProjectMemberMutation.mutate()}
                className="px-3 py-1.5 text-xs bg-[var(--ember)] text-[#20100A] font-semibold rounded-lg disabled:opacity-50 transition"
              >
                {addProjectMemberMutation.isPending ? "Adding..." : "Add to Project"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
