import { useState } from "react";
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const displayName = user?.full_name || user?.username || "User";
  const initials = displayName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  function handleLogout() {
    logout();
    setTokens("", "");
    window.location.href = "/login";
  }

  return (
    <div className="flex min-h-screen bg-[var(--bg-0)] text-[var(--text-hi)]">
      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm animate-in fade-in duration-200"
        />
      )}

      {/* Sidebar (Desktop fixed, Mobile sliding drawer) */}
      <aside
        className={`fixed md:sticky top-0 h-screen w-64 md:w-56 bg-[var(--bg-1)] border-r border-[var(--border)] flex flex-col p-4 gap-6 z-50 transition-transform duration-200 ease-in-out ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="flex items-center justify-between px-1">
          <Link
            to="/"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-2"
          >
            <div className="w-7 h-7 rounded-md bg-gradient-to-br from-[var(--ember)] to-[#C9401A] flex items-center justify-center text-xs font-bold text-[#1a0d05] font-display shadow-md">
              TF
            </div>
            <span className="font-display font-bold text-base text-[var(--text-hi)]">TaskForge</span>
          </Link>

          {/* Close button on mobile */}
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="md:hidden p-1.5 text-[var(--text-mid)] hover:text-[var(--text-hi)] hover:bg-[var(--bg-2)] rounded-lg transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav className="flex flex-col gap-1 flex-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition font-medium ${
                  isActive
                    ? "bg-[var(--ember-dim)] text-[#FFB79A]"
                    : "text-[var(--text-mid)] hover:bg-[var(--bg-2)] hover:text-[var(--text-hi)]"
                }`}
              >
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d={item.icon} />
                </svg>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-[var(--border)] pt-4">
          <div className="flex items-center gap-2.5 px-1">
            <div className="w-8 h-8 rounded-full bg-[var(--steel-dim)] text-[#BFD4FF] text-xs font-semibold flex items-center justify-center font-display flex-shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold truncate text-[var(--text-hi)]">{displayName}</div>
              <button onClick={handleLogout} className="text-[11px] text-[var(--text-lo)] hover:text-[var(--red)] transition block text-left">
                Sign out
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0 overflow-x-hidden">
        {/* Top Header */}
        <header className="h-14 border-b border-[var(--border)] flex items-center justify-between px-3 sm:px-6 gap-2 bg-[var(--bg-1)]/40 backdrop-blur-md sticky top-0 z-30">
          <div className="flex items-center gap-2">
            {/* Mobile Hamburger Toggle Button */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-1.5 text-[var(--text-mid)] hover:text-[var(--text-hi)] hover:bg-[var(--bg-2)] rounded-lg transition"
              aria-label="Open Navigation Menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <div className="text-xs sm:text-sm text-[var(--text-mid)] truncate">
              <span className="hidden sm:inline">TaskForge <span className="text-[var(--text-lo)]">/</span> </span>
              <span className="text-[var(--text-hi)] font-semibold">
                {navItems.find((n) => n.to === location.pathname)?.label || "Home"}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <NotificationCenter />
          </div>
        </header>

        {/* Dynamic Page Outlet */}
        <div className="flex-1 p-3 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto overflow-x-auto">
          <Outlet />
        </div>

        {/* Mobile Bottom Icon Bar */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 h-14 bg-[var(--bg-1)]/95 border-t border-[var(--border)] backdrop-blur-md z-30 flex items-center justify-around px-2">
          {navItems.slice(0, 5).map((item) => {
            const isActive = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex flex-col items-center justify-center p-1.5 rounded-lg transition ${
                  isActive ? "text-[var(--ember)]" : "text-[var(--text-lo)] hover:text-[var(--text-mid)]"
                }`}
                title={item.label}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d={item.icon} />
                </svg>
                <span className="text-[9px] font-medium tracking-tight mt-0.5">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </main>

      {/* Global Live Toast Notification Popups */}
      <NotificationToastProvider />
    </div>
  );
}
