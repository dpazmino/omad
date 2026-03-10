import { useState } from "react";
import { Link, useLocation } from "wouter";
import { 
  Bot, 
  MessageSquare, 
  GitBranch, 
  Users, 
  Sparkles,
  Menu,
  X,
  FolderKanban
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/", label: "Chat", icon: MessageSquare },
  { href: "/agents", label: "Agents", icon: Users },
  { href: "/workflows", label: "Workflows", icon: GitBranch },
];

export function Sidebar() {
  const [location] = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        data-testid="button-sidebar-toggle"
        className="md:hidden fixed top-4 left-4 z-50 p-2 rounded-md bg-card/80 backdrop-blur-sm border border-border"
      >
        {isOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      <aside className={cn(
        "fixed md:sticky top-0 left-0 h-screen w-64 bg-white border-r border-border flex flex-col transition-transform duration-300 z-40",
        isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <div className="p-6 flex items-center gap-3 border-b border-border">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Bot size={20} className="text-white" />
          </div>
          <div>
            <h1 className="font-heading font-bold text-lg leading-none text-foreground" data-testid="text-app-title">BMad</h1>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              <Sparkles size={10} className="text-accent" />
              OpenAI Edition
            </p>
          </div>
        </div>

        <div className="flex-1 py-6 px-4 flex flex-col gap-1">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-2">
            Navigation
          </div>
          {NAV_ITEMS.map((item) => {
            const isActive = location === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                data-testid={`link-nav-${item.label.toLowerCase()}`}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group",
                  isActive 
                    ? "bg-primary/8 text-primary font-medium" 
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon size={18} className={cn(
                  "transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                )} />
                {item.label}
                {isActive && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
                )}
              </Link>
            );
          })}
        </div>
      </aside>
    </>
  );
}
