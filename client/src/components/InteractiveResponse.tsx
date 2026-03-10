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

const LETTER_OPTION = /^[\s]*[-•*]?\s*\**([a-eA-E])\s*[).:\]]\**\s+(.+)/;
const NUMBERED_OPTION = /^[\s]*(\d+)\s*[).]\s*\**(.+?)\**\s*$/;
const DASH_OPTION = /^[\s]*[-•]\s+\**(.+?)\**\s*(?:\(.*\))?\s*$/;
const ENDS_WITH_QUESTION = /\?\s*\**\s*$/;
const CHOOSE_PROMPT = /\b(?:choose|pick|select|which|reply with)\b/i;

function isQuestionLine(text: string): boolean {
  const stripped = text.replace(/\*{1,2}/g, "").trim();
  return ENDS_WITH_QUESTION.test(stripped);
}

function isChoosePrompt(text: string): boolean {
  const stripped = text.replace(/\*{1,2}/g, "").trim();
  return CHOOSE_PROMPT.test(stripped);
}

function collectLetterOptions(lines: string[], startIdx: number): { options: { label: string; text: string }[]; endIdx: number } {
  const options: { label: string; text: string }[] = [];
  let idx = startIdx;
  while (idx < lines.length) {
    const match = lines[idx].trim().match(LETTER_OPTION);
    if (match) {
      options.push({ label: match[1].toUpperCase(), text: match[2].replace(/\*{1,2}/g, "").trim() });
      idx++;
    } else {
      break;
    }
  }
  return { options, endIdx: idx };
}

function collectNumberedOptions(lines: string[], startIdx: number): { options: { label: string; text: string }[]; endIdx: number } {
  const options: { label: string; text: string }[] = [];
  let idx = startIdx;
  while (idx < lines.length) {
    const trimmed = lines[idx].trim();
    if (trimmed === "") { idx++; break; }
    const match = trimmed.match(NUMBERED_OPTION);
    if (match) {
      options.push({ label: match[1], text: match[2].replace(/\*{1,2}/g, "").replace(/\s*[-–—]\s*$/, "").trim() });
      idx++;
    } else {
      break;
    }
  }
  return { options, endIdx: idx };
}

function collectDashOptions(lines: string[], startIdx: number): { options: { label: string; text: string }[]; endIdx: number } {
  const options: { label: string; text: string }[] = [];
  let idx = startIdx;
  while (idx < lines.length) {
    const trimmed = lines[idx].trim();
    if (trimmed === "") { idx++; break; }
    const match = trimmed.match(DASH_OPTION);
    if (match && !trimmed.match(LETTER_OPTION)) {
      const label = String.fromCharCode(65 + options.length);
      options.push({ label, text: match[1].replace(/\*{1,2}/g, "").trim() });
      idx++;
    } else {
      break;
    }
  }
  return { options, endIdx: idx };
}

function findPromptAbove(bucket: string[]): string {
  for (let j = bucket.length - 1; j >= 0; j--) {
    const t = bucket[j].trim();
    if (t !== "") {
      return t.replace(/\*{1,2}/g, "").replace(/^\s*(?:#{1,4}\s+)?/, "").trim();
    }
  }
  return "";
}

function removePromptAbove(bucket: string[]): void {
  for (let j = bucket.length - 1; j >= 0; j--) {
    if (bucket[j].trim() !== "") {
      bucket.splice(j);
      return;
    }
  }
}

function hasChoiceListAhead(lines: string[], idx: number): "letter" | "numbered" | "dash" | null {
  for (let j = idx; j < lines.length && j < idx + 3; j++) {
    const t = lines[j].trim();
    if (t === "") continue;
    if (t.match(LETTER_OPTION)) return "letter";
    if (t.match(NUMBERED_OPTION)) return "numbered";
    if (t.match(DASH_OPTION) && !t.match(LETTER_OPTION)) return "dash";
    return null;
  }
  return null;
}

function isShortChoiceList(lines: string[], startIdx: number): boolean {
  let count = 0;
  for (let j = startIdx; j < lines.length; j++) {
    const t = lines[j].trim();
    if (t === "") break;
    if (t.match(NUMBERED_OPTION)) count++;
    else break;
  }
  return count >= 2 && count <= 8;
}

function parseAgentResponse(content: string): ParsedContent | null {
  const lines = content.split("\n");
  const questions: ParsedQuestion[] = [];
  const preambleLines: string[] = [];
  const closingLines: string[] = [];

  let i = 0;
  let foundInteractive = false;
  const currentBucket = () => foundInteractive ? closingLines : preambleLines;

  while (i < lines.length) {
    const trimmed = lines[i].trim();

    if (trimmed.match(LETTER_OPTION)) {
      const prompt = findPromptAbove(currentBucket());
      removePromptAbove(currentBucket());
      const { options, endIdx } = collectLetterOptions(lines, i);
      if (options.length >= 2) {
        foundInteractive = true;
        questions.push({
          id: questions.length + 1,
          prompt: prompt || "Select an option:",
          type: "multiple-choice",
          options,
        });
      }
      i = endIdx;
      continue;
    }

    if (trimmed.match(NUMBERED_OPTION) && isShortChoiceList(lines, i)) {
      const prompt = findPromptAbove(currentBucket());
      const promptIsChoose = isChoosePrompt(prompt) || isQuestionLine(prompt);
      if (promptIsChoose) {
        removePromptAbove(currentBucket());
        const { options, endIdx } = collectNumberedOptions(lines, i);
        if (options.length >= 2) {
          foundInteractive = true;
          questions.push({
            id: questions.length + 1,
            prompt: prompt || "Select an option:",
            type: "multiple-choice",
            options,
          });
        }
        i = endIdx;
        continue;
      }
    }

    if ((isQuestionLine(trimmed) || isChoosePrompt(trimmed)) && trimmed.length > 10) {
      const choiceType = hasChoiceListAhead(lines, i + 1);

      if (choiceType === "dash") {
        const cleanPrompt = trimmed.replace(/\*{1,2}/g, "").replace(/^[\s]*(?:#{1,4}\s+)?/, "").trim();
        i++;
        const { options, endIdx } = collectDashOptions(lines, i);
        if (options.length >= 2 && options.length <= 8) {
          foundInteractive = true;
          questions.push({
            id: questions.length + 1,
            prompt: cleanPrompt,
            type: "multiple-choice",
            options,
          });
          i = endIdx;
          continue;
        }
      }

      if (!choiceType && isQuestionLine(trimmed)) {
        const cleanPrompt = trimmed.replace(/\*{1,2}/g, "").replace(/^[\s]*(?:#{1,4}\s+)?(?:\d+\s*[).:]?\s*)?/, "").trim();
        if (cleanPrompt.length > 10) {
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
    }

    currentBucket().push(lines[i]);
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
        parts.push(`${q.prompt}\nAnswer: ${chosen?.text || answer}`);
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
