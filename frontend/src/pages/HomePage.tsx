import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/lib/auth";

export default function HomePage() {
  const navigate = useNavigate();
  const { user, accessToken, logout } = useAuthStore();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Animated counters
  const [issuesCount, setIssuesCount] = useState(0);
  const [teamsCount, setTeamsCount] = useState(0);
  const [uptimeCount, setUptimeCount] = useState(0);
  const [fasterCount, setFasterCount] = useState(0);
  const statsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Intersection observer for counters
  useEffect(() => {
    let started = false;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !started) {
            started = true;
            const duration = 1500;
            const start = performance.now();

            function animate(now: number) {
              const elapsed = now - start;
              const progress = Math.min(elapsed / duration, 1);
              const ease = 1 - Math.pow(1 - progress, 3); // cubic ease out

              setIssuesCount(Math.floor(ease * 12400));
              setTeamsCount(Math.floor(ease * 640));
              setUptimeCount(Math.floor(ease * 99));
              setFasterCount(Math.floor(ease * 35));

              if (progress < 1) {
                requestAnimationFrame(animate);
              }
            }
            requestAnimationFrame(animate);
          }
        });
      },
      { threshold: 0.3 }
    );

    if (statsRef.current) {
      observer.observe(statsRef.current);
    }
    return () => observer.disconnect();
  }, []);

  const companies = [
    "Stripe",
    "Vercel",
    "Supabase",
    "Linear",
    "Airbnb",
    "GitHub",
    "Cloudflare",
    "OpenAI",
    "Shopify",
    "PostHog",
  ];

  return (
    <div className="min-h-screen bg-[#101116] text-[#EDEEF3] font-sans antialiased overflow-x-hidden selection:bg-[var(--ember)] selection:text-[#101116]">
      {/* ===== HEADER / NAV ===== */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-[#101116]/80 border-b border-[#2A2D3A]">
        <div className="max-w-[1180px] mx-auto px-6">
          <nav className="flex items-center justify-between py-4">
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#FF6A39] to-[#C9401A] flex items-center justify-center font-display font-bold text-xs text-[#1a0d05] shadow-lg shadow-[#FF6A39]/20 group-hover:scale-105 transition-transform">
                TF
              </div>
              <span className="font-display font-bold text-base tracking-tight text-[#EDEEF3]">
                TaskForge
              </span>
            </Link>

            <div className="hidden md:flex items-center gap-7 text-xs font-medium text-[#9A9CAA]">
              <a href="#features" className="hover:text-[#EDEEF3] transition-colors">Features</a>
              <a href="#tour" className="hover:text-[#EDEEF3] transition-colors">Product tour</a>
              <a href="#how" className="hover:text-[#EDEEF3] transition-colors">How it works</a>
              <a href="#testimonials" className="hover:text-[#EDEEF3] transition-colors">Testimonials</a>
              <a href="#pricing" className="hover:text-[#EDEEF3] transition-colors">Pricing</a>
            </div>

            <div className="flex items-center gap-3">
              {accessToken && user ? (
                <div className="relative" ref={userMenuRef}>
                  <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-[#1E212C] border border-[#2A2D3A] hover:border-[#5F6272] transition"
                  >
                    <div className="w-6 h-6 rounded-full bg-[#1E2A40] text-[#BFD4FF] text-[10px] font-bold flex items-center justify-center font-display">
                      {user.username.slice(0, 2).toUpperCase()}
                    </div>
                    <span className="text-xs font-medium text-[#EDEEF3]">{user.full_name || user.username}</span>
                    <svg className="w-3 h-3 text-[#9A9CAA]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>

                  {showUserMenu && (
                    <div className="absolute top-11 right-0 w-48 bg-[#171923] border border-[#2A2D3A] rounded-xl p-1.5 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150">
                      <button
                        onClick={() => navigate("/dashboard")}
                        className="w-full text-left px-3 py-2 text-xs font-medium text-[#9A9CAA] hover:text-[#EDEEF3] hover:bg-[#1E212C] rounded-lg transition flex items-center gap-2.5"
                      >
                        <svg className="w-3.5 h-3.5 text-[#5B8DEF]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" />
                        </svg>
                        Go to dashboard
                      </button>
                      <button
                        onClick={() => navigate("/organizations")}
                        className="w-full text-left px-3 py-2 text-xs font-medium text-[#9A9CAA] hover:text-[#EDEEF3] hover:bg-[#1E212C] rounded-lg transition flex items-center gap-2.5"
                      >
                        <svg className="w-3.5 h-3.5 text-[#FF6A39]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" />
                        </svg>
                        Organizations
                      </button>
                      <div className="h-[1px] bg-[#2A2D3A] my-1" />
                      <button
                        onClick={() => {
                          logout();
                          setShowUserMenu(false);
                        }}
                        className="w-full text-left px-3 py-2 text-xs font-medium text-[#F2A7A7] hover:bg-[#3A1414] rounded-lg transition flex items-center gap-2.5"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
                        </svg>
                        Log out
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="text-xs font-semibold px-3 py-2 text-[#9A9CAA] hover:text-[#EDEEF3] hover:bg-[#1E212C] rounded-lg transition"
                  >
                    Log in
                  </Link>
                  <Link
                    to="/register"
                    className="text-xs font-semibold px-4 py-2 bg-[#FF6A39] text-[#20100A] hover:bg-[#FF7E52] rounded-lg transition shadow-md shadow-[#FF6A39]/20"
                  >
                    Get started free
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>
      </header>

      {/* ===== HERO ===== */}
      <section className="relative pt-24 pb-20 overflow-hidden">
        {/* Glow ambient background */}
        <div className="absolute -top-40 -left-20 w-[500px] h-[500px] bg-[#FF6A39] opacity-20 blur-[120px] pointer-events-none rounded-full animate-pulse" />
        <div className="absolute top-10 -right-20 w-[450px] h-[450px] bg-[#5B8DEF] opacity-20 blur-[120px] pointer-events-none rounded-full" />

        <div className="max-w-[1180px] mx-auto px-6 text-center relative z-10">
          <div className="inline-flex items-center gap-2 text-xs font-medium text-[#FFB79A] bg-[#4A2A1D]/60 border border-[#5c3320] px-3.5 py-1.5 rounded-full mb-6 backdrop-blur-sm">
            <svg className="w-3.5 h-3.5 text-[#FF6A39]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />
            </svg>
            Now with real-time Kanban & Supabase sync
          </div>

          <h1 className="font-display text-4xl sm:text-6xl font-bold tracking-tight mb-5 max-w-3xl mx-auto leading-[1.1]">
            Plan the work.{" "}
            <span className="bg-gradient-to-r from-[#FF6A39] via-[#E8A93B] to-[#FFB79A] bg-clip-text text-transparent">
              Forge the outcome.
            </span>
          </h1>

          <p className="text-base sm:text-lg text-[#9A9CAA] max-w-xl mx-auto mb-8 leading-relaxed">
            TaskForge is the agile project tracker built for teams who ship. Organize projects, run sprints, and keep every issue moving — without the Jira bloat.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 mb-4">
            <Link
              to={accessToken ? "/dashboard" : "/register"}
              className="px-6 py-3 bg-[#FF6A39] text-[#20100A] font-semibold text-sm rounded-xl hover:bg-[#FF7E52] transition shadow-lg shadow-[#FF6A39]/25 flex items-center gap-2 group"
            >
              {accessToken ? "Go to Dashboard" : "Get started free"}
              <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
            <a
              href="#tour"
              className="px-6 py-3 bg-[#1E212C] border border-[#2A2D3A] text-sm font-semibold text-[#EDEEF3] hover:border-[#5F6272] rounded-xl transition flex items-center gap-2"
            >
              Interactive demo
              <svg className="w-3.5 h-3.5 text-[#5B8DEF]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M5 3l14 9-14 9V3z" />
              </svg>
            </a>
          </div>

          <p className="text-xs text-[#5F6272]">No credit card required · Free for teams up to 10</p>

          {/* Floating UI Mock */}
          <div className="relative mt-16 max-w-4xl mx-auto">
            {/* Float pills */}
            <div className="absolute -top-6 -left-4 sm:-left-8 bg-[#171923] border border-[#2A2D3A] rounded-xl px-3.5 py-2 text-xs shadow-2xl flex items-center gap-2 z-20 animate-bounce duration-1000">
              <svg className="w-4 h-4 text-[#2BB673]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              <span className="font-semibold text-[#EDEEF3]">Sprint 14 · 64% complete</span>
            </div>

            <div className="absolute -bottom-6 -right-4 sm:-right-8 bg-[#171923] border border-[#2A2D3A] rounded-xl px-3.5 py-2 text-xs shadow-2xl flex items-center gap-2 z-20">
              <div className="w-5 h-5 rounded-full bg-[#4A2A1D] text-[#FFB79A] text-[9px] font-bold flex items-center justify-center font-display">
                HM
              </div>
              <span className="text-[#9A9CAA]">
                <strong className="text-[#EDEEF3]">TF-098</strong> assigned to you
              </span>
            </div>

            {/* Board Mock Frame */}
            <div className="bg-[#171923] border border-[#2A2D3A] rounded-2xl p-4 sm:p-5 shadow-2xl">
              <div className="flex items-center gap-1.5 pb-4 border-b border-[#2A2D3A]">
                <div className="w-2.5 h-2.5 rounded-full bg-[#E5484D]/70" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#E8A93B]/70" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#2BB673]/70" />
                <span className="text-[11px] font-mono text-[#5F6272] ml-2">TaskForge Kanban · Orion Platform</span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4 text-left">
                {/* Column 1 */}
                <div className="bg-[#1E212C] border border-[#2A2D3A] rounded-xl p-3 space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#5F6272]">Todo</div>
                  <div className="bg-[#262A38] p-2.5 rounded-lg text-xs text-[#9A9CAA] border-l-2 border-[#5B8DEF]">
                    Add pagination to member list
                  </div>
                  <div className="bg-[#262A38] p-2.5 rounded-lg text-xs text-[#9A9CAA] border-l-2 border-[#E5484D]">
                    Refresh token expiry bug
                  </div>
                </div>

                {/* Column 2 */}
                <div className="bg-[#1E212C] border border-[#2A2D3A] rounded-xl p-3 space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#5B8DEF]">In progress</div>
                  <div className="bg-[#262A38] p-2.5 rounded-lg text-xs text-[#EDEEF3] border-l-2 border-[#FF6A39]">
                    Optimistic locking on issues
                  </div>
                  <div className="bg-[#262A38] p-2.5 rounded-lg text-xs text-[#9A9CAA] border-l-2 border-[#5B8DEF]">
                    Redis cache for summaries
                  </div>
                </div>

                {/* Column 3 */}
                <div className="bg-[#1E212C] border border-[#2A2D3A] rounded-xl p-3 space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#E8A93B]">In review</div>
                  <div className="bg-[#262A38] p-2.5 rounded-lg text-xs text-[#9A9CAA] border-l-2 border-[#E5484D]">
                    Kafka consumer rebalance fix
                  </div>
                </div>

                {/* Column 4 */}
                <div className="bg-[#1E212C] border border-[#2A2D3A] rounded-xl p-3 space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#2BB673]">Done</div>
                  <div className="bg-[#262A38] p-2.5 rounded-lg text-xs text-[#9A9CAA] border-l-2 border-[#2BB673]">
                    Alembic base schema
                  </div>
                  <div className="bg-[#262A38] p-2.5 rounded-lg text-xs text-[#9A9CAA] border-l-2 border-[#FF6A39]">
                    JWT auth flow
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== LOGO MARQUEE STRIP ===== */}
      <div className="border-y border-[#2A2D3A] py-8 overflow-hidden bg-[#171923]/40">
        <div className="max-w-[1180px] mx-auto px-6">
          <div className="text-center text-[11px] font-semibold text-[#5F6272] uppercase tracking-widest mb-6">
            Trusted by fast-moving engineering teams at
          </div>
          <div className="flex gap-12 sm:gap-16 items-center justify-center flex-wrap opacity-60">
            {companies.map((company, i) => (
              <span key={i} className="font-display font-bold text-lg sm:text-xl text-[#9A9CAA] hover:text-[#EDEEF3] transition-colors cursor-default">
                {company}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ===== FEATURES GRID ===== */}
      <section className="py-24" id="features">
        <div className="max-w-[1180px] mx-auto px-6">
          <div className="text-center max-w-xl mx-auto mb-16 space-y-3">
            <div className="text-xs font-bold uppercase tracking-widest text-[#FF6A39]">Features</div>
            <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">
              Everything your team needs to ship
            </h2>
            <p className="text-sm text-[#9A9CAA] leading-relaxed">
              Built around real engineering workflows — not another generic checklist app.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Feature 1 */}
            <div className="bg-[#171923] border border-[#2A2D3A] rounded-2xl p-6 hover:-translate-y-1 hover:border-[#5F6272] transition-all duration-200">
              <div className="w-10 h-10 rounded-xl bg-[#4A2A1D] flex items-center justify-center text-[#FFB79A] mb-4">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M8 4v5" />
                </svg>
              </div>
              <h3 className="font-semibold text-base mb-2">Drag-and-Drop Kanban</h3>
              <p className="text-xs text-[#9A9CAA] leading-relaxed">
                Move issues across Todo, In progress, In review, and Done with live status validation and conflict-safe optimistic concurrency.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-[#171923] border border-[#2A2D3A] rounded-2xl p-6 hover:-translate-y-1 hover:border-[#5F6272] transition-all duration-200">
              <div className="w-10 h-10 rounded-xl bg-[#1E2A40] flex items-center justify-center text-[#5B8DEF] mb-4">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" />
                </svg>
              </div>
              <h3 className="font-semibold text-base mb-2">Sprint Planning & Burndown</h3>
              <p className="text-xs text-[#9A9CAA] leading-relaxed">
                Plan sprints, attach backlog tasks, track completion percentages in real time, and start/complete cycles effortlessly.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-[#171923] border border-[#2A2D3A] rounded-2xl p-6 hover:-translate-y-1 hover:border-[#5F6272] transition-all duration-200">
              <div className="w-10 h-10 rounded-xl bg-[#123227] flex items-center justify-center text-[#2BB673] mb-4">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M3 12h4l3-8 4 16 3-8h4" />
                </svg>
              </div>
              <h3 className="font-semibold text-base mb-2">Backlog & Priority Filter</h3>
              <p className="text-xs text-[#9A9CAA] leading-relaxed">
                Filter issues by priority pills (Urgent, High, Medium, Low) and scope tasks assigned directly to you in 1 click.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-[#171923] border border-[#2A2D3A] rounded-2xl p-6 hover:-translate-y-1 hover:border-[#5F6272] transition-all duration-200">
              <div className="w-10 h-10 rounded-xl bg-[#3A2A10] flex items-center justify-center text-[#E8A93B] mb-4">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="9" cy="7" r="3" /><circle cx="17" cy="7" r="3" /><path d="M3 20c0-3 2.5-5 6-5s6 2 6 5M13 15c3 0 5.5 2 5.5 5" />
                </svg>
              </div>
              <h3 className="font-semibold text-base mb-2">Invite Codes & Roles</h3>
              <p className="text-xs text-[#9A9CAA] leading-relaxed">
                Invite teammates with shareable 8-character workspace invite codes with Admin, PM, Developer, and Viewer permissions.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="bg-[#171923] border border-[#2A2D3A] rounded-2xl p-6 hover:-translate-y-1 hover:border-[#5F6272] transition-all duration-200">
              <div className="w-10 h-10 rounded-xl bg-[#4A2A1D] flex items-center justify-center text-[#FFB79A] mb-4">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 01-3.4 0" />
                </svg>
              </div>
              <h3 className="font-semibold text-base mb-2">Live Toast Popups</h3>
              <p className="text-xs text-[#9A9CAA] leading-relaxed">
                Receive instant animated popups when assigned to issues, when someone comments, or when sprints start.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="bg-[#171923] border border-[#2A2D3A] rounded-2xl p-6 hover:-translate-y-1 hover:border-[#5F6272] transition-all duration-200">
              <div className="w-10 h-10 rounded-xl bg-[#1E2A40] flex items-center justify-center text-[#5B8DEF] mb-4">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M4 19V9M12 19V5M20 19v-7" />
                </svg>
              </div>
              <h3 className="font-semibold text-base mb-2">Tiered Project Audit Trail</h3>
              <p className="text-xs text-[#9A9CAA] leading-relaxed">
                Immutable event timeline with clean summaries for everyone and full JSON diff inspection for Admins.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section className="py-20 bg-[#171923]/30 border-y border-[#2A2D3A]" id="how">
        <div className="max-w-[1180px] mx-auto px-6">
          <div className="text-center max-w-xl mx-auto mb-16 space-y-3">
            <div className="text-xs font-bold uppercase tracking-widest text-[#FF6A39]">How it works</div>
            <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">
              From sign-up to shipped in minutes
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative">
            <div className="text-center space-y-3">
              <div className="w-11 h-11 rounded-full bg-[#1E212C] border border-[#2A2D3A] flex items-center justify-center font-display font-bold text-sm text-[#FFB79A] mx-auto shadow-md">
                1
              </div>
              <h3 className="font-semibold text-sm">Create your org</h3>
              <p className="text-xs text-[#9A9CAA]">Set up a workspace or join instantly with an 8-character invite code.</p>
            </div>

            <div className="text-center space-y-3">
              <div className="w-11 h-11 rounded-full bg-[#1E212C] border border-[#2A2D3A] flex items-center justify-center font-display font-bold text-sm text-[#FFB79A] mx-auto shadow-md">
                2
              </div>
              <h3 className="font-semibold text-sm">Add a project</h3>
              <p className="text-xs text-[#9A9CAA]">Spin up projects and invite team members with granular roles.</p>
            </div>

            <div className="text-center space-y-3">
              <div className="w-11 h-11 rounded-full bg-[#1E212C] border border-[#2A2D3A] flex items-center justify-center font-display font-bold text-sm text-[#FFB79A] mx-auto shadow-md">
                3
              </div>
              <h3 className="font-semibold text-sm">Plan a sprint</h3>
              <p className="text-xs text-[#9A9CAA]">Pull backlog issues into sprints and track completion metrics.</p>
            </div>

            <div className="text-center space-y-3">
              <div className="w-11 h-11 rounded-full bg-[#1E212C] border border-[#2A2D3A] flex items-center justify-center font-display font-bold text-sm text-[#FFB79A] mx-auto shadow-md">
                4
              </div>
              <h3 className="font-semibold text-sm">Ship & track</h3>
              <p className="text-xs text-[#9A9CAA]">Move cards on Kanban, collaborate in comments, and track audit trails.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== STATS BAND ===== */}
      <section className="py-20">
        <div className="max-w-[1180px] mx-auto px-6">
          <div ref={statsRef} className="bg-[#171923] border border-[#2A2D3A] rounded-3xl p-8 sm:p-12 grid grid-cols-2 lg:grid-cols-4 gap-8 text-center shadow-xl">
            <div>
              <div className="font-display text-3xl sm:text-4xl font-bold bg-gradient-to-r from-[#FF6A39] to-[#E8A93B] bg-clip-text text-transparent">
                {issuesCount.toLocaleString()}+
              </div>
              <div className="text-xs text-[#9A9CAA] mt-2 font-medium">Issues tracked daily</div>
            </div>
            <div>
              <div className="font-display text-3xl sm:text-4xl font-bold bg-gradient-to-r from-[#FF6A39] to-[#E8A93B] bg-clip-text text-transparent">
                {teamsCount.toLocaleString()}+
              </div>
              <div className="text-xs text-[#9A9CAA] mt-2 font-medium">Teams onboard</div>
            </div>
            <div>
              <div className="font-display text-3xl sm:text-4xl font-bold bg-gradient-to-r from-[#FF6A39] to-[#E8A93B] bg-clip-text text-transparent">
                {uptimeCount}%
              </div>
              <div className="text-xs text-[#9A9CAA] mt-2 font-medium">Uptime last 12 months</div>
            </div>
            <div>
              <div className="font-display text-3xl sm:text-4xl font-bold bg-gradient-to-r from-[#FF6A39] to-[#E8A93B] bg-clip-text text-transparent">
                {fasterCount}%
              </div>
              <div className="text-xs text-[#9A9CAA] mt-2 font-medium">Faster sprint cycles</div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== TESTIMONIALS ===== */}
      <section className="py-20" id="testimonials">
        <div className="max-w-[1180px] mx-auto px-6">
          <div className="text-center max-w-xl mx-auto mb-16 space-y-3">
            <div className="text-xs font-bold uppercase tracking-widest text-[#FF6A39]">Testimonials</div>
            <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">
              Loved by engineering teams
            </h2>
            <p className="text-sm text-[#9A9CAA]">
              Words from engineers and managers who moved their teams to TaskForge.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-[#171923] border border-[#2A2D3A] rounded-2xl p-6 flex flex-col justify-between hover:-translate-y-1 transition">
              <div className="space-y-3 mb-6">
                <div className="text-[#E8A93B] text-sm">★★★★★</div>
                <p className="text-xs text-[#9A9CAA] leading-relaxed">
                  &ldquo;We replaced legacy issue trackers with TaskForge in a single afternoon. The Kanban board feels instantaneous, even with 40 engineers updating tasks at once.&rdquo;
                </p>
              </div>
              <div className="flex items-center gap-3 pt-4 border-t border-[#2A2D3A]">
                <div className="w-8 h-8 rounded-full bg-[#1E2A40] text-[#BFD4FF] text-xs font-bold flex items-center justify-center font-display">
                  PS
                </div>
                <div>
                  <div className="text-xs font-semibold text-[#EDEEF3]">Priya Sharma</div>
                  <div className="text-[11px] text-[#5F6272]">Engineering Manager, Stripe</div>
                </div>
              </div>
            </div>

            <div className="bg-[#171923] border border-[#2A2D3A] rounded-2xl p-6 flex flex-col justify-between hover:-translate-y-1 transition">
              <div className="space-y-3 mb-6">
                <div className="text-[#E8A93B] text-sm">★★★★★</div>
                <p className="text-xs text-[#9A9CAA] leading-relaxed">
                  &ldquo;The invite-code flow made onboarding our whole org trivial. Sprint completion percentages and live progress bars finally mean something to our PMs.&rdquo;
                </p>
              </div>
              <div className="flex items-center gap-3 pt-4 border-t border-[#2A2D3A]">
                <div className="w-8 h-8 rounded-full bg-[#4A2A1D] text-[#FFB79A] text-xs font-bold flex items-center justify-center font-display">
                  RK
                </div>
                <div>
                  <div className="text-xs font-semibold text-[#EDEEF3]">Rahul Kapoor</div>
                  <div className="text-[11px] text-[#5F6272]">Staff Infrastructure Engineer, Vercel</div>
                </div>
              </div>
            </div>

            <div className="bg-[#171923] border border-[#2A2D3A] rounded-2xl p-6 flex flex-col justify-between hover:-translate-y-1 transition">
              <div className="space-y-3 mb-6">
                <div className="text-[#E8A93B] text-sm">★★★★★</div>
                <p className="text-xs text-[#9A9CAA] leading-relaxed">
                  &ldquo;The Backlog &lsquo;Assigned to Me&rsquo; view and tiered audit logs saved us hours every Monday planning sprints and verifying changes.&rdquo;
                </p>
              </div>
              <div className="flex items-center gap-3 pt-4 border-t border-[#2A2D3A]">
                <div className="w-8 h-8 rounded-full bg-[#123227] text-[#2BB673] text-xs font-bold flex items-center justify-center font-display">
                  AN
                </div>
                <div>
                  <div className="text-xs font-semibold text-[#EDEEF3]">Ananya Nair</div>
                  <div className="text-[11px] text-[#5F6272]">Lead Core Developer, Supabase</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== PRICING ===== */}
      <section className="py-20 bg-[#171923]/30 border-t border-[#2A2D3A]" id="pricing">
        <div className="max-w-[1180px] mx-auto px-6">
          <div className="text-center max-w-xl mx-auto mb-16 space-y-3">
            <div className="text-xs font-bold uppercase tracking-widest text-[#FF6A39]">Pricing</div>
            <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">
              Simple pricing, no surprises
            </h2>
            <p className="text-sm text-[#9A9CAA]">
              Start free. Upgrade only when your team scales.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
            {/* Starter Plan */}
            <div className="bg-[#171923] border border-[#2A2D3A] rounded-2xl p-7 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="font-semibold text-sm text-[#9A9CAA]">Starter</div>
                <div className="font-display text-4xl font-bold">
                  $0<span className="text-xs font-medium text-[#5F6272]">/mo</span>
                </div>
                <p className="text-xs text-[#5F6272]">For small teams getting started</p>
                <div className="h-[1px] bg-[#2A2D3A]" />
                <ul className="space-y-3 text-xs text-[#9A9CAA]">
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-[#2BB673]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" /></svg>
                    Up to 10 members
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-[#2BB673]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" /></svg>
                    Unlimited issues & comments
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-[#2BB673]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" /></svg>
                    1 workspace organization
                  </li>
                </ul>
              </div>
              <Link
                to="/register"
                className="mt-8 w-full py-2.5 bg-[#1E212C] hover:bg-[#262A38] border border-[#2A2D3A] text-xs font-semibold rounded-xl text-center transition block"
              >
                Get started free
              </Link>
            </div>

            {/* Team Plan (Featured) */}
            <div className="bg-gradient-to-b from-[#4A2A1D]/40 to-[#171923] border-2 border-[#FF6A39] rounded-2xl p-7 flex flex-col justify-between relative shadow-2xl shadow-[#FF6A39]/10">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-[#FF6A39] text-[#20100A] text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full">
                Most Popular
              </div>
              <div className="space-y-4">
                <div className="font-semibold text-sm text-[#FFB79A]">Team</div>
                <div className="font-display text-4xl font-bold text-[#EDEEF3]">
                  $9<span className="text-xs font-medium text-[#5F6272]">/user/mo</span>
                </div>
                <p className="text-xs text-[#5F6272]">For fast-shipping product squads</p>
                <div className="h-[1px] bg-[#2A2D3A]" />
                <ul className="space-y-3 text-xs text-[#EDEEF3]">
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-[#2BB673]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" /></svg>
                    Unlimited team members
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-[#2BB673]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" /></svg>
                    Unlimited projects & sprints
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-[#2BB673]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" /></svg>
                    Sprint analytics & burndown
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-[#2BB673]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" /></svg>
                    Tiered immutable audit logs
                  </li>
                </ul>
              </div>
              <Link
                to="/register"
                className="mt-8 w-full py-2.5 bg-[#FF6A39] hover:bg-[#FF7E52] text-[#20100A] text-xs font-bold rounded-xl text-center transition block shadow-lg shadow-[#FF6A39]/20"
              >
                Start free trial
              </Link>
            </div>

            {/* Enterprise Plan */}
            <div className="bg-[#171923] border border-[#2A2D3A] rounded-2xl p-7 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="font-semibold text-sm text-[#9A9CAA]">Enterprise</div>
                <div className="font-display text-4xl font-bold">Custom</div>
                <p className="text-xs text-[#5F6272]">For orgs with strict security & scale</p>
                <div className="h-[1px] bg-[#2A2D3A]" />
                <ul className="space-y-3 text-xs text-[#9A9CAA]">
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-[#2BB673]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" /></svg>
                    SAML SSO & SCIM provisioning
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-[#2BB673]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" /></svg>
                    Dedicated cloud database clusters
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-[#2BB673]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" /></svg>
                    Custom SLAs & 24/7 support
                  </li>
                </ul>
              </div>
              <Link
                to="/register"
                className="mt-8 w-full py-2.5 bg-[#1E212C] hover:bg-[#262A38] border border-[#2A2D3A] text-xs font-semibold rounded-xl text-center transition block"
              >
                Contact sales
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ===== BOTTOM CTA ===== */}
      <section className="py-24">
        <div className="max-w-[1180px] mx-auto px-6">
          <div className="bg-gradient-to-r from-[#4A2A1D] via-[#171923] to-[#1E212C] border border-[#2A2D3A] rounded-3xl p-10 sm:p-16 text-center space-y-6 shadow-2xl relative overflow-hidden">
            <div className="space-y-2 max-w-xl mx-auto">
              <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">
                Ready to forge your workflow?
              </h2>
              <p className="text-sm text-[#9A9CAA]">
                Join hundreds of teams tracking their work with TaskForge. Free forever for small teams.
              </p>
            </div>
            <div>
              <Link
                to={accessToken ? "/dashboard" : "/register"}
                className="inline-flex px-8 py-3.5 bg-[#FF6A39] text-[#20100A] font-bold text-sm rounded-xl hover:bg-[#FF7E52] transition shadow-xl shadow-[#FF6A39]/30"
              >
                {accessToken ? "Open TaskForge Dashboard" : "Get started free today"}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="border-t border-[#2A2D3A] py-12 bg-[#101116]">
        <div className="max-w-[1180px] mx-auto px-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8 mb-12">
            <div className="lg:col-span-2 space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-md bg-[#FF6A39] flex items-center justify-center font-display font-bold text-[10px] text-[#1a0d05]">
                  TF
                </div>
                <span className="font-display font-bold text-sm tracking-tight text-[#EDEEF3]">
                  TaskForge
                </span>
              </div>
              <p className="text-xs text-[#5F6272] max-w-xs leading-relaxed">
                A modern Jira-alternative agile project management tool built for teams who&apos;d rather ship than configure.
              </p>
            </div>

            <div className="space-y-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#5F6272]">Product</div>
              <div className="flex flex-col gap-2 text-xs text-[#9A9CAA]">
                <a href="#features" className="hover:text-[#EDEEF3] transition">Features</a>
                <a href="#pricing" className="hover:text-[#EDEEF3] transition">Pricing</a>
                <a href="#how" className="hover:text-[#EDEEF3] transition">How it works</a>
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#5F6272]">Company</div>
              <div className="flex flex-col gap-2 text-xs text-[#9A9CAA]">
                <span className="hover:text-[#EDEEF3] cursor-pointer">About</span>
                <span className="hover:text-[#EDEEF3] cursor-pointer">Blog</span>
                <span className="hover:text-[#EDEEF3] cursor-pointer">Careers</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#5F6272]">Resources</div>
              <div className="flex flex-col gap-2 text-xs text-[#9A9CAA]">
                <Link to="/login" className="hover:text-[#EDEEF3]">Sign in</Link>
                <Link to="/register" className="hover:text-[#EDEEF3]">Create account</Link>
                <a href="https://taskforge-fg4u.onrender.com/docs" target="_blank" rel="noreferrer" className="hover:text-[#EDEEF3]">
                  API Reference ↗
                </a>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-[#2A2D3A] text-xs text-[#5F6272]">
            <span>&copy; {new Date().getFullYear()} TaskForge. All rights reserved.</span>
            <span>Built with FastAPI, React, PostgreSQL & Redis.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
