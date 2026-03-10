import { useState } from "react";
import { cn } from "@/lib/utils";
import { Send, CheckCircle2, Circle, ChevronRight } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface ParsedQuestion {
  id: number;
  prompt: string;
  type: "multiple-choice" | "open-ended";
  options?: { label: string; text: string }[];
}

interface ParsedContent {
  preamble: string;
  questions: ParsedQuestion[];
  closing: string;
}

const MC_OPTION = /^[\s]*[-•*]?\s*\**([a-eA-E])\s*[).:\]]\**\s+(.+)/;
const ENDS_WITH_QUESTION = /\?\s*\**\s*$/;

function isQuestionLine(text: string): boolean {
  const stripped = text.replace(/\*{1,2}/g, "").trim();
  return ENDS_WITH_QUESTION.test(stripped);
}

function parseAgentResponse(content: string): ParsedContent | null {
  const lines = content.split("\n");
  const questions: ParsedQuestion[] = [];
  const preambleLines: string[] = [];
  const closingLines: string[] = [];

  let i = 0;
  let foundInteractive = false;

  while (i < lines.length) {
    const trimmed = lines[i].trim();

    const mcMatch = trimmed.match(MC_OPTION);
    if (mcMatch) {
      const options: { label: string; text: string }[] = [];
      let questionPrompt = "";

      if (!foundInteractive && preambleLines.length > 0) {
        for (let j = preambleLines.length - 1; j >= 0; j--) {
          if (preambleLines[j].trim() !== "") {
            questionPrompt = preambleLines[j].replace(/\*{1,2}/g, "").replace(/^\s*\d+\s*[).:]?\s*/, "").trim();
            preambleLines.splice(j);
            break;
          }
        }
      } else if (foundInteractive && closingLines.length > 0) {
        for (let j = closingLines.length - 1; j >= 0; j--) {
          if (closingLines[j].trim() !== "") {
            questionPrompt = closingLines[j].replace(/\*{1,2}/g, "").replace(/^\s*\d+\s*[).:]?\s*/, "").trim();
            closingLines.splice(j);
            break;
          }
        }
      }

      while (i < lines.length) {
        const optMatch = lines[i].trim().match(MC_OPTION);
        if (optMatch) {
          options.push({ label: optMatch[1].toUpperCase(), text: optMatch[2].replace(/\*{1,2}/g, "").trim() });
          i++;
        } else {
          break;
        }
      }

      if (options.length >= 2) {
        foundInteractive = true;
        questions.push({
          id: questions.length + 1,
          prompt: questionPrompt || "Select an option:",
          type: "multiple-choice",
          options,
        });
      }
      continue;
    }

    if (isQuestionLine(trimmed) && trimmed.length > 10) {
      const cleanPrompt = trimmed.replace(/\*{1,2}/g, "").replace(/^[\s]*(?:#{1,4}\s+)?(?:\d+\s*[).:]?\s*)?/, "").trim();

      let hasOptionsAfter = false;
      for (let j = i + 1; j < lines.length && j <= i + 8; j++) {
        if (lines[j].trim().match(MC_OPTION)) {
          hasOptionsAfter = true;
          break;
        }
      }

      if (!hasOptionsAfter && cleanPrompt.length > 10) {
        foundInteractive = true;
        questions.push({
          id: questions.length + 1,
          prompt: cleanPrompt,
          type: "open-ended",
        });
        i++;
        continue;
      }
    }

    if (foundInteractive) {
      closingLines.push(lines[i]);
    } else {
      preambleLines.push(lines[i]);
    }
    i++;
  }

  if (questions.length === 0) return null;

  const hasRealQuestions = questions.some(q =>
    q.type === "multiple-choice" ||
    (q.type === "open-ended" && isQuestionLine(q.prompt))
  );

  if (!hasRealQuestions) return null;

  return {
    preamble: preambleLines.join("\n").trim(),
    questions,
    closing: closingLines.join("\n").trim(),
  };
}

