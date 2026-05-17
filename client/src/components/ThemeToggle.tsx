import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";

/**
 * Theme Toggle Component - Modern Minimalist Design
 * 
 * Provides a floating button to switch between light and dark modes
 * Positioned in the top-right corner with smooth transitions
 */
export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="fixed top-4 right-4 z-50">
      <Button
        onClick={toggleTheme}
        size="sm"
        variant="outline"
        className="rounded-full border-border bg-card/80 backdrop-blur-sm hover:bg-secondary transition-all duration-200 shadow-md"
        title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
      >
        {theme === "light" ? (
          <Moon className="w-4 h-4 text-foreground" />
        ) : (
          <Sun className="w-4 h-4 text-foreground" />
        )}
      </Button>
    </div>
  );
}
