import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";

interface UserPublic {
  id: string;
  username: string;
  full_name: string | null;
  email?: string;
}

interface OrgMember {
  id: string;
  user_id: string;
  role: "ADMIN" | "PROJECT_MANAGER" | "DEVELOPER" | "VIEWER";
  created_at: string;
  user: UserPublic;
}

interface UserSearchResult {
  id: string;
  email: string;
  username: string;
  full_name: string | null;
}

const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
  ADMIN: { bg: "#3A1414", color: "#F2A7A7" },
  PROJECT_MANAGER: { bg: "var(--amber-dim)", color: "#F0C97D" },
  DEVELOPER: { bg: "var(--steel-dim)", color: "#BFD4FF" },
  VIEWER: { bg: "var(--bg-3)", color: "var(--text-mid)" },
};

export default function OrgMembersManager({
  orgId,
  orgName,
  initialInviteCode,
}: {
  orgId: string;
  orgName?: string;
  initialInviteCode?: string | null;
}) {
  const queryClient = useQueryClient();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteTab, setInviteTab] = useState<"code" | "email">("code");
  const [copied, setCopied] = useState(false);

  const [userSearch, setUserSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);
  const [selectedRole, setSelectedRole] = useState<"ADMIN" | "PROJECT_MANAGER" | "DEVELOPER" | "VIEWER">("DEVELOPER");
  const [actionError, setActionError] = useState<string | null>(null);

  // Fetch org members
  const { data: members, isLoading } = useQuery<OrgMember[]>({
    queryKey: ["org-members", orgId],
    queryFn: async () => {
      const res = await api.get(`/organizations/${orgId}/members`);
      return res.data;
    },
    enabled: Boolean(orgId),
  });

  // Fetch invite code
  const { data: codeData, isLoading: loadingCode } = useQuery<{ invite_code: string }>({
    queryKey: ["org-invite-code", orgId],
    queryFn: async () => {
      const res = await api.get(`/organizations/${orgId}/invite-code`);
      return res.data;
    },
    enabled: Boolean(orgId),
  });

  const inviteCode = codeData?.invite_code || initialInviteCode || "";

  // Regenerate invite code mutation
  const regenCodeMutation = useMutation({
    mutationFn: async () => {
      setActionError(null);
      const res = await api.post(`/organizations/${orgId}/regenerate-invite-code`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-invite-code", orgId] });
      queryClient.invalidateQueries({ queryKey: ["orgs"] });
    },
    onError: (err: Error) => {
      setActionError(err.message || "Failed to regenerate invite code");
    },
  });

  // Search users for invite
  const { data: searchResults, isFetching: isSearching } = useQuery<UserSearchResult[]>({
    queryKey: ["users-search", userSearch],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (userSearch.trim()) params.append("search", userSearch.trim());
      const res = await api.get(`/users?${params.toString()}`);
      return res.data;
    },
    enabled: showInviteModal && inviteTab === "email",
  });

  // Add member mutation
  const addMemberMutation = useMutation({
    mutationFn: async () => {
      setActionError(null);
      if (!selectedUser) return;
      const res = await api.post(`/organizations/${orgId}/members`, {
        user_id: selectedUser.id,
        role: selectedRole,
      });
      return res.data;
    },
    onSuccess: () => {
      setShowInviteModal(false);
      setSelectedUser(null);
      setUserSearch("");
      queryClient.invalidateQueries({ queryKey: ["org-members", orgId] });
      queryClient.invalidateQueries({ queryKey: ["orgs"] });
    },
    onError: (err: Error) => {
      setActionError(err.message || "Failed to add member");
    },
  });

  // Remove member mutation
  const removeMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      setActionError(null);
      const res = await api.delete(`/organizations/${orgId}/members/${userId}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-members", orgId] });
      queryClient.invalidateQueries({ queryKey: ["orgs"] });
    },
    onError: (err: Error) => {
      setActionError(err.message || "Failed to remove member");
    },
  });

  function handleCopy() {
    if (!inviteCode) return;
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(inviteCode).catch(() => fallbackCopy(inviteCode));
    } else {
      fallbackCopy(inviteCode);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function fallbackCopy(text: string) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand("copy");
    } catch (err) {
      console.error("Fallback copy failed", err);
    }
    document.body.removeChild(textArea);
  }

  const existingUserIds = new Set(members?.map((m) => m.user_id) || []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-mid)]">
          Organization Members ({members?.length || 0})
        </h4>
        <button
          onClick={() => {
            setShowInviteModal(true);
            setInviteTab("code");
          }}
          className="px-3 py-1 bg-[var(--steel)] text-[#0d1b2a] text-xs font-semibold rounded hover:opacity-90 transition flex items-center gap-1.5"
        >
          <span>+</span> Invite Member
        </button>
      </div>

      {actionError && (
        <div className="bg-[var(--red)]/10 border border-[var(--red)]/30 text-[var(--red)] px-3 py-2 rounded text-xs flex justify-between items-center">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)}>&times;</button>
        </div>
      )}

      {isLoading ? (
        <div className="text-xs text-[var(--text-lo)] py-4 text-center">Loading members...</div>
      ) : members && members.length > 0 ? (
        <div className="divide-y divide-[var(--border)] border border-[var(--border)] rounded-lg overflow-hidden bg-[var(--bg-1)]">
          {members.map((m) => {
            const roleStyle = (ROLE_COLORS[m.role] ?? ROLE_COLORS.VIEWER)!;
            return (
              <div key={m.id} className="p-3 flex items-center justify-between hover:bg-[var(--bg-2)] transition">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[var(--steel-dim)] text-[#BFD4FF] text-xs font-semibold flex items-center justify-center font-display">
                    {m.user.username.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-[var(--text-hi)]">
                      {m.user.full_name || m.user.username}
                    </div>
                    <div className="text-[11px] text-[var(--text-lo)]">@{m.user.username}</div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded font-mono"
                    style={{ background: roleStyle.bg, color: roleStyle.color }}
                  >
                    {m.role}
                  </span>

                  <button
                    disabled={removeMemberMutation.isPending}
                    onClick={() => {
                      if (window.confirm(`Remove @${m.user.username} from this organization?`)) {
                        removeMemberMutation.mutate(m.user_id);
                      }
                    }}
                    className="text-[11px] text-[var(--red)] hover:opacity-80 p-1 transition"
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-xs text-[var(--text-lo)] py-4 text-center">No members found.</div>
      )}

      {/* Invite Member Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-1)] border border-[var(--border)] rounded-xl p-6 w-full max-w-md space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm text-[var(--text-hi)]">Invite to {orgName || "Organization"}</h3>
                <p className="text-[11px] text-[var(--text-mid)] mt-0.5">
                  Share the workspace invite code or invite directly
                </p>
              </div>
              <button
                onClick={() => setShowInviteModal(false)}
                className="text-[var(--text-lo)] hover:text-[var(--text-hi)] text-lg leading-none"
              >
                &times;
              </button>
            </div>

            {/* Invite Mode Tabs */}
            <div className="flex border-b border-[var(--border)] gap-2 pb-2">
              <button
                onClick={() => setInviteTab("code")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                  inviteTab === "code"
                    ? "bg-[var(--steel-dim)] text-[#BFD4FF]"
                    : "text-[var(--text-mid)] hover:text-[var(--text-hi)]"
                }`}
              >
                By Invite Code
              </button>
              <button
                onClick={() => setInviteTab("email")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                  inviteTab === "email"
                    ? "bg-[var(--steel-dim)] text-[#BFD4FF]"
                    : "text-[var(--text-mid)] hover:text-[var(--text-hi)]"
                }`}
              >
                By Direct Search
              </button>
            </div>

            {/* TAB 1: By Invite Code */}
            {inviteTab === "code" && (
              <div className="space-y-4 pt-1">
                <div className="bg-[var(--bg-2)] border border-[var(--border)] rounded-xl p-4 text-center space-y-3">
                  <div className="text-[11px] text-[var(--text-lo)] uppercase font-semibold tracking-wider">
                    Organization Invite Code
                  </div>
                  <div className="font-mono text-2xl font-bold tracking-widest text-[var(--steel)] bg-[var(--bg-1)] py-2.5 px-4 rounded-lg border border-[var(--border)] inline-block select-all">
                    {loadingCode && !inviteCode ? "Loading..." : inviteCode || "7K2QRXTF"}
                  </div>
                  <div>
                    <button
                      onClick={handleCopy}
                      disabled={!inviteCode}
                      className="px-4 py-1.5 bg-[var(--steel)] text-[#0d1b2a] text-xs font-semibold rounded-lg hover:opacity-90 transition shadow-sm disabled:opacity-50"
                    >
                      {copied ? "✓ Copied to Clipboard!" : "Copy Invite Code"}
                    </button>
                  </div>
                </div>

                <p className="text-[11px] text-[var(--text-mid)] leading-relaxed">
                  Anyone with this code can join <strong className="text-[var(--text-hi)]">{orgName || "this organization"}</strong> as a member using the <em>"Join with code"</em> button.
                </p>

                <div className="flex justify-between items-center pt-2 border-t border-[var(--border)]">
                  <button
                    disabled={regenCodeMutation.isPending}
                    onClick={() => {
                      if (window.confirm("Regenerate invite code? The previous code will stop working immediately.")) {
                        regenCodeMutation.mutate();
                      }
                    }}
                    className="text-xs text-[var(--red)] hover:underline disabled:opacity-50"
                  >
                    {regenCodeMutation.isPending ? "Regenerating..." : "Regenerate code"}
                  </button>
                  <button
                    onClick={() => setShowInviteModal(false)}
                    className="px-4 py-2 text-xs bg-[var(--bg-2)] border border-[var(--border)] hover:bg-[var(--bg-3)] text-[var(--text-hi)] rounded-lg font-medium"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: By Direct Search */}
            {inviteTab === "email" && (
              <div className="space-y-4 pt-1">
                {/* Search user input */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-medium text-[var(--text-mid)]">
                    Search Registered User
                  </label>
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => {
                      setUserSearch(e.target.value);
                      setSelectedUser(null);
                    }}
                    placeholder="Search by @username, email, or name..."
                    autoFocus
                    className="w-full bg-[var(--bg-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs text-[var(--text-hi)] focus:outline-none focus:border-[var(--steel)]"
                  />
                </div>

                {/* Autocomplete Search Results */}
                {!selectedUser && (
                  <div className="border border-[var(--border)] rounded-lg max-h-48 overflow-y-auto divide-y divide-[var(--border)] bg-[var(--bg-2)]">
                    {isSearching ? (
                      <div className="p-3 text-center text-xs text-[var(--text-lo)]">Searching users...</div>
                    ) : searchResults && searchResults.length > 0 ? (
                      searchResults.map((user) => {
                        const alreadyMember = existingUserIds.has(user.id);
                        return (
                          <div
                            key={user.id}
                            onClick={() => {
                              if (!alreadyMember) {
                                setSelectedUser(user);
                                setUserSearch(`@${user.username} (${user.email})`);
                              }
                            }}
                            className={`p-2.5 flex items-center justify-between transition ${
                              alreadyMember
                                ? "opacity-50 cursor-not-allowed bg-[var(--bg-1)]"
                                : "cursor-pointer hover:bg-[var(--bg-3)]"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-6 h-6 rounded-full bg-[var(--steel-dim)] text-[#BFD4FF] text-[10px] font-bold flex items-center justify-center font-display flex-shrink-0">
                                {user.username.slice(0, 2).toUpperCase()}
                              </div>
                              <div className="truncate">
                                <div className="text-xs font-bold text-[var(--text-hi)] flex items-center gap-1.5 truncate">
                                  <span className="text-[var(--steel)]">@{user.username}</span>
                                  {user.full_name && (
                                    <span className="font-normal text-[var(--text-mid)] text-[11px]">({user.full_name})</span>
                                  )}
                                </div>
                                <div className="text-[10px] text-[var(--text-lo)] font-mono truncate">{user.email}</div>
                              </div>
                            </div>

                            <div className="flex-shrink-0 ml-2">
                              {alreadyMember ? (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--bg-3)] text-[var(--text-mid)]">
                                  Joined
                                </span>
                              ) : (
                                <span className="text-[11px] text-[var(--steel)] font-semibold hover:underline">
                                  Select
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-3 text-center text-xs text-[var(--text-lo)]">No matching users found.</div>
                    )}
                  </div>
                )}

                {/* Role Selection */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-medium text-[var(--text-mid)]">Assign Role</label>
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value as typeof selectedRole)}
                    className="w-full bg-[var(--bg-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs text-[var(--text-hi)] focus:outline-none focus:border-[var(--steel)]"
                  >
                    <option value="DEVELOPER">DEVELOPER (Create & move issues)</option>
                    <option value="PROJECT_MANAGER">PROJECT_MANAGER (Manage sprints & projects)</option>
                    <option value="ADMIN">ADMIN (Full organization management)</option>
                    <option value="VIEWER">VIEWER (Read-only access)</option>
                  </select>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
                  <button
                    onClick={() => setShowInviteModal(false)}
                    className="px-4 py-2 text-xs text-[var(--text-mid)] hover:bg-[var(--bg-2)] rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={!selectedUser || addMemberMutation.isPending}
                    onClick={() => addMemberMutation.mutate()}
                    className="px-4 py-2 text-xs bg-[var(--ember)] text-[#20100A] font-semibold rounded-lg disabled:opacity-50 transition"
                  >
                    {addMemberMutation.isPending ? "Adding..." : "Add Member"}
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
