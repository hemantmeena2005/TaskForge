import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "@/lib/auth";
import NotificationCenter from "@/components/NotificationCenter";
import NotificationToastProvider from "@/components/NotificationToastProvider";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: "M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z" },
  { to: "/organizations", label: "Organizations", icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" },
  { to: "/board", label: "Board", icon: "M3 4h18v16H3zM3 9h18M8 4v5" },
  { to: "/backlog", label: "Backlog", icon: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" },
  { to: "/sprints", label: "Sprints", icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" },
  { to: "/audit", label: "Audit Logs", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
];

export default function Layout() {
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const setTokens = useAuthStore((s) => s.setTokens);

  const displayName = user?.full_name || user?.username || "User";
  const initials = displayName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  function handleLogout() {
    logout();
    setTokens("", "");
    window.location.href = "/login";
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 bg-[var(--bg-1)] border-r border-[var(--border)] flex flex-col p-4 gap-6">
        <Link to="/" className="flex items-center gap-2 px-1">
          <div className="w-7 h-7 rounded-md bg-gradient-to-br from-[var(--ember)] to-[#C9401A] flex items-center justify-center text-xs font-bold text-[#1a0d05] font-display">
            TF
          </div>
          <span className="font-display font-bold text-[var(--text-hi)]">TaskForge</span>
        </Link>

        <nav className="flex flex-col gap-1">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition ${
                location.pathname === item.to
                  ? "bg-[var(--ember-dim)] text-[#FFB79A]"
                  : "text-[var(--text-mid)] hover:bg-[var(--bg-2)] hover:text-[var(--text-hi)]"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d={item.icon} />
              </svg>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="mt-auto border-t border-[var(--border)] pt-4">
          <div className="flex items-center gap-2.5 px-1">
            <div className="w-8 h-8 rounded-full bg-[var(--steel-dim)] text-[#BFD4FF] text-xs font-semibold flex items-center justify-center font-display">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{displayName}</div>
              <button onClick={handleLogout} className="text-xs text-[var(--text-lo)] hover:text-[var(--red)] transition">
                Logout
              </button>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-[var(--border)] flex items-center justify-between px-6 gap-4 bg-[var(--bg-1)]/30 backdrop-blur-sm">
          <div className="text-sm text-[var(--text-mid)]">
            TaskForge <span className="text-[var(--text-lo)]">/</span>{" "}
            <span className="text-[var(--text-hi)] font-medium">
              {navItems.find((n) => n.to === location.pathname)?.label || "Home"}
            </span>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="w-64 relative">
              <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-lo)]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
              </svg>
              <input
                type="text"
                placeholder="Search issues..."
                className="w-full bg-[var(--bg-2)] border border-[var(--border)] rounded-lg py-1.5 pl-9 pr-3 text-xs text-[var(--text-hi)] placeholder:text-[var(--text-lo)] focus:outline-none focus:border-[var(--steel)]"
              />
            </div>

            <NotificationCenter />
          </div>
        </header>

        <div className="flex-1 p-6 overflow-auto">
          <Outlet />
        </div>
      </main>

      {/* Global Real-Time Toast Notification Popups */}
      <NotificationToastProvider />
    </div>
  );
}
