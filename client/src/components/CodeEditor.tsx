import { useState, useCallback, useRef } from "react";
import { INTENT_CONFIGS, type Intent } from "@shared/intents";
import type { CodeChange } from "@shared/types";

export interface LiveRange {
  intent: Intent;
  lineStart: number;
  lineEnd: number;
  username: string;
}

interface CodeEditorProps {
  content: string;
  fileName: string;
  language: string;
  currentIntent: Intent;
  changes: CodeChange[];
  onContentChange: (content: string, intent: Intent) => void;
  showChangeHighlights?: boolean;
  compact?: boolean;
  liveRanges?: LiveRange[];
  onRangeChange?: (line: number, intent: Intent) => void;
}

const LINE_HEIGHT = 24;
const EDITOR_PADDING_TOP = 8;

export default function CodeEditor({
  content,
  fileName,
  language,
  currentIntent,
  changes,
  onContentChange,
  showChangeHighlights = true,
  compact = false,
  liveRanges = [],
  onRangeChange,
}: CodeEditorProps) {
  const [lineCount, setLineCount] = useState(content.split("\n").length);
  const [cursorLine, setCursorLine] = useState(1);
  const [cursorColumn, setCursorColumn] = useState(1);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const syncOverlayScroll = useCallback(() => {
    if (textareaRef.current && overlayRef.current) {
      overlayRef.current.style.transform = `translateY(-${textareaRef.current.scrollTop}px)`;
    }
  }, []);

  const handleContentChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newContent = e.currentTarget.value;
      const beforeCursor = newContent.substring(0, e.currentTarget.selectionStart);
      const line = beforeCursor.split("\n").length;
      onContentChange(newContent, currentIntent);
      setLineCount(newContent.split("\n").length);
      onRangeChange?.(line, currentIntent);
    },
    [currentIntent, onContentChange, onRangeChange]
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
    <div className="flex flex-col h-full bg-[#0B1220]">
      {!compact && (
        <div className="px-4 py-3 border-b border-white/10 bg-[rgba(17,24,39,0.75)] backdrop-blur">
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
        <div className="select-none overflow-hidden border-r border-white/10 bg-[#111827]/70 text-right flex-shrink-0">
          <div className="pt-2 px-3">
            {Array.from({ length: lineCount }, (_, i) => (
              <div key={i + 1} className="font-mono text-[11px] leading-6 text-muted-foreground/60">{i + 1}</div>
            ))}
          </div>
        </div>

        {/* Code area */}
        <div className="flex-1 relative overflow-hidden">

          {/* ── Highlight overlay ─────────────────────────────────
              Absolute, covers code area. Uses translateY to sync
              with textarea scroll without React re-renders.      */}
          <div
            ref={overlayRef}
            className="absolute inset-0 pointer-events-none"
            aria-hidden="true"
          >
            {/* Saved-change line backgrounds (from activity history) */}
            {showChangeHighlights && Array.from(changesByLine.entries()).map(([lineNum, lineChanges]) => {
              const last = lineChanges[lineChanges.length - 1];
              const cfg = INTENT_CONFIGS[last.intent];
              if (!cfg) return null;
              const top = EDITOR_PADDING_TOP + (lineNum - 1) * LINE_HEIGHT;
              return (
                <div
                  key={`saved-${lineNum}`}
                  className="absolute left-0 right-0"
                  style={{
                    top,
                    height: LINE_HEIGHT,
                    background: cfg.bgColor,
                    borderLeft: `2px solid ${cfg.borderColor}`,
                  }}
                />
              );
            })}

            {/* Live ranges from other collaborators */}
            {liveRanges.map((range, idx) => {
              const cfg = INTENT_CONFIGS[range.intent];
              if (!cfg) return null;
              const top = EDITOR_PADDING_TOP + (range.lineStart - 1) * LINE_HEIGHT;
              const height = (range.lineEnd - range.lineStart + 1) * LINE_HEIGHT;
              return (
                <div key={`live-${idx}`}>
                  {/* Colored line background */}
                  <div
                    className="absolute left-0 right-0"
                    style={{
                      top,
                      height,
                      background: cfg.bgColor,
                      borderLeft: `3px solid ${cfg.color}`,
                    }}
                  />
                  {/* Username tag at top of range */}
                  <div
                    className="absolute text-[9px] font-bold px-1.5 py-0.5 rounded-sm whitespace-nowrap"
                    style={{
                      top: top - 2,
                      left: 4,
                      background: cfg.color,
                      color: "#fff",
                      zIndex: 2,
                      lineHeight: "14px",
                    }}
                  >
                    {range.username}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Textarea — on top of the overlay */}
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleContentChange}
            onKeyDown={handleKeyDown}
            onScroll={syncOverlayScroll}
            className="absolute inset-0 w-full h-full resize-none bg-transparent font-mono text-[13px] text-[#F8FAFC] caret-[#67E8F9] pt-2 px-4 focus:outline-none leading-6"
            spellCheck={false}
            style={{ fontFamily: "'JetBrains Mono', 'Fira Code', 'IBM Plex Mono', monospace", tabSize: 2 }}
          />
        </div>

        {/* Right-edge labels for saved intent ranges */}
        {showChangeHighlights && intentRanges.length > 0 && (
          <div className="absolute right-2 top-0 pointer-events-none" style={{ zIndex: 3 }}>
            {intentRanges.map((range, idx) => {
              const cfg = INTENT_CONFIGS[range.intent];
              const topPx = (range.start - 1) * LINE_HEIGHT + EDITOR_PADDING_TOP;
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

        {/* Right-edge labels for live collaborator ranges */}
        {liveRanges.length > 0 && (
          <div className="absolute right-2 top-0 pointer-events-none" style={{ zIndex: 4 }}>
            {liveRanges.map((range, idx) => {
              const cfg = INTENT_CONFIGS[range.intent];
              if (!cfg) return null;
              const topPx = (range.lineStart - 1) * LINE_HEIGHT + EDITOR_PADDING_TOP;
              return (
                <div
                  key={`lr-${idx}`}
                  className="absolute right-0 rounded px-1.5 py-0.5 text-[10px] font-bold text-white"
                  style={{ top: topPx, background: cfg.color }}
                >
                  {range.username} · {cfg.label.replace(" Development", " Dev")}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {!compact && (
        <div className="px-4 py-2 border-t border-white/10 bg-[rgba(17,24,39,0.75)] flex items-center justify-between text-[11px] text-[#94A3B8]">
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
