export function Spinner({ size = "md", label }: { size?: "sm" | "md" | "lg"; label?: string }) {
  const sizeClasses = {
    sm: "w-4 h-4 border-2",
    md: "w-7 h-7 border-[2.5px]",
    lg: "w-10 h-10 border-3",
  }[size];

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-8 animate-in fade-in duration-200">
      <div
        className={`${sizeClasses} border-[var(--steel)]/20 border-t-[var(--steel)] rounded-full animate-spin`}
      />
      {label && <span className="text-xs font-medium text-[var(--text-mid)] font-mono tracking-wide animate-pulse">{label}</span>}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="w-36 h-6 bg-[var(--bg-3)] rounded-lg" />
          <div className="w-56 h-4 bg-[var(--bg-3)] rounded" />
        </div>
        <div className="w-48 h-9 bg-[var(--bg-3)] rounded-lg" />
      </div>

      {/* 4 Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-[var(--bg-1)] border border-[var(--border)] rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-20 h-3 bg-[var(--bg-3)] rounded" />
              <div className="w-6 h-6 bg-[var(--bg-3)] rounded-lg" />
            </div>
            <div className="w-12 h-7 bg-[var(--bg-3)] rounded-lg" />
          </div>
        ))}
      </div>

      {/* Active Sprint Banner */}
      <div className="bg-[var(--bg-1)] border border-[var(--border)] rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="w-32 h-5 bg-[var(--bg-3)] rounded-md" />
          <div className="w-12 h-4 bg-[var(--bg-3)] rounded" />
        </div>
        <div className="w-full h-2.5 bg-[var(--bg-3)] rounded-full" />
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-[var(--bg-2)] p-3 rounded-lg flex flex-col items-center gap-1.5">
              <div className="w-16 h-3 bg-[var(--bg-3)] rounded" />
              <div className="w-8 h-5 bg-[var(--bg-3)] rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* Two-column Bottom Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[var(--bg-1)] border border-[var(--border)] rounded-xl p-5 space-y-3">
          <div className="w-36 h-4 bg-[var(--bg-3)] rounded mb-4" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 bg-[var(--bg-2)] rounded-lg w-full" />
          ))}
        </div>
        <div className="bg-[var(--bg-1)] border border-[var(--border)] rounded-xl p-5 space-y-3">
          <div className="w-36 h-4 bg-[var(--bg-3)] rounded mb-4" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 bg-[var(--bg-2)] rounded-lg w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function BoardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="w-32 h-6 bg-[var(--bg-3)] rounded-lg" />
          <div className="w-64 h-4 bg-[var(--bg-3)] rounded" />
        </div>
        <div className="flex items-center gap-2">
          <div className="w-44 h-9 bg-[var(--bg-3)] rounded-lg" />
          <div className="w-28 h-9 bg-[var(--bg-3)] rounded-lg" />
        </div>
      </div>

      {/* 4 Kanban Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
        {[1, 2, 3, 4].map((col) => (
          <div key={col} className="bg-[var(--bg-1)] border border-[var(--border)] rounded-xl p-3.5 space-y-3 min-h-[400px]">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
              <div className="w-20 h-4 bg-[var(--bg-3)] rounded" />
              <div className="w-6 h-4 bg-[var(--bg-3)] rounded-full" />
            </div>
            <div className="space-y-2.5">
              {[1, 2, 3].map((card) => (
                <div key={card} className="bg-[var(--bg-2)] border border-[var(--border)] rounded-lg p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="w-16 h-3.5 bg-[var(--bg-3)] rounded" />
                    <div className="w-10 h-3.5 bg-[var(--bg-3)] rounded-full" />
                  </div>
                  <div className="w-full h-4 bg-[var(--bg-3)] rounded" />
                  <div className="flex items-center justify-between pt-1">
                    <div className="w-12 h-3 bg-[var(--bg-3)] rounded" />
                    <div className="w-5 h-5 bg-[var(--bg-3)] rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function OrgSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="w-40 h-6 bg-[var(--bg-3)] rounded-lg" />
          <div className="w-72 h-4 bg-[var(--bg-3)] rounded" />
        </div>
        <div className="w-44 h-9 bg-[var(--bg-3)] rounded-lg" />
      </div>

      {/* Organization Cards */}
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <div key={i} className="bg-[var(--bg-1)] border border-[var(--border)] rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[var(--bg-3)] rounded-lg" />
                <div className="space-y-1.5">
                  <div className="w-36 h-5 bg-[var(--bg-3)] rounded" />
                  <div className="w-24 h-3 bg-[var(--bg-3)] rounded" />
                </div>
              </div>
              <div className="w-20 h-7 bg-[var(--bg-3)] rounded-lg" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-[var(--border)]">
              {[1, 2, 3].map((j) => (
                <div key={j} className="h-16 bg-[var(--bg-2)] rounded-lg" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SprintSkeleton() {
  return (
    <div className="bg-[var(--bg-1)] border border-[var(--border)] rounded-xl p-6 space-y-5 animate-pulse shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-20 h-5 bg-[var(--bg-3)] rounded-full" />
          <div className="w-40 h-6 bg-[var(--bg-3)] rounded-lg" />
        </div>
        <div className="w-28 h-8 bg-[var(--bg-3)] rounded-lg" />
      </div>

      <div className="space-y-2">
        <div className="flex justify-between">
          <div className="w-24 h-3 bg-[var(--bg-3)] rounded" />
          <div className="w-12 h-3 bg-[var(--bg-3)] rounded" />
        </div>
        <div className="w-full h-2 bg-[var(--bg-3)] rounded-full" />
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-[var(--bg-2)] p-4 rounded-lg flex flex-col items-center gap-2">
            <div className="w-16 h-3 bg-[var(--bg-3)] rounded" />
            <div className="w-10 h-6 bg-[var(--bg-3)] rounded" />
          </div>
        ))}
      </div>

      <div className="space-y-2 pt-2 border-t border-[var(--border)]">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-11 bg-[var(--bg-2)] rounded-lg w-full" />
        ))}
      </div>
    </div>
  );
}

export function IssueRowSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="divide-y divide-[var(--border)] border border-[var(--border)] rounded-xl bg-[var(--bg-1)] overflow-hidden animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="p-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1">
            <div className="w-12 h-4 bg-[var(--bg-3)] rounded" />
            <div className="w-16 h-4 bg-[var(--bg-3)] rounded" />
            <div className="w-48 h-4 bg-[var(--bg-3)] rounded" />
          </div>
          <div className="flex items-center gap-2">
            <div className="w-16 h-5 bg-[var(--bg-3)] rounded-full" />
            <div className="w-14 h-5 bg-[var(--bg-3)] rounded-full" />
            <div className="w-6 h-6 bg-[var(--bg-3)] rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
