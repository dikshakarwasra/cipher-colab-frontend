import { useState, useCallback } from "react";
import { INTENT_CONFIGS, type Intent } from "@shared/intents";
import type { CodeChange } from "@shared/types";

interface CodeEditorProps {
  content: string;
  fileName: string;
  language: string;
  currentIntent: Intent;
  changes: CodeChange[];
  onContentChange: (content: string, intent: Intent) => void;
  showChangeHighlights?: boolean;
  compact?: boolean;
}

export default function CodeEditor({
  content,
  fileName,
  language,
  currentIntent,
  changes,
  onContentChange,
  showChangeHighlights = true,
  compact = false,
}: CodeEditorProps) {
  const [lineCount, setLineCount] = useState(content.split("\n").length);
  const [cursorLine, setCursorLine] = useState(1);
  const [cursorColumn, setCursorColumn] = useState(1);

  const handleContentChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newContent = e.currentTarget.value;
      onContentChange(newContent, currentIntent);
      setLineCount(newContent.split("\n").length);
    },
    [currentIntent, onContentChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const textarea = e.currentTarget;
      const selectionStart = textarea.selectionStart;
      const beforeCursor = textarea.value.substring(0, selectionStart);
      const line = beforeCursor.split("\n").length;
      const lastNewline = beforeCursor.lastIndexOf("\n");
      setCursorLine(line);
      setCursorColumn(selectionStart - lastNewline);

      // Tab key support
      if (e.key === "Tab") {
        e.preventDefault();
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newVal = textarea.value.substring(0, start) + "  " + textarea.value.substring(end);
        onContentChange(newVal, currentIntent);
        requestAnimationFrame(() => {
          textarea.selectionStart = textarea.selectionEnd = start + 2;
        });
      }
    },
    [currentIntent, onContentChange]
  );

  const fileChanges = changes;

  const changesByLine = new Map<number, CodeChange[]>();
  fileChanges.forEach((change) => {
    for (let i = change.lineStart; i <= change.lineEnd; i++) {
      if (!changesByLine.has(i)) changesByLine.set(i, []);
      changesByLine.get(i)!.push(change);
    }
  });

  // Group consecutive changed lines to render intent labels
  interface IntentRange { start: number; end: number; intent: Intent; username: string }
  const intentRanges: IntentRange[] = [];
  if (showChangeHighlights && fileChanges.length > 0) {
    let current: IntentRange | null = null;
    for (let i = 1; i <= lineCount; i++) {
      const lineChanges = changesByLine.get(i);
      if (lineChanges && lineChanges.length > 0) {
        const last = lineChanges[lineChanges.length - 1];
        if (!current || current.intent !== last.intent) {
          if (current) intentRanges.push(current);
          current = { start: i, end: i, intent: last.intent, username: last.username };
        } else {
          current.end = i;
        }
      } else {
        if (current) { intentRanges.push(current); current = null; }
      }
    }
    if (current) intentRanges.push(current);
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {!compact && (
        <div className="px-4 py-3 border-b border-border bg-card">
          <h2 className="text-sm font-semibold text-foreground">{fileName}</h2>
          <p className="text-xs text-muted-foreground">
            {language} · editing with{" "}
            <span style={{ color: INTENT_CONFIGS[currentIntent].color }} className="font-semibold">
              {INTENT_CONFIGS[currentIntent].label}
            </span>
          </p>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden relative">
        {/* Line numbers */}
        <div className="select-none overflow-hidden bg-card border-r border-border/50 text-right">
          <div className="pt-2 px-3">
            {Array.from({ length: lineCount }, (_, i) => (
              <div key={i + 1} className="font-mono text-[11px] leading-6 text-muted-foreground/60">{i + 1}</div>
            ))}
          </div>
        </div>

        {/* Change indicator strip */}
        {showChangeHighlights && (
          <div className="w-1 overflow-hidden flex-shrink-0">
            <div className="pt-2">
              {Array.from({ length: lineCount }, (_, i) => {
                const lineChanges = changesByLine.get(i + 1);
                if (!lineChanges || lineChanges.length === 0) return <div key={i} className="h-6" />;
                const last = lineChanges[lineChanges.length - 1];
                return (
                  <div
                    key={i}
                    className="h-6"
                    style={{ background: INTENT_CONFIGS[last.intent]?.color ?? "transparent", opacity: 0.5 }}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Code area */}
        <div className="flex-1 relative overflow-hidden">
          <textarea
            value={content}
            onChange={handleContentChange}
            onKeyDown={handleKeyDown}
            className="absolute inset-0 w-full h-full resize-none bg-transparent font-mono text-[13px] text-foreground pt-2 px-4 focus:outline-none leading-6"
            spellCheck={false}
            style={{ fontFamily: "'JetBrains Mono', 'Fira Code', 'IBM Plex Mono', monospace", tabSize: 2 }}
          />
        </div>

        {/* Intent range labels on the right edge */}
        {showChangeHighlights && intentRanges.length > 0 && (
          <div className="absolute right-2 top-0 pointer-events-none">
            {intentRanges.map((range, idx) => {
              const cfg = INTENT_CONFIGS[range.intent];
              const topPx = (range.start - 1) * 24 + 8;
              return (
                <div
                  key={idx}
                  className="absolute right-0 rounded px-1.5 py-0.5 text-[10px] font-medium"
                  style={{ top: topPx, background: cfg.bgColor, color: cfg.color, border: `1px solid ${cfg.borderColor}` }}
                >
                  {cfg.label.replace(" Development", " Dev")}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {!compact && (
        <div className="px-4 py-2 border-t border-border bg-card flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Ln {cursorLine}, Col {cursorColumn}</span>
          <span>UTF-8 · {language} · LF</span>
          {fileChanges.length > 0 && (
            <span style={{ color: INTENT_CONFIGS[currentIntent].color }}>
              {fileChanges.length} change{fileChanges.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
