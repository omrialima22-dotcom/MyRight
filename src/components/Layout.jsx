import React, { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { Home, MessageCircle, ShieldCheck, FolderKanban, LogOut, Menu, X, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", label: "בית", icon: Home, end: true },
  { to: "/chat", label: "העוזר האישי", icon: MessageCircle },
  { to: "/policies", label: "הפוליסות שלי", icon: ShieldCheck },
  { to: "/claims", label: "התביעות שלי", icon: FolderKanban }
];

export default function Layout({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout } = useAuth();
  const location = useLocation();

  const currentLabel = navItems.find((n) => (n.end ? location.pathname === n.to : location.pathname.startsWith(n.to)))?.label || "MyRight";

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar - fixed on the right for RTL */}
      <aside
        className={cn(
          "fixed top-0 right-0 z-40 h-full w-72 bg-sidebar text-sidebar-foreground flex flex-col transition-transform duration-300 border-l border-sidebar-border lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex items-center justify-between px-6 py-7">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sidebar-primary flex items-center justify-center shadow-soft">
              <Sparkles className="w-5 h-5 text-sidebar-primary-foreground" />
            </div>
            <div>
              <h1 className="font-display text-lg font-bold text-sidebar-foreground leading-tight">MyRight</h1>
              <p className="text-xs text-muted-foreground">הזכות שלי</p>
            </div>
          </div>
          <button onClick={() => setMobileOpen(false)} className="lg:hidden text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-1 mt-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl text-[15px] font-medium transition-all",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )
                }
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3 px-2 py-2 mb-2">
            <div className="w-9 h-9 rounded-full bg-sidebar-accent flex items-center justify-center text-sidebar-accent-foreground text-sm font-semibold">
              {(user?.full_name || user?.email || "?").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{user?.full_name || "משתמש"}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={() => logout()}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
          >
            <LogOut className="w-4 h-4" />
            <span>התנתקות</span>
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Main content */}
      <div className="lg:pr-72">
        {/* Mobile top bar */}
        <header className="lg:hidden sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border flex items-center justify-between px-4 py-3">
          <button onClick={() => setMobileOpen(true)} className="p-2 rounded-lg hover:bg-muted">
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-heading font-semibold">{currentLabel}</span>
          <div className="w-9" />
        </header>

        <main className="min-h-screen">{children}</main>
      </div>
    </div>
  );
}