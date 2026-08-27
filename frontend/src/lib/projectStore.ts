import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface MyProject {
  id: string;
  name: string;
  key: string;
  description: string | null;
  is_archived: boolean;
}

interface ProjectState {
  selectedProjectId: string | null;
  setSelectedProjectId: (id: string | null) => void;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => ({
      selectedProjectId: null,
      setSelectedProjectId: (id) => set({ selectedProjectId: id }),
    }),
    { name: "taskforge-project" }
  )
);
