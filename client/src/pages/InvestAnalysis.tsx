import { Layout } from "@/components/layout/Layout";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Boxes,
  Handshake,
  Gem,
  Ruler,
  Scissors,
  TestTube2,
  ArrowRight,
  Target,
  TrendingUp,
  ShieldCheck,
} from "lucide-react";

const LETTERS = [
  {
    key: "I",
    word: "Independent",
    icon: Boxes,
    summary: "A story should stand on its own and be deliverable in any order without forcing changes to other stories in the same release.",
    why: "Banking releases are coordinated across many teams. Stories that secretly depend on each other become last-minute integration crises and force whole sprints to slip when a single dependency moves.",
    looksLike: [
      "Can be picked up by any team member without waiting on another story to merge first.",
      "Has no hidden ordering requirement disguised in the description or acceptance criteria.",
      "Cuts cleanly across the data model so two developers can work in parallel.",
    ],
    smells: [
      "Phrases like 'after Story 4 is done' or 'depends on the new schema'.",
      "Two stories that both need to modify the same migration to be useful.",
      "A story that can't be demoed alone because it has no observable behavior on its own.",
    ],
  },
  {
    key: "N",
    word: "Negotiable",
    icon: Handshake,
    summary: "A story is a placeholder for a conversation, not a frozen contract. The team should be able to refine the scope as they learn.",
    why: "When stories are written like fixed-bid contracts, teams either over-scope to be safe or rigidly deliver what was asked instead of what is needed. In a banking context this produces compliant features that miss the actual risk objective.",
    looksLike: [
      "Captures intent and outcome, not a step-by-step implementation.",
      "Leaves room for the developer and PM to adjust acceptance criteria when better evidence appears.",
      "Encourages a refinement conversation before the sprint, not after.",
    ],
    smells: [
      "Reads like a function signature — every field, every endpoint, every UI control nailed down.",
      "Acceptance criteria that prescribe the technical solution rather than the user outcome.",
      "Rejected because 'that's not what the ticket said' even when the change is obviously correct.",
    ],
  },
  {
    key: "V",
    word: "Valuable",
    icon: Gem,
    summary: "A story must deliver observable value to a user, a customer, or a regulator. If nobody benefits, it shouldn't be in the backlog.",
    why: "Backlogs accumulate technical curiosities and pet refactors. Insisting on Valuable forces every story to name its beneficiary — which is exactly what executive sponsors and auditors will ask about during a quarterly review.",
    looksLike: [
      "States who benefits and what they can now do, in plain banking terms.",
      "Connects to a Brief, PRD, or compliance objective the team can point to.",
      "Survives the 'so what?' test — there's a clear answer to why it matters.",
    ],
    smells: [
      "Pure-internal refactors with no user-visible or risk-reducing outcome attached.",
      "Stories whose only beneficiary is the developer who finds the code annoying.",
      "Acceptance criteria measured in lines changed instead of behavior delivered.",
    ],
  },
  {
    key: "E",
    word: "Estimable",
    icon: Ruler,
    summary: "The team must understand the story well enough to forecast its size with reasonable confidence.",
    why: "Sprint commitments rest on estimates. Banking programs that overcommit miss regulatory deadlines; programs that hedge under-deliver. Estimable stories let velocity be planned honestly instead of guessed.",
    looksLike: [
      "Enough context that two developers, asked separately, would land in the same size range.",
      "Unknowns explicitly listed as spike candidates rather than buried in the description.",
      "References the same data model, system, or capability the team has worked with before — or flags that it doesn't.",
    ],
    smells: [
      "'Investigate X' with no time-box — bottomless work disguised as a story.",
      "A vague verb ('improve', 'optimize', 'enhance') with no measurable target.",
      "Acceptance criteria that depend on a system nobody on the team has touched.",
    ],
  },
  {
    key: "S",
    word: "Small",
    icon: Scissors,
    summary: "A story should fit comfortably inside a single sprint — ideally a few days of work — so it can be finished, reviewed, and demoed.",
    why: "Large stories hide risk. They also block the board, distort burndown, and produce huge pull requests that nobody reviews carefully. Small stories create feedback loops the regulators love and the team trusts.",
    looksLike: [
      "Sized in single-digit story points, finishable inside one sprint with room for review.",
      "Splittable along a clear seam: a workflow step, a data slice, a permission, a channel.",
      "Cleanly mergeable without coordinating release windows with other teams.",
    ],
    smells: [
      "Multi-sprint epics masquerading as stories.",
      "Acceptance criteria that read like a project plan with sub-projects inside.",
      "PRs over a thousand lines of changed code with no obvious vertical slice.",
    ],
  },
  {
    key: "T",
    word: "Testable",
    icon: TestTube2,
    summary: "There must be an objective way to prove the story is done — a test the team can run and an auditor can review.",
    why: "Untestable stories are unfinishable stories. In a regulated environment they are also unauditable, which means the work cannot be trusted in production no matter how good the code is.",
    looksLike: [
      "Acceptance criteria written in given/when/then or equivalent observable form.",
      "Clear definition of done that includes the kind of test (unit, integration, manual, regulatory evidence).",
      "Specific data conditions and edge cases enumerated rather than left to interpretation.",
    ],
    smells: [
      "Subjective acceptance ('looks good', 'feels fast', 'works well').",
      "No way to verify success without asking the original author what they meant.",
      "Hidden non-functional requirements (performance, audit logging) with no test target.",
    ],
  },
];

