import { X, Terminal, Users, Target, Clock, Sparkles, FileText } from "lucide-react";
import type { CommandDetail } from "@/lib/commandDetails";

export function CommandDetailModal({
  command,
  onClose,
}: {
  command: CommandDetail | null;
  onClose: () => void;
}) {
  if (!command) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-6"
      onClick={onClose}
      data-testid="command-detail-modal"
    >
      <div
        className="bg-card rounded-lg shadow-xl border border-border w-full max-w-2xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <code className="bg-primary/10 text-primary text-sm font-mono font-semibold px-2.5 py-1 rounded">
              {command.trigger}
            </code>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-foreground truncate" data-testid="text-command-title">
                {command.name}
              </h3>
              <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                <Users size={10} /> {command.agent}
                <span className="text-muted-foreground/50">·</span>
                <span>{command.phase}</span>
              </p>
            </div>
          </div>
          <button
            data-testid="button-close-command-detail"
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <Section icon={<Target size={12} />} label="What it does">
            {command.purpose}
          </Section>
          <Section icon={<Clock size={12} />} label="When to use it">
            {command.whenToUse}
          </Section>
          <Section icon={<Sparkles size={12} />} label="Example">
            {command.example}
          </Section>
          <Section icon={<FileText size={12} />} label="Output">
            {command.output}
          </Section>

          <div className="mt-2 p-3 rounded bg-muted/40 border border-border flex items-start gap-2">
            <Terminal size={12} className="text-primary shrink-0 mt-0.5" />
            <p className="text-[11px] text-muted-foreground">
              To run, open a project's <span className="font-medium text-foreground">Chat</span> tab and type{" "}
              <code className="bg-muted px-1 py-0.5 rounded font-mono text-[10px] text-foreground">
                {command.trigger}
              </code>{" "}
              (or the command name).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
        <span className="text-primary">{icon}</span> {label}
      </div>
      <p className="text-xs text-foreground leading-relaxed">{children}</p>
    </div>
  );
}
