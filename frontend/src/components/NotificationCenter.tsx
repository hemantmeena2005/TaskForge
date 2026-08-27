import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  reference_type: string | null;
  reference_id: string | null;
  is_read: boolean;
  created_at: string;
}

const TYPE_ICONS: Record<string, { icon: string; color: string; bg: string }> = {
  ISSUE_ASSIGNED: {
    icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
    color: "#BFD4FF",
    bg: "var(--steel-dim)",
  },
  ISSUE_STATUS_CHANGED: {
    icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4",
    color: "#8FE3B9",
    bg: "var(--teal-dim)",
  },
  ISSUE_PRIORITY_CHANGED: {
    icon: "M13 10V3L4 14h7v7l9-11h-7z",
    color: "#F0C97D",
    bg: "var(--amber-dim)",
  },
  SPRINT_STARTED: {
    icon: "M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    color: "#FFB79A",
    bg: "var(--ember-dim)",
  },
  SPRINT_COMPLETED: {
    icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
    color: "#8FE3B9",
    bg: "var(--teal-dim)",
  },
  MEMBER_ADDED: {
    icon: "M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z",
    color: "#BFD4FF",
    bg: "var(--steel-dim)",
  },
};

function formatRelative(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function NotificationCenter() {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Unread count
  const { data: countData } = useQuery<{ unread_count: number }>({
    queryKey: ["unread-notifications-count"],
    queryFn: async () => {
      const res = await api.get("/notifications/unread-count");
      return res.data;
    },
    refetchInterval: 15_000,
  });

  // Notifications list (fetched when opened or cached)
  const { data: notifications, isLoading } = useQuery<NotificationItem[]>({
    queryKey: ["notifications"],
    queryFn: async () => {
      const res = await api.get("/notifications?limit=25");
      return res.data;
    },
    enabled: isOpen,
  });

  // Mark single as read
  const markReadMutation = useMutation({
    mutationFn: async ({ id, isRead }: { id: string; isRead: boolean }) => {
      const res = await api.patch(`/notifications/${id}/read`, { is_read: isRead });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unread-notifications-count"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  // Mark all as read
  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post("/notifications/mark-all-read");
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unread-notifications-count"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const unreadCount = countData?.unread_count || 0;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        title="Notifications"
        className="relative p-2 text-[var(--text-mid)] hover:text-[var(--text-hi)] hover:bg-[var(--bg-2)] rounded-lg transition"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>

        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-[var(--ember)] text-[#1a0d05] text-[9px] font-bold rounded-full flex items-center justify-center font-display shadow-sm animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Popover */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-84 sm:w-96 bg-[var(--bg-1)] border border-[var(--border)] rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between bg-[var(--bg-2)]/40">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-xs text-[var(--text-hi)]">Notifications</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 text-[9px] font-bold bg-[var(--ember-dim)] text-[#FFB79A] rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                disabled={markAllReadMutation.isPending}
                onClick={() => markAllReadMutation.mutate()}
                className="text-[11px] text-[var(--steel)] hover:underline disabled:opacity-50"
              >
                Mark all as read
              </button>
            )}
          </div>

          <div className="max-h-[380px] overflow-y-auto divide-y divide-[var(--border)]">
            {isLoading ? (
              <div className="text-xs text-[var(--text-lo)] py-8 text-center">Loading notifications...</div>
            ) : notifications && notifications.length > 0 ? (
              notifications.map((n) => {
                const conf = (TYPE_ICONS[n.type] ?? TYPE_ICONS.ISSUE_ASSIGNED)!;
                return (
                  <div
                    key={n.id}
                    onClick={() => {
                      if (!n.is_read) {
                        markReadMutation.mutate({ id: n.id, isRead: true });
                      }
                    }}
                    className={`p-3.5 flex gap-3 items-start transition cursor-pointer hover:bg-[var(--bg-2)] ${
                      !n.is_read ? "bg-[var(--bg-2)]/50" : ""
                    }`}
                  >
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: conf.bg, color: conf.color }}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d={conf.icon} />
                      </svg>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className="text-xs font-semibold text-[var(--text-hi)] truncate">
                          {n.title}
                        </span>
                        <span className="text-[10px] text-[var(--text-lo)] whitespace-nowrap">
                          {formatRelative(n.created_at)}
                        </span>
                      </div>
                      <p className="text-[11px] text-[var(--text-mid)] leading-snug line-clamp-2">
                        {n.message}
                      </p>
                    </div>

                    {!n.is_read && (
                      <div className="w-2 h-2 rounded-full bg-[var(--ember)] flex-shrink-0 self-center" />
                    )}
                  </div>
                );
              })
            ) : (
              <div className="text-xs text-[var(--text-lo)] py-10 text-center">
                You're all caught up! No notifications.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
