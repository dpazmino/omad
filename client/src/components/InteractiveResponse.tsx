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

function parseAgentResponse(content: string): ParsedContent | null {
  const lines = content.split("\n");
  const questions: ParsedQuestion[] = [];
  let preambleLines: string[] = [];
  let closingLines: string[] = [];
  let currentQuestion: Partial<ParsedQuestion> | null = null;
  let foundQuestions = false;
  let doneWithQuestions = false;

  const mcOptionPattern = /^[\s]*[-•*]?\s*\**([a-eA-E])\s*[).:\]]\**\s+(.+)/;
  const numberedOptionPattern = /^[\s]*[-•*]?\s*\**(\d+)\s*[).:]\**\s+(.+)/;
  const questionPattern = /^[\s]*(?:#{1,4}\s+)?(?:\*{1,2})?(?:(?:Question|Q)\s*#?\s*(\d+)|(\d+)\s*[).:])\s*\**\s*(.*)/i;
  const standaloneQuestionPattern = /\?\s*\**\s*$/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (doneWithQuestions) {
      closingLines.push(line);
      continue;
    }

    const qMatch = trimmed.match(questionPattern);
    if (qMatch) {
      if (currentQuestion && currentQuestion.prompt) {
        if (!currentQuestion.type) currentQuestion.type = "open-ended";
        questions.push(currentQuestion as ParsedQuestion);
      }
      foundQuestions = true;
      const rawPrompt = (qMatch[3] || trimmed).replace(/^\s*[:.]?\s*/, "").replace(/\*{1,2}/g, "").trim();
      currentQuestion = {
        id: questions.length + 1,
        prompt: rawPrompt || trimmed,
        type: undefined as any,
        options: [],
      };
      continue;
    }

    if (foundQuestions && currentQuestion) {
      const mcMatch = trimmed.match(mcOptionPattern);
      if (mcMatch) {
        currentQuestion.type = "multiple-choice";
        currentQuestion.options = currentQuestion.options || [];
        currentQuestion.options.push({ label: mcMatch[1].toUpperCase(), text: mcMatch[2].replace(/\*{1,2}/g, "").trim() });
        continue;
      }

      if (trimmed === "" && currentQuestion.options && currentQuestion.options.length > 0) {
        questions.push(currentQuestion as ParsedQuestion);
        currentQuestion = null;

        const remaining = lines.slice(i + 1);
        const hasMoreQuestions = remaining.some(l => questionPattern.test(l.trim()));
        if (!hasMoreQuestions) {
          doneWithQuestions = true;
        }
        continue;
      }

      if (trimmed === "" && (!currentQuestion.options || currentQuestion.options.length === 0)) {
        if (currentQuestion.prompt && standaloneQuestionPattern.test(currentQuestion.prompt)) {
          currentQuestion.type = "open-ended";
          questions.push(currentQuestion as ParsedQuestion);
          currentQuestion = null;

          const remaining = lines.slice(i + 1);
          const hasMoreQuestions = remaining.some(l => questionPattern.test(l.trim()));
          if (!hasMoreQuestions) {
            doneWithQuestions = true;
          }
        }
        continue;
      }

      if (!currentQuestion.options || currentQuestion.options.length === 0) {
        currentQuestion.prompt += " " + trimmed;
      }
      continue;
    }

    if (!foundQuestions) {
      preambleLines.push(line);
    }
  }

  if (currentQuestion && currentQuestion.prompt) {
    if (!currentQuestion.type) currentQuestion.type = "open-ended";
    questions.push(currentQuestion as ParsedQuestion);
  }

  if (questions.length === 0) {
    const mcBlocks = findInlineChoices(content);
    if (mcBlocks && mcBlocks.questions.length > 0) return mcBlocks;
    return null;
  }

  return {
    preamble: preambleLines.join("\n").trim(),
    questions,
    closing: closingLines.join("\n").trim(),
  };
}

function findInlineChoices(content: string): ParsedContent | null {
  const lines = content.split("\n");
  const questions: ParsedQuestion[] = [];
  let preambleLines: string[] = [];
  let closingLines: string[] = [];
  let collectingOptions = false;
  let currentOptions: { label: string; text: string }[] = [];
  let questionPrompt = "";
  let foundAny = false;

  const optionPattern = /^[\s]*[-•*]?\s*\**([a-eA-E])\s*[).:\]]\**\s+(.+)/;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    const optMatch = trimmed.match(optionPattern);

    if (optMatch) {
      if (!collectingOptions) {
        collectingOptions = true;
        if (preambleLines.length > 0) {
          const lastNonEmpty = [...preambleLines].reverse().findIndex(l => l.trim() !== "");
          if (lastNonEmpty >= 0) {
            const qIdx = preambleLines.length - 1 - lastNonEmpty;
            questionPrompt = preambleLines[qIdx].trim();
            preambleLines = preambleLines.slice(0, qIdx);
          }
        }
      }
      currentOptions.push({ label: optMatch[1].toUpperCase(), text: optMatch[2].trim() });
      foundAny = true;
    } else {
      if (collectingOptions && currentOptions.length > 0) {
        questions.push({
          id: questions.length + 1,
          prompt: questionPrompt || "Choose one:",
          type: "multiple-choice",
          options: [...currentOptions],
        });
        currentOptions = [];
        collectingOptions = false;
        questionPrompt = "";
      }
      if (!foundAny) {
        preambleLines.push(lines[i]);
      } else {
        closingLines.push(lines[i]);
      }
    }
  }

  if (currentOptions.length > 0) {
    questions.push({
      id: questions.length + 1,
      prompt: questionPrompt || "Choose one:",
      type: "multiple-choice",
      options: [...currentOptions],
    });
  }

  if (questions.length === 0) return null;

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
        <div className="prose prose-invert prose-sm max-w-none">
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