interface InteractiveResponseProps {
  content: string;
  onSubmitAnswers: (formattedResponse: string) => void;
  isLastMessage: boolean;
  disabled?: boolean;
}

export function InteractiveResponse({ content, onSubmitAnswers, isLastMessage, disabled }: InteractiveResponseProps) {
  const parsed = isLastMessage ? parseAgentResponse(content) : null;
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);

  if (!parsed || submitted || disabled) {
    return (
      <div className="prose prose-invert prose-sm max-w-none">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    );
  }

  const allAnswered = parsed.questions.every(q => answers[q.id]?.trim());

  const handleSubmit = () => {
    const parts: string[] = [];
    parsed.questions.forEach(q => {
      const answer = answers[q.id];
      if (q.type === "multiple-choice") {
        const chosen = q.options?.find(o => o.label === answer);
        parts.push(`${q.prompt}\nAnswer: ${answer}) ${chosen?.text || ""}`);
      } else {
        parts.push(`${q.prompt}\nAnswer: ${answer}`);
      }
    });
    setSubmitted(true);
    onSubmitAnswers(parts.join("\n\n"));
  };

  return (
    <div className="space-y-4">
      {parsed.preamble && (
        <div className="prose prose-invert prose-sm max-w-none">
          <ReactMarkdown>{parsed.preamble}</ReactMarkdown>
        </div>
      )}

      <div className="space-y-4 mt-3">
        {parsed.questions.map((q) => (
          <div key={q.id} className="space-y-2" data-testid={`question-block-${q.id}`}>
            <div className="flex items-start gap-2">
              <ChevronRight size={14} className="text-primary mt-0.5 shrink-0" />
              <p className="text-sm font-medium text-foreground">{q.prompt}</p>
            </div>

            {q.type === "multiple-choice" && q.options && (
              <div className="grid gap-2 ml-5">
                {q.options.map(opt => {
                  const isSelected = answers[q.id] === opt.label;
                  return (
                    <button
                      key={opt.label}
                      data-testid={`option-${q.id}-${opt.label}`}
                      onClick={() => setAnswers(prev => ({ ...prev, [q.id]: opt.label }))}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm transition-all duration-200 group",
                        isSelected
                          ? "bg-primary/15 border border-primary/40 text-foreground shadow-sm shadow-primary/10"
                          : "bg-white/[0.03] border border-white/[0.06] text-muted-foreground hover:bg-white/[0.06] hover:border-white/10 hover:text-foreground"
                      )}
                    >
                      <div className={cn(
                        "w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-colors",
                        isSelected ? "text-primary" : "text-muted-foreground/50"
                      )}>
                        {isSelected ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                      </div>
                      <span className={cn(
                        "font-mono text-xs px-1.5 py-0.5 rounded shrink-0",
                        isSelected ? "bg-primary/20 text-primary" : "bg-white/5 text-muted-foreground"
                      )}>
                        {opt.label}
                      </span>
                      <span className="flex-1">{opt.text}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {q.type === "open-ended" && (
              <div className="ml-5">
                <textarea
                  data-testid={`input-answer-${q.id}`}
                  value={answers[q.id] || ""}
                  onChange={(e) => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                  placeholder="Type your answer..."
                  className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/40 focus:bg-white/[0.05] resize-none min-h-[80px] transition-all"
                  rows={3}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {parsed.closing && (
        <div className="prose prose-invert prose-sm max-w-none mt-3">
          <ReactMarkdown>{parsed.closing}</ReactMarkdown>
        </div>
      )}

      <div className="flex justify-end mt-2">
        <button
          data-testid="button-submit-answers"
          onClick={handleSubmit}
          disabled={!allAnswered}
          className={cn(
            "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
            allAnswered
              ? "bg-gradient-to-r from-primary to-accent text-white shadow-lg shadow-primary/20 hover:shadow-primary/30 hover:scale-[1.02]"
              : "bg-white/5 text-muted-foreground cursor-not-allowed"
          )}
        >
          <Send size={14} />
          Submit Answers
        </button>
      </div>
    </div>
  );
}
