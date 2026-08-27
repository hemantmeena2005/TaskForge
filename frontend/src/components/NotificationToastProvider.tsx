import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { useAuthStore } from "@/lib/auth";

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

interface ToastItem {
  id: string;
  notificationId: string;
  type: string;
  title: string;
  message: string;
  createdAt: string;
}

const TYPE_CONFIG: Record<
  string,
  { label: string; bg: string; color: string; border: string; icon: string }
> = {
  ISSUE_ASSIGNED: {
    label: "Assigned to You",
    bg: "rgba(30, 58, 138, 0.4)",
    color: "#BFD4FF",
    border: "rgba(191, 212, 255, 0.3)",
    icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
  },
  ISSUE_STATUS_CHANGED: {
    label: "Status Updated",
    bg: "rgba(18, 42, 31, 0.6)",
    color: "#8FE3B9",
    border: "rgba(143, 227, 185, 0.3)",
    icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4",
  },
  COMMENT_ADDED: {
    label: "New Comment",
    bg: "rgba(58, 42, 16, 0.6)",
    color: "#F0C97D",
    border: "rgba(240, 201, 125, 0.3)",
    icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
  },
  SPRINT_STARTED: {
    label: "Sprint Started",
    bg: "rgba(74, 16, 16, 0.4)",
    color: "#FFB79A",
    border: "rgba(255, 183, 154, 0.3)",
    icon: "M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  SPRINT_COMPLETED: {
    label: "Sprint Completed",
    bg: "rgba(18, 42, 31, 0.6)",
    color: "#8FE3B9",
    border: "rgba(143, 227, 185, 0.3)",
    icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  MEMBER_ADDED: {
    label: "Team Update",
    bg: "rgba(30, 58, 138, 0.4)",
    color: "#BFD4FF",
    border: "rgba(191, 212, 255, 0.3)",
    icon: "M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z",
  },
};

export default function NotificationToastProvider() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const seenNotificationIds = useRef<Set<string>>(new Set());
  const initialLoadDone = useRef(false);
  const accessToken = useAuthStore((s) => s.accessToken);

  // Poll for latest notifications every 6 seconds
  const { data: latestNotifications } = useQuery<NotificationItem[]>({
    queryKey: ["poll-notifications-toast"],
    queryFn: async () => {
      const res = await api.get("/notifications?limit=10");
      return res.data;
    },
    enabled: Boolean(accessToken),
    refetchInterval: 6_000,
    refetchIntervalInBackground: true,
  });

  useEffect(() => {
    if (!latestNotifications) return;

    if (!initialLoadDone.current) {
      // First load: seed seen IDs so we don't spam toasts for old history
      latestNotifications.forEach((n) => seenNotificationIds.current.add(n.id));
      initialLoadDone.current = true;
      return;
    }

    // Identify newly arrived unread notifications
    const newItems = latestNotifications.filter(
      (n) => !n.is_read && !seenNotificationIds.current.has(n.id)
    );

    if (newItems.length > 0) {
      newItems.forEach((n) => {
        seenNotificationIds.current.add(n.id);
        const toastId = `${n.id}-${Date.now()}`;
        
        setToasts((prev) => [
          ...prev.slice(-3), // Keep max 4 active toasts on screen
          {
            id: toastId,
            notificationId: n.id,
            type: n.type,
            title: n.title,
            message: n.message,
            createdAt: n.created_at,
          },
        ]);

        // Auto dismiss after 6 seconds
        setTimeout(() => {
          removeToast(toastId);
        }, 6000);
      });
    }
  }, [latestNotifications]);

  function removeToast(toastId: string) {
    setToasts((prev) => prev.filter((t) => t.id !== toastId));
  }

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 space-y-3 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        const config = (TYPE_CONFIG[toast.type] ?? {
          label: "Notification",
          bg: "rgba(20, 20, 20, 0.8)",
          color: "var(--text-hi)",
          border: "var(--border)",
          icon: "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9",
        })!;

        return (
          <div
            key={toast.id}
            className="pointer-events-auto bg-[var(--bg-1)]/95 backdrop-blur-md border border-[var(--border)] rounded-xl p-4 shadow-2xl transition-all animate-in slide-in-from-bottom-5 duration-200 overflow-hidden relative group hover:border-[var(--text-lo)]"
            style={{ borderColor: config.border }}
          >
            {/* Top Accent Pill */}
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-1.5">
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: config.bg, color: config.color }}
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path d={config.icon} />
                  </svg>
                </div>
                <span
                  className="text-[10px] font-bold uppercase tracking-wider font-mono"
                  style={{ color: config.color }}
                >
                  {config.label}
                </span>
              </div>

              <button
                onClick={() => removeToast(toast.id)}
                className="text-[var(--text-lo)] hover:text-[var(--text-hi)] text-sm leading-none p-1 transition"
                title="Dismiss"
              >
                &times;
              </button>
            </div>

            {/* Content */}
            <div className="space-y-0.5 pr-2">
              <h4 className="text-xs font-semibold text-[var(--text-hi)] leading-snug">
                {toast.title}
              </h4>
              <p className="text-[11px] text-[var(--text-mid)] leading-relaxed line-clamp-2">
                {toast.message}
              </p>
            </div>

            {/* Subtle Progress Bar */}
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--bg-3)] overflow-hidden">
              <div
                className="h-full animate-[shrink_6s_linear_forwards]"
                style={{ background: config.color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
