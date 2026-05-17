import { INTENT_CONFIGS, INTENT_LIST, type Intent } from "@shared/intents";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Check } from "lucide-react";

interface IntentSelectorProps {
  selectedIntent: Intent;
  onIntentChange: (intent: Intent) => void;
}

/**
 * Intent Selector Component
 * Allows users to select their current collaboration intent
 * Each intent has a distinct color and purpose
 */
export default function IntentSelector({
  selectedIntent,
  onIntentChange,
}: IntentSelectorProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
          Collaboration Intent
        </h3>
        <p className="text-xs text-muted-foreground">
          Select your current focus to track changes by intent
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {INTENT_LIST.map((intent) => {
          const config = INTENT_CONFIGS[intent];
          const isSelected = selectedIntent === intent;

          return (
            <Tooltip key={intent}>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => onIntentChange(intent)}
                  className="w-full justify-start gap-3 h-auto py-3 px-3 relative"
                  style={{
                    backgroundColor: isSelected
                      ? config.bgColor
                      : "transparent",
                    borderColor: config.borderColor,
                    borderWidth: "1px",
                  }}
                  variant={isSelected ? "default" : "outline"}
                >
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: config.color }}
                  />
                  <div className="flex-1 text-left">
                    <div
                      className="text-sm font-medium"
                      style={{ color: isSelected ? config.color : "inherit" }}
                    >
                      {config.label}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {config.description}
                    </div>
                  </div>
                  {isSelected && (
                    <Check
                      className="w-4 h-4 flex-shrink-0"
                      style={{ color: config.color }}
                    />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>{config.description}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      {/* Current intent display */}
      <div
        className="p-3 rounded-lg border"
        style={{
          backgroundColor: INTENT_CONFIGS[selectedIntent].bgColor,
          borderColor: INTENT_CONFIGS[selectedIntent].borderColor,
        }}
      >
        <p className="text-xs text-muted-foreground">Current Intent:</p>
        <p
          className="text-sm font-semibold"
          style={{ color: INTENT_CONFIGS[selectedIntent].color }}
        >
          {INTENT_CONFIGS[selectedIntent].label}
        </p>
      </div>
    </div>
  );
}
