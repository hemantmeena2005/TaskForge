import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import OrgMembersManager from "@/components/OrgMembersManager";
import ProjectMembersManager from "@/components/ProjectMembersManager";

interface Org {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  invite_code?: string | null;
}

interface Project {
  id: string;
  name: string;
  key: string;
  description: string | null;
  is_archived: boolean;
}

export default function OrganizationsPage() {
  const queryClient = useQueryClient();
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgSlug, setNewOrgSlug] = useState("");
  const [creatingOrg, setCreatingOrg] = useState(false);
  const [joiningWithCode, setJoiningWithCode] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [projectOrgId, setProjectOrgId] = useState<string | null>(null);
  const [projName, setProjName] = useState("");
  const [projKey, setProjKey] = useState("");

  const [expandedOrg, setExpandedOrg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"projects" | "members" | "settings">("projects");
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);

  // Deletion confirmation state
  const [orgToDelete, setOrgToDelete] = useState<Org | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<{ id: string; name: string; orgId: string } | null>(null);

  const { data: orgs, isLoading } = useQuery<Org[]>({
    queryKey: ["orgs"],
    queryFn: async () => {
      const res = await api.get("/organizations");
      return res.data;
    },
  });

  const createOrgMut = useMutation({
    mutationFn: async () => {
      setError(null);
      const res = await api.post("/organizations", { name: newOrgName, slug: newOrgSlug });
      return res.data;
    },
    onSuccess: (created) => {
      setNewOrgName("");
      setNewOrgSlug("");
      setCreatingOrg(false);
      queryClient.invalidateQueries({ queryKey: ["orgs"] });
      setExpandedOrg(created.id);
    },
    onError: (err: Error) => setError(err.message),
  });

  const deleteOrgMut = useMutation({
    mutationFn: async (orgId: string) => {
      setError(null);
      await api.delete(`/organizations/${orgId}`);
    },
    onSuccess: () => {
      setOrgToDelete(null);
      setExpandedOrg(null);
      queryClient.invalidateQueries({ queryKey: ["orgs"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (err: Error) => {
      setError(err.message || "Failed to delete organization. Only organization Admins can delete.");
      setOrgToDelete(null);
    },
  });

  const joinOrgMut = useMutation({
    mutationFn: async () => {
      setError(null);
      const res = await api.post("/organizations/join", { code: joinCode.trim().toUpperCase() });
      return res.data;
    },
    onSuccess: (joinedOrg) => {
      setJoinCode("");
      setJoiningWithCode(false);
      queryClient.invalidateQueries({ queryKey: ["orgs"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setExpandedOrg(joinedOrg.id);
    },
    onError: (err: Error) => setError(err.message || "Failed to join organization with code"),
  });

  const createProjMut = useMutation({
    mutationFn: async () => {
      setError(null);
      const res = await api.post(`/organizations/${projectOrgId}/projects`, {
        name: projName,
        key: projKey.toUpperCase(),
      });
      return res.data;
    },
    onSuccess: () => {
      setProjName("");
      setProjKey("");
      setProjectOrgId(null);
      queryClient.invalidateQueries({ queryKey: ["my-projects"] });
      queryClient.invalidateQueries({ queryKey: ["org-projects", expandedOrg] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const deleteProjMut = useMutation({
    mutationFn: async (projectId: string) => {
      setError(null);
      await api.delete(`/projects/${projectId}`);
    },
    onSuccess: () => {
      setProjectToDelete(null);
      queryClient.invalidateQueries({ queryKey: ["my-projects"] });
      queryClient.invalidateQueries({ queryKey: ["org-projects", expandedOrg] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (err: Error) => {
      setError(err.message || "Failed to delete project. Only Admins can delete projects.");
      setProjectToDelete(null);
    },
  });

  const { data: orgProjects, isLoading: loadingProjects } = useQuery<Project[]>({
    queryKey: ["org-projects", expandedOrg],
    queryFn: async () => {
      const res = await api.get(`/organizations/${expandedOrg}/projects`);
      return res.data;
    },
    enabled: !!expandedOrg && activeTab === "projects",
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-bold">Organizations</h1>
          <p className="text-sm text-[var(--text-mid)] mt-1">Workspaces you belong to and manage</p>
        </div>
        
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setJoiningWithCode(true)}
            className="px-3.5 py-2 bg-[var(--bg-2)] border border-[var(--border)] hover:bg-[var(--bg-3)] text-xs font-semibold text-[var(--text-hi)] rounded-lg transition flex items-center gap-1.5 shadow-sm"
          >
            <svg className="w-3.5 h-3.5 text-[var(--steel)]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            Join with code
          </button>
          <button
            onClick={() => setCreatingOrg(true)}
            className="px-3.5 py-2 bg-[var(--ember)] text-[#20100A] text-xs font-semibold rounded-lg hover:opacity-90 transition flex items-center gap-1.5 shadow-sm"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Create organization
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-[var(--red)]/10 border border-[var(--red)]/30 text-[var(--red)] px-4 py-3 rounded-lg text-sm flex justify-between items-center animate-in fade-in">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="font-bold text-base leading-none">&times;</button>
        </div>
      )}

      {/* Join with Code Modal */}
      {joiningWithCode && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-1)] border border-[var(--border)] rounded-xl p-6 w-full max-w-md space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm text-[var(--text-hi)]">Join Workspace with Code</h3>
                <p className="text-[11px] text-[var(--text-mid)] mt-0.5">
                  Enter the 8-character invite code shared by your organization admin
                </p>
              </div>
              <button
                onClick={() => setJoiningWithCode(false)}
                className="text-[var(--text-lo)] hover:text-[var(--text-hi)] text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-medium text-[var(--text-mid)]">Invite Code</label>
              <input
                type="text"
                maxLength={16}
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="e.g. 7K2QRXTF"
                autoFocus
                className="w-full bg-[var(--bg-2)] border border-[var(--steel)] rounded-lg px-3 py-2 text-base font-mono text-center font-bold tracking-widest text-[var(--text-hi)] focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
              <button
                onClick={() => setJoiningWithCode(false)}
                className="px-4 py-2 text-xs text-[var(--text-mid)] hover:bg-[var(--bg-2)] rounded-lg font-medium"
              >
                Cancel
              </button>
              <button
                disabled={joinCode.trim().length < 6 || joinOrgMut.isPending}
                onClick={() => joinOrgMut.mutate()}
                className="px-4 py-2 text-xs bg-[var(--ember)] text-[#20100A] font-semibold rounded-lg disabled:opacity-50 transition"
              >
                {joinOrgMut.isPending ? "Joining..." : "Join Organization"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Org Form */}
      {creatingOrg && (
        <div className="bg-[var(--bg-1)] border border-[var(--border)] rounded-xl p-5 space-y-4 shadow-sm animate-in fade-in">
          <h3 className="font-semibold text-sm text-[var(--text-hi)]">Create New Organization</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] text-[var(--text-mid)] mb-1.5 font-medium">Organization Name</label>
              <input
                type="text"
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                placeholder="Orion Platform"
                autoFocus
                className="w-full bg-[var(--bg-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-hi)] focus:outline-none focus:border-[var(--steel)]"
              />
            </div>
            <div>
              <label className="block text-[11px] text-[var(--text-mid)] mb-1.5 font-medium">Slug (Unique URL identifier)</label>
              <input
                type="text"
                value={newOrgSlug}
                onChange={(e) => setNewOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                placeholder="orion-platform"
                className="w-full bg-[var(--bg-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-hi)] font-mono focus:outline-none focus:border-[var(--steel)]"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setCreatingOrg(false)} className="px-4 py-2 text-sm text-[var(--text-mid)] hover:bg-[var(--bg-2)] rounded-lg">
              Cancel
            </button>
            <button
              disabled={!newOrgName.trim() || !newOrgSlug.trim() || createOrgMut.isPending}
              onClick={() => createOrgMut.mutate()}
              className="px-4 py-2 text-sm bg-[var(--ember)] text-[#20100A] font-semibold rounded-lg disabled:opacity-50 transition"
            >
              {createOrgMut.isPending ? "Creating..." : "Create Organization"}
            </button>
          </div>
        </div>
      )}

      {isLoading && <div className="text-[var(--text-mid)] py-12 text-center text-xs">Loading organizations...</div>}

      {orgs && orgs.length === 0 && !creatingOrg && (
        <div className="text-center py-16 bg-[var(--bg-1)] border border-[var(--border)] rounded-xl space-y-3">
          <div className="text-sm text-[var(--text-hi)] font-semibold">You don&apos;t belong to any organization yet</div>
          <p className="text-xs text-[var(--text-lo)] max-w-sm mx-auto">
            Create a new workspace for your team or join an existing one using an invite code.
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <button
              onClick={() => setJoiningWithCode(true)}
              className="px-3.5 py-2 bg-[var(--bg-2)] border border-[var(--border)] text-xs font-semibold rounded-lg hover:bg-[var(--bg-3)]"
            >
              Join with code
            </button>
            <button
              onClick={() => setCreatingOrg(true)}
              className="px-3.5 py-2 bg-[var(--ember)] text-[#20100A] text-xs font-semibold rounded-lg"
            >
              Create organization
            </button>
          </div>
        </div>
      )}

      {/* Organizations List */}
      <div className="space-y-4">
        {orgs?.map((org) => {
          const isExpanded = expandedOrg === org.id;

          return (
            <div key={org.id} className="bg-[var(--bg-1)] border border-[var(--border)] rounded-xl overflow-hidden transition shadow-sm">
              <div
                className="p-5 flex justify-between items-center cursor-pointer hover:bg-[var(--bg-2)]/60 transition"
                onClick={() => setExpandedOrg(isExpanded ? null : org.id)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[var(--ember-dim)] text-[#FFB79A] text-sm font-bold flex items-center justify-center font-display">
                    {org.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-base text-[var(--text-hi)]">{org.name}</h3>
                      {org.invite_code && (
                        <span className="font-mono text-[10px] text-[var(--steel)] bg-[var(--steel-dim)] px-2 py-0.5 rounded font-bold">
                          Code: {org.invite_code}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--text-lo)] font-mono">/{org.slug}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setProjectOrgId(org.id);
                    }}
                    className="px-3 py-1.5 text-xs font-semibold text-[var(--steel)] hover:bg-[var(--steel-dim)] rounded-lg border border-[var(--steel)]/30 transition flex items-center gap-1"
                  >
                    <span>+</span> Project
                  </button>
                  <span className="text-[var(--text-lo)] text-xs px-2">{isExpanded ? "▲" : "▼"}</span>
                </div>
              </div>

              {/* Organization Expanded Details */}
              {isExpanded && (
                <div className="border-t border-[var(--border)] p-5 bg-[var(--bg-2)]/30 space-y-5">
                  {/* Tabs */}
                  <div className="flex items-center gap-2 border-b border-[var(--border)] pb-2">
                    <button
                      onClick={() => setActiveTab("projects")}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                        activeTab === "projects"
                          ? "bg-[var(--steel-dim)] text-[#BFD4FF]"
                          : "text-[var(--text-mid)] hover:text-[var(--text-hi)]"
                      }`}
                    >
                      Projects
                    </button>
                    <button
                      onClick={() => setActiveTab("members")}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                        activeTab === "members"
                          ? "bg-[var(--steel-dim)] text-[#BFD4FF]"
                          : "text-[var(--text-mid)] hover:text-[var(--text-hi)]"
                      }`}
                    >
                      Members & Invite Code
                    </button>
                    <button
                      onClick={() => setActiveTab("settings")}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                        activeTab === "settings"
                          ? "bg-[var(--red)]/20 text-[var(--red)]"
                          : "text-[var(--text-mid)] hover:text-[var(--red)]"
                      }`}
                    >
                      Danger Zone
                    </button>
                  </div>

                  {/* Projects Tab */}
                  {activeTab === "projects" && (
                    <div className="space-y-4">
                      {loadingProjects ? (
                        <div className="text-xs text-[var(--text-lo)] py-4 text-center">Loading projects...</div>
                      ) : orgProjects && orgProjects.length === 0 ? (
                        <div className="text-xs text-[var(--text-lo)] py-4 text-center">
                          No projects yet in this organization.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {orgProjects?.map((p) => {
                            const isProjectExpanded = expandedProjectId === p.id;
                            return (
                              <div key={p.id} className="bg-[var(--bg-1)] border border-[var(--border)] rounded-lg p-4 space-y-3">
                                <div className="flex justify-between items-center">
                                  <div className="flex items-center gap-2.5">
                                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-[var(--bg-3)] text-[var(--steel)]">
                                      {p.key}
                                    </span>
                                    <span className="font-semibold text-sm text-[var(--text-hi)]">{p.name}</span>
                                    {p.is_archived && (
                                      <span className="text-[10px] px-2 py-0.5 rounded bg-[var(--red)]/10 text-[var(--red)]">
                                        Archived
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => setExpandedProjectId(isProjectExpanded ? null : p.id)}
                                      className="text-xs text-[var(--text-mid)] hover:text-[var(--text-hi)] underline"
                                    >
                                      {isProjectExpanded ? "Hide Team" : "Manage Team"}
                                    </button>
                                    <button
                                      onClick={() => setProjectToDelete({ id: p.id, name: p.name, orgId: org.id })}
                                      className="text-xs text-[var(--red)]/70 hover:text-[var(--red)] hover:bg-[var(--red)]/10 px-2 py-1 rounded transition"
                                      title="Delete project (Admin only)"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </div>

                                {p.description && (
                                  <p className="text-xs text-[var(--text-mid)]">{p.description}</p>
                                )}

                                {/* Project Team Subsection */}
                                {isProjectExpanded && (
                                  <div className="border-t border-[var(--border)] pt-3">
                                    <ProjectMembersManager projectId={p.id} orgId={org.id} />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Members Tab */}
                  {activeTab === "members" && (
                    <OrgMembersManager
                      orgId={org.id}
                      orgName={org.name}
                      initialInviteCode={org.invite_code}
                    />
                  )}

                  {/* Danger Zone Tab */}
                  {activeTab === "settings" && (
                    <div className="p-4 rounded-lg bg-[var(--red)]/5 border border-[var(--red)]/20 space-y-3">
                      <h4 className="text-xs font-bold text-[var(--red)] uppercase tracking-wider">
                        Delete Organization Workspace
                      </h4>
                      <p className="text-xs text-[var(--text-mid)]">
                        Permanently delete this organization, including all projects, issues, sprints, and invite codes.
                        This action cannot be undone. Only organization Admins can perform this action.
                      </p>
                      <button
                        onClick={() => setOrgToDelete(org)}
                        className="px-3.5 py-2 bg-[var(--red)]/10 border border-[var(--red)]/30 hover:bg-[var(--red)] hover:text-white text-xs font-semibold text-[var(--red)] rounded-lg transition"
                      >
                        Delete &quot;{org.name}&quot;
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Delete Org Confirmation Modal */}
      {orgToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-1)] border border-[var(--border)] rounded-xl p-6 w-full max-w-md space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <h3 className="font-bold text-sm text-[var(--red)]">Delete Organization</h3>
            <p className="text-xs text-[var(--text-mid)]">
              Are you sure you want to delete <strong className="text-[var(--text-hi)]">&quot;{orgToDelete.name}&quot;</strong>? All associated projects, sprints, and tasks will be permanently removed.
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
              <button
                onClick={() => setOrgToDelete(null)}
                className="px-4 py-2 text-xs text-[var(--text-mid)] hover:bg-[var(--bg-2)] rounded-lg font-medium"
              >
                Cancel
              </button>
              <button
                disabled={deleteOrgMut.isPending}
                onClick={() => deleteOrgMut.mutate(orgToDelete.id)}
                className="px-4 py-2 text-xs bg-[var(--red)] text-white font-semibold rounded-lg disabled:opacity-50 transition"
              >
                {deleteOrgMut.isPending ? "Deleting..." : "Permanently Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Project Confirmation Modal */}
      {projectToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-1)] border border-[var(--border)] rounded-xl p-6 w-full max-w-md space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <h3 className="font-bold text-sm text-[var(--red)]">Delete Project</h3>
            <p className="text-xs text-[var(--text-mid)]">
              Are you sure you want to delete <strong className="text-[var(--text-hi)]">&quot;{projectToDelete.name}&quot;</strong>? All issues, sprints, and comments within this project will be deleted.
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
              <button
                onClick={() => setProjectToDelete(null)}
                className="px-4 py-2 text-xs text-[var(--text-mid)] hover:bg-[var(--bg-2)] rounded-lg font-medium"
              >
                Cancel
              </button>
              <button
                disabled={deleteProjMut.isPending}
                onClick={() => deleteProjMut.mutate(projectToDelete.id)}
                className="px-4 py-2 text-xs bg-[var(--red)] text-white font-semibold rounded-lg disabled:opacity-50 transition"
              >
                {deleteProjMut.isPending ? "Deleting..." : "Permanently Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Project Modal */}
      {projectOrgId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-1)] border border-[var(--border)] rounded-xl p-6 w-full max-w-md space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <h3 className="font-semibold text-sm text-[var(--text-hi)]">Create Project</h3>
            <div>
              <label className="block text-[11px] text-[var(--text-mid)] mb-1.5 font-medium">Project Name</label>
              <input
                type="text"
                value={projName}
                onChange={(e) => setProjName(e.target.value)}
                className="w-full bg-[var(--bg-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-hi)] focus:outline-none focus:border-[var(--steel)]"
                placeholder="Frontend Core"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-[11px] text-[var(--text-mid)] mb-1.5 font-medium">Project Key (Prefix for issues)</label>
              <input
                type="text"
                maxLength={10}
                value={projKey}
                onChange={(e) => setProjKey(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                className="w-full bg-[var(--bg-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-hi)] font-mono focus:outline-none focus:border-[var(--steel)]"
                placeholder="FC"
              />
              <p className="text-[10px] text-[var(--text-lo)] mt-1">2–10 uppercase letters/numbers (e.g. TF, PROJ)</p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setProjectOrgId(null)}
                className="px-4 py-2 text-sm text-[var(--text-mid)] hover:bg-[var(--bg-2)] rounded-lg"
              >
                Cancel
              </button>
              <button
                disabled={projName.length < 2 || projKey.length < 2 || createProjMut.isPending}
                onClick={() => createProjMut.mutate()}
                className="px-4 py-2 text-sm bg-[var(--ember)] text-[#20100A] font-semibold rounded-lg disabled:opacity-50 transition"
              >
                {createProjMut.isPending ? "Creating..." : "Create Project"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
