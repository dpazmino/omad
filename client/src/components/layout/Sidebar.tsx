import { useState } from "react";
import { Link, useLocation } from "wouter";
import { 
  MessageSquare, 
  GitBranch, 
  Users, 
  Menu,
  X,
  FolderKanban,
  BookOpen,
  Shield
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/", label: "Chat", icon: MessageSquare },
  { href: "/agents", label: "Agents", icon: Users },
  { href: "/workflows", label: "Workflows", icon: GitBranch },
  { href: "/guide", label: "Guide", icon: BookOpen },
];

export function Sidebar() {
  const [location] = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        data-testid="button-sidebar-toggle"
        className="md:hidden fixed top-3 left-3 z-50 p-2 rounded bg-card border border-border text-foreground"
      >
        {isOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      <aside className={cn(
        "fixed md:sticky top-0 left-0 h-screen w-60 bg-sidebar text-sidebar-foreground flex flex-col transition-transform duration-200 z-40",
        isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <div className="px-5 py-4 flex items-center gap-3 border-b border-white/8">
          <div className="w-8 h-8 rounded bg-sidebar-accent/90 flex items-center justify-center">
            <Shield size={16} className="text-sidebar" />
          </div>
          <div>
            <h1 className="font-semibold text-sm leading-none text-sidebar-foreground tracking-tight" data-testid="text-app-title">BMad Method</h1>
            <p className="text-[10px] text-sidebar-muted mt-1 tracking-wide uppercase">Enterprise Platform</p>
          </div>
        </div>

        <div className="flex-1 py-4 px-3 flex flex-col gap-0.5">
          <div className="text-[10px] font-medium text-sidebar-muted uppercase tracking-widest mb-2 px-2">
            Navigation
          </div>
          {NAV_ITEMS.map((item) => {
            const isActive = location === item.href || 
              (item.href === "/projects" && location.startsWith("/projects/"));
            return (
              <Link
                key={item.href}
                href={item.href}
                data-testid={`link-nav-${item.label.toLowerCase()}`}
                className={cn(
                  "flex items-center gap-2.5 px-2.5 py-2 rounded text-[13px] transition-colors",
                  isActive 
                    ? "bg-white/10 text-white font-medium" 
                    : "text-sidebar-muted hover:bg-white/5 hover:text-sidebar-foreground"
                )}
              >
                <item.icon size={16} strokeWidth={1.5} />
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="px-3 pb-4">
          <div className="px-2.5 py-2 text-[10px] text-sidebar-muted border-t border-white/8 pt-3">
            Powered by Claude AI
          </div>
        </div>
      </aside>
    </>
  );
}
