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
