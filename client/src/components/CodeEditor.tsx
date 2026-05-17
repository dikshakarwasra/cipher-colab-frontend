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
}

/**
 * Code Editor Component
 * Displays code with intent-based change highlighting
 * Tracks edits and shows change history
 */
export default function CodeEditor({
  content,
  fileName,
  language,
  currentIntent,
  changes,
  onContentChange,
  showChangeHighlights = true,
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
      const text = textarea.value;
      const selectionStart = textarea.selectionStart;

      // Calculate line and column
      const beforeCursor = text.substring(0, selectionStart);
      const line = beforeCursor.split("\n").length;
      const lastNewline = beforeCursor.lastIndexOf("\n");
      const column = selectionStart - lastNewline;

      setCursorLine(line);
      setCursorColumn(column);
    },
    []
  );

  // Get changes for current file
  const fileChanges = changes.filter((change) => {
    // In a real app, would filter by file ID
    return true;
  });

  // Group changes by line
  const changesByLine = new Map<number, CodeChange[]>();
  fileChanges.forEach((change) => {
    for (let i = change.lineStart; i <= change.lineEnd; i++) {
      if (!changesByLine.has(i)) {
        changesByLine.set(i, []);
      }
      changesByLine.get(i)!.push(change);
    }
  });

  const renderLineNumbers = () => {
    return (
      <div className="flex flex-col items-end pr-4 text-muted-foreground text-sm font-mono select-none">
        {Array.from({ length: lineCount }, (_, i) => (
          <div key={i + 1} className="h-6 leading-6">
            {i + 1}
          </div>
        ))}
      </div>
    );
  };

  const renderChanges = () => {
    if (!showChangeHighlights || fileChanges.length === 0) {
      return null;
    }

    return (
      <div className="flex flex-col items-end pr-2 text-xs select-none">
        {Array.from({ length: lineCount }, (_, i) => {
          const lineNum = i + 1;
          const lineChanges = changesByLine.get(lineNum);

          if (!lineChanges || lineChanges.length === 0) {
            return (
              <div key={lineNum} className="h-6 leading-6 w-2">
                &nbsp;
              </div>
            );
          }

          // Show indicator for most recent change
          const lastChange = lineChanges[lineChanges.length - 1];
          const config = INTENT_CONFIGS[lastChange.intent];

          return (
            <div
              key={lineNum}
              className="h-6 leading-6 w-2 rounded-l"
              style={{
                backgroundColor: config.color,
                opacity: 0.6,
              }}
              title={`${lastChange.username} - ${config.label}`}
            />
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-card">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border">
        <h2 className="text-lg font-semibold text-foreground">{fileName}</h2>
        <p className="text-xs text-muted-foreground">
          Language: {language} • Editing with intent:{" "}
          <span
            style={{ color: INTENT_CONFIGS[currentIntent].color }}
            className="font-semibold"
          >
            {INTENT_CONFIGS[currentIntent].label}
          </span>
        </p>
      </div>

      {/* Editor */}
      <div className="flex-1 flex overflow-hidden">
        {/* Line numbers */}
        <div className="bg-secondary/50 border-r border-border overflow-hidden">
          {renderLineNumbers()}
        </div>

        {/* Change indicators */}
        {showChangeHighlights && (
          <div className="bg-secondary/50 border-r border-border overflow-hidden">
            {renderChanges()}
          </div>
        )}

        {/* Code textarea */}
        <textarea
          value={content}
          onChange={handleContentChange}
          onKeyDown={handleKeyDown}
          className="flex-1 p-4 font-mono text-sm bg-card text-foreground resize-none focus:outline-none border-none"
          spellCheck="false"
          style={{
            fontFamily: "IBM Plex Mono, monospace",
            lineHeight: "1.5",
            tabSize: 2,
          }}
        />
      </div>

      {/* Footer */}
      <div className="px-6 py-3 border-t border-border bg-secondary/50 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Line {cursorLine}, Column {cursorColumn}
        </span>
        <span>UTF-8 • {language} • LF</span>
        {fileChanges.length > 0 && (
          <span className="text-accent">
            {fileChanges.length} change{fileChanges.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>
    </div>
  );
}
