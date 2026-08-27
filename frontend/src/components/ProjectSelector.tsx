import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { useProjectStore, type MyProject } from "@/lib/projectStore";

export default function ProjectSelector({
  onSelect,
}: {
  onSelect?: (project: MyProject | null) => void;
}) {
  const selectedProjectId = useProjectStore((s) => s.selectedProjectId);
  const setSelectedProjectId = useProjectStore((s) => s.setSelectedProjectId);

  const { data: projects, isLoading, error } = useQuery<MyProject[]>({
    queryKey: ["my-projects"],
    queryFn: async () => {
      const res = await api.get("/dashboard/projects");
      return res.data;
    },
  });

  const selected = projects?.find((p) => p.id === selectedProjectId) || null;

  // Auto-select first project when none selected
  useEffect(() => {
    if (projects && projects.length > 0 && !selected) {
      const first = projects[0];
      if (first) {
        setSelectedProjectId(first.id);
      }
    }
  }, [projects, selected, setSelectedProjectId]);

  useEffect(() => {
    onSelect?.(selected);
  }, [selected, onSelect]);

  if (isLoading) {
    return (
      <div className="text-sm text-gray-500">Loading projects...</div>
    );
  }

  if (error || !projects) {
    return (
      <div className="text-sm text-red-600">
        Failed to load projects. Create one to get started.
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="text-sm text-gray-500">
        No projects yet. Create a project to begin.
      </div>
    );
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-[var(--text-mid)] font-medium">Project:</span>
      <select
        value={selected?.id || ""}
        onChange={(e) => setSelectedProjectId(e.target.value || null)}
        className="px-3 py-1.5 bg-[var(--bg-2)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-hi)] focus:outline-none focus:border-[var(--steel)]"
      >
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} ({p.key})
          </option>
        ))}
      </select>
    </label>
  );
}
