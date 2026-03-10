import { ChevronRight } from "lucide-react";
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
const LONG_DASH_ITEM = /^[\s]*[-•]\s+.{80,}/;
const ENDS_WITH_QUESTION = /\?\s*\**\s*$/;
const CHOOSE_PROMPT = /\b(?:choose|pick|select|which|reply with)\b/i;
const DIRECT_QUESTION = /\b(?:what|how|which|do you|would you|could you|can you|are you|have you|should|shall|tell me|share|describe|let me know|your|you)\b/i;
const RHETORICAL_START = /^[\s]*(?:[-•]\s+)?(?:\**)?(?:substitut|combin|eliminat|revers|adapt|modif|put to other|magnif|minimi|rearrang|what if (?:we|the|it|they))\b/i;

function stripTrailingParenthetical(text: string): string {
  return text.replace(/\s*\([^)]*\)\s*$/, "").trim();
}

function isQuestionLine(text: string): boolean {
  const stripped = stripTrailingParenthetical(text.replace(/\*{1,2}/g, "").trim());
  return ENDS_WITH_QUESTION.test(stripped);
}

function isDirectQuestion(text: string): boolean {
  const stripped = stripTrailingParenthetical(text.replace(/\*{1,2}/g, "").trim());
  if (!ENDS_WITH_QUESTION.test(stripped)) return false;
  if (RHETORICAL_START.test(stripped)) return false;
  if (/^[\s]*[-•]\s+/.test(stripped)) return false;
  return DIRECT_QUESTION.test(stripped);
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

const TABLE_ROW = /^\|(.+)\|$/;
const TABLE_SEPARATOR = /^\|[\s:]*-+[\s:]*\|/;

function isTableStart(lines: string[], idx: number): boolean {
  if (idx + 2 >= lines.length) return false;
  const header = lines[idx].trim();
  const sep = lines[idx + 1].trim();
  const firstRow = lines[idx + 2].trim();
  return TABLE_ROW.test(header) && TABLE_SEPARATOR.test(sep) && TABLE_ROW.test(firstRow);
}

function collectTableOptions(lines: string[], startIdx: number): { options: { label: string; text: string }[]; endIdx: number } {
  const options: { label: string; text: string }[] = [];
  let idx = startIdx + 2;
  while (idx < lines.length) {
    const trimmed = lines[idx].trim();
    if (!TABLE_ROW.test(trimmed) || TABLE_SEPARATOR.test(trimmed)) {
      idx++;
      if (!TABLE_ROW.test(trimmed)) break;
      continue;
    }
    const cells = trimmed.split("|").filter(c => c.trim() !== "");
    if (cells.length >= 1) {
      const label = String.fromCharCode(65 + options.length);
      const name = cells[0].replace(/\*{1,2}/g, "").replace(/[🧠🎩🔄🕸️💡🎯🔍⚡🚀✨🎨📊🔬🏗️📋💻🧪🎮]/gu, "").trim();
      const desc = cells.length >= 2 ? cells[1].replace(/\*{1,2}/g, "").trim() : "";
      options.push({ label, text: desc ? `${name} — ${desc}` : name });
    }
    idx++;
  }
  return { options, endIdx: idx };
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

    if (isTableStart(lines, i)) {
      const prompt = findPromptAbove(currentBucket());
      removePromptAbove(currentBucket());
      const { options, endIdx } = collectTableOptions(lines, i);
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
        const hasLongItems = (() => {
          for (let k = i + 1; k < lines.length && lines[k].trim() !== ""; k++) {
            if (LONG_DASH_ITEM.test(lines[k])) return true;
          }
          return false;
        })();
        if (!hasLongItems && isQuestionLine(trimmed)) {
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
      }

      if (!choiceType && isDirectQuestion(trimmed)) {
        const cleanPrompt = trimmed.replace(/\*{1,2}/g, "").replace(/^[\s]*(?:#{1,4}\s+)?(?:\d+\s*[).:]?\s*)?/, "").trim();
        if (cleanPrompt.length > 10) {
          foundInteractive = true;
          questions.push({
            id: questions.length + 1,
            prompt: cleanPrompt,
            type: "open-ended",
          });
          i++;
          while (i < lines.length && lines[i].trim().startsWith("(") && lines[i].trim().endsWith(")")) {
            i++;
          }
          continue;
        }
      }
    }

    currentBucket().push(lines[i]);
    i++;
  }

  if (questions.length === 0) {
    const allLines = content.split("\n");
    let lastQuestionLine = -1;
    for (let j = allLines.length - 1; j >= 0; j--) {
      const t = allLines[j].trim();
      if (t === "") continue;
      if (t.startsWith("(") && t.endsWith(")")) continue;
      if (isDirectQuestion(t)) {
        lastQuestionLine = j;
      }
      break;
    }
    if (lastQuestionLine >= 0) {
      const questionText = allLines[lastQuestionLine].replace(/\*{1,2}/g, "").replace(/^[\s]*(?:#{1,4}\s+)?/, "").trim();
      if (questionText.length > 15) {
        return {
          preamble: allLines.slice(0, lastQuestionLine).join("\n").trim(),
          questions: [{
            id: 1,
            prompt: questionText,
            type: "open-ended",
          }],
          closing: allLines.slice(lastQuestionLine + 1).filter(l => !(l.trim().startsWith("(") && l.trim().endsWith(")"))).join("\n").trim(),
        };
      }
    }
    return null;
  }

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
  const parsed = isLastMessage && !disabled ? parseAgentResponse(content) : null;

  if (!parsed) {
    return (
      <div className="prose prose-sm max-w-none">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {parsed.preamble && (
        <div className="prose prose-sm max-w-none">
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
                {q.options.map(opt => (
                  <div
                    key={opt.label}
                    data-testid={`option-${q.id}-${opt.label}`}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm bg-muted/50 border border-border text-muted-foreground"
                  >
                    <span className="font-mono text-xs px-1.5 py-0.5 rounded shrink-0 bg-muted text-muted-foreground">
                      {opt.label}
                    </span>
                    <span className="flex-1">{opt.text}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {parsed.closing && (
        <div className="prose prose-sm max-w-none mt-3">
          <ReactMarkdown>{parsed.closing}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}