export default function InvestAnalysis() {
  return (
    <Layout>
      <div className="flex-1 overflow-y-auto bg-background">
        {/* Hero */}
        <section className="px-8 pt-10 pb-8 border-b border-border bg-card">
          <div className="max-w-5xl mx-auto">
            <div className="text-[11px] font-semibold text-primary uppercase tracking-widest mb-3" data-testid="text-eyebrow">
              Story Quality Framework
            </div>
            <h1 className="text-3xl font-semibold text-foreground tracking-tight" data-testid="text-page-title">
              INVEST Analysis for User Stories
            </h1>
            <p className="text-base text-muted-foreground mt-3 leading-relaxed max-w-3xl">
              INVEST is a six-letter checklist for evaluating whether a story is ready to enter a sprint. Coined by Bill Wake
              and adopted by every disciplined agile team since, it is the gate between an idea and committed engineering work.
              In a banking context, the gate is non-negotiable — stories that fail INVEST become the audit findings, the missed
              deadlines, and the production incidents that follow.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {LETTERS.map(l => (
                <a
                  key={l.key}
                  href={`#${l.word.toLowerCase()}`}
                  data-testid={`chip-${l.word.toLowerCase()}`}
                  className="px-3 py-1.5 rounded border border-border bg-background text-xs font-medium text-foreground hover:bg-muted transition-colors flex items-center gap-2"
                >
                  <span className="font-bold text-primary">{l.key}</span>
                  <span>{l.word}</span>
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* Why it matters */}
        <section className="px-8 py-10 border-b border-border">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-xl font-semibold text-foreground tracking-tight">Why we run INVEST on every story</h2>
            <p className="text-sm text-muted-foreground mt-2 max-w-3xl leading-relaxed">
              Story quality is the single highest-leverage point in the delivery process. A well-formed story can be estimated
              honestly, delivered cleanly, reviewed quickly, and audited without rework. A poorly-formed story compounds cost
              at every downstream stage.
            </p>

            <div className="grid grid-cols-3 gap-4 mt-6">
              <RationaleCard
                icon={Target}
                title="Predictable delivery"
                body="Stories that pass INVEST give realistic estimates. Sprints land on schedule because the team knows what they signed up for and can finish it inside the cadence."
              />
              <RationaleCard
                icon={ShieldCheck}
                title="Auditable quality"
                body="Banking regulators don't read code — they read tickets, tests, and acceptance evidence. Testable, valuable stories produce the artifacts that satisfy a quarterly review without a fire drill."
              />
              <RationaleCard
                icon={TrendingUp}
                title="Faster feedback loops"
                body="Independent and Small stories merge weekly, not monthly. Defects are caught a sprint after they're introduced, not a quarter, when the cost to fix is 50× higher."
              />
            </div>
          </div>
        </section>

        {/* The six letters */}
        <section className="px-8 py-10 border-b border-border bg-muted/20">
          <div className="max-w-5xl mx-auto space-y-8">
            <div>
              <h2 className="text-xl font-semibold text-foreground tracking-tight">The six criteria</h2>
              <p className="text-sm text-muted-foreground mt-2 max-w-3xl leading-relaxed">
                Each letter is a distinct test. A story should pass all six before it enters a sprint. Allie, our Story Quality
                Analyst agent, runs this evaluation systematically and reports pass / warn / fail with concrete reasoning for each.
              </p>
            </div>

            {LETTERS.map((l, idx) => (
              <LetterCard key={l.key} letter={l} index={idx} />
            ))}
          </div>
        </section>

        {/* The grading rubric */}
        <section className="px-8 py-10 border-b border-border">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-xl font-semibold text-foreground tracking-tight">How Allie grades a story</h2>
            <p className="text-sm text-muted-foreground mt-2 max-w-3xl leading-relaxed">
              Every story you click <em>Run INVEST</em> on is sent through a six-letter rubric with the same severity scale. The
              output is a per-criterion score, an overall summary, and a list of concrete rewrites you can apply.
            </p>

            <div className="grid grid-cols-3 gap-4 mt-6">
              <RubricCard
                tier="pass"
                icon={CheckCircle2}
                title="Pass"
                body="The story clearly satisfies the criterion. Ready to commit to a sprint as-is."
                accent="bg-emerald-50 border-emerald-200 text-emerald-900"
                badgeAccent="text-emerald-700"
              />
              <RubricCard
                tier="warn"
                icon={AlertTriangle}
                title="Warn"
                body="The story partially satisfies the criterion. Address the noted gaps in refinement before it enters a sprint."
                accent="bg-amber-50 border-amber-200 text-amber-900"
                badgeAccent="text-amber-700"
              />
              <RubricCard
                tier="fail"
                icon={XCircle}
                title="Fail"
                body="The story violates the criterion outright. Split, rewrite, or push back before any commitment is made."
                accent="bg-red-50 border-red-200 text-red-900"
                badgeAccent="text-red-700"
              />
            </div>
          </div>
        </section>

        {/* When to run it */}
        <section className="px-8 py-10 border-b border-border bg-muted/20">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-xl font-semibold text-foreground tracking-tight">When to run INVEST</h2>
            <div className="mt-6 space-y-3">
              <FlowStep
                num="1"
                title="Right after story creation"
                body="The moment Bob or John creates a story, send it through INVEST. Catching a poorly-formed story at creation costs minutes; catching it mid-sprint costs days."
              />
              <FlowStep
                num="2"
                title="During backlog refinement"
                body="Refinement is where stories become real. Run INVEST on every story coming into refinement and use the warn/fail items as the agenda for the conversation."
              />
              <FlowStep
                num="3"
                title="Before sprint commitment"
                body="No story enters a sprint with an open fail. This is the quality gate — the discipline that makes the sprint commitment something the team and the business can both rely on."
              />
            </div>
          </div>
        </section>

        {/* Footer payoff */}
        <section className="px-8 py-12">
          <div className="max-w-5xl mx-auto">
            <div className="rounded-lg border border-primary/20 bg-primary/5 px-6 py-6">
              <h3 className="text-lg font-semibold text-foreground tracking-tight">
                Quality stories are the foundation of predictable delivery
              </h3>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed max-w-3xl">
                INVEST is not a bureaucratic checklist. It is the cheapest, fastest, highest-leverage quality intervention
                available to a software team. Every story you ship through this gate is a story your team can estimate honestly,
                build cleanly, and defend in front of a regulator. Every story you skip the gate on is a future incident,
                missed deadline, or audit finding waiting to surface.
              </p>
              <p className="text-sm text-foreground font-medium mt-4">
                Run INVEST early. Run it often. Treat the warns and fails as the work, not the noise.
              </p>
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
}

// ────────────────────────────────────────────────────────────────────────
function LetterCard({ letter, index }: { letter: typeof LETTERS[number]; index: number }) {
  const Icon = letter.icon;
  return (
    <article
      id={letter.word.toLowerCase()}
      className="rounded-lg border border-border bg-card overflow-hidden scroll-mt-8"
      data-testid={`card-${letter.word.toLowerCase()}`}
    >
      <header className="flex items-start gap-5 px-6 py-5 border-b border-border">
        <div className="w-14 h-14 rounded bg-primary text-primary-foreground flex items-center justify-center text-2xl font-bold shrink-0">
          {letter.key}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Icon size={16} className="text-primary" />
            <h3 className="text-lg font-semibold text-foreground tracking-tight">{letter.word}</h3>
            <span className="text-[11px] text-muted-foreground tabular-nums">{`0${index + 1}`.slice(-2)} of 06</span>
          </div>
          <p className="text-sm text-foreground mt-1.5 leading-relaxed">{letter.summary}</p>
        </div>
      </header>
      <div className="px-6 py-5 space-y-4">
        <div>
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">
            Why it matters in a banking context
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{letter.why}</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded border border-emerald-200 bg-emerald-50/40 px-4 py-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800 mb-2">
              <CheckCircle2 size={13} />
              Looks like
            </div>
            <ul className="space-y-1.5">
              {letter.looksLike.map((item, i) => (
                <li key={i} className="text-[12.5px] text-foreground leading-relaxed flex gap-2">
                  <span className="text-emerald-700 mt-0.5">·</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded border border-red-200 bg-red-50/40 px-4 py-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-red-800 mb-2">
              <XCircle size={13} />
              Common smells
            </div>
            <ul className="space-y-1.5">
              {letter.smells.map((item, i) => (
                <li key={i} className="text-[12.5px] text-foreground leading-relaxed flex gap-2">
                  <span className="text-red-700 mt-0.5">·</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </article>
  );
}

function RationaleCard({ icon: Icon, title, body }: { icon: React.ComponentType<{ size?: number; className?: string }>; title: string; body: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-5 py-5">
      <Icon size={18} className="text-primary mb-3" />
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="text-[13px] text-muted-foreground mt-1.5 leading-relaxed">{body}</p>
    </div>
  );
}

function RubricCard({
  tier,
  icon: Icon,
  title,
  body,
  accent,
  badgeAccent,
}: {
  tier: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  body: string;
  accent: string;
  badgeAccent: string;
}) {
  return (
    <div className={`rounded-lg border px-5 py-5 ${accent}`} data-testid={`rubric-${tier}`}>
      <div className={`flex items-center gap-2 mb-2 ${badgeAccent}`}>
        <Icon size={16} />
        <span className="text-[11px] font-semibold uppercase tracking-widest">{title}</span>
      </div>
      <p className="text-[13px] leading-relaxed">{body}</p>
    </div>
  );
}

function FlowStep({ num, title, body }: { num: string; title: string; body: string }) {
  return (
    <div className="flex items-start gap-4 rounded border border-border bg-card px-5 py-4">
      <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold shrink-0">
        {num}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <ArrowRight size={12} className="text-muted-foreground" />
        </div>
        <p className="text-[13px] text-muted-foreground mt-1 leading-relaxed">{body}</p>
      </div>
    </div>
  );
}
