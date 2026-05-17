import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import { useLocation } from "wouter";

/**
 * 404 Not Found Page - Modern Minimalist Design
 * 
 * Design Philosophy:
 * - Clear error messaging with helpful context
 * - Minimal, professional aesthetic
 * - Easy navigation back to home
 */
export default function NotFound() {
  const [, setLocation] = useLocation();

  const handleGoHome = () => {
    setLocation("/");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary flex items-center justify-center px-4 py-12">
      {/* Subtle background grid pattern */}
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: 'linear-gradient(0deg, transparent 24%, rgba(0, 102, 255, 0.05) 25%, rgba(0, 102, 255, 0.05) 26%, transparent 27%, transparent 74%, rgba(0, 102, 255, 0.05) 75%, rgba(0, 102, 255, 0.05) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(0, 102, 255, 0.05) 25%, rgba(0, 102, 255, 0.05) 26%, transparent 27%, transparent 74%, rgba(0, 102, 255, 0.05) 75%, rgba(0, 102, 255, 0.05) 76%, transparent 77%, transparent)',
          backgroundSize: '50px 50px'
        }} />
      </div>

      <div className="relative w-full max-w-md text-center space-y-8">
        {/* Error icon */}
        <div className="flex justify-center">
          <div className="p-4 bg-destructive/10 rounded-lg">
            <AlertCircle className="w-12 h-12 text-destructive" />
          </div>
        </div>

        {/* Error content */}
        <div className="space-y-4">
          <div className="space-y-2">
            <h1 className="text-6xl font-bold text-foreground">404</h1>
            <h2 className="text-2xl font-semibold text-foreground">
              Room Not Found
            </h2>
          </div>
          <p className="text-muted-foreground text-base">
            The room you are looking for does not exist or you do not have access to it.
            Please check the room ID and try again, or create a new room to start collaborating.
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-3 pt-4">
          <Button
            onClick={handleGoHome}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-2.5"
          >
            Go Back Home
          </Button>
          <Button
            onClick={() => setLocation("/role-room")}
            variant="outline"
            className="w-full border-border text-foreground hover:bg-secondary"
          >
            Create New Room
          </Button>
        </div>

        {/* Help section */}
        <div className="bg-secondary/50 border border-border rounded-lg p-6 text-left space-y-3">
          <h3 className="font-semibold text-foreground">Troubleshooting</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex gap-2">
              <span className="text-primary font-bold">•</span>
              <span>Double-check the room ID for typos</span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary font-bold">•</span>
              <span>Ensure you have the correct access permissions</span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary font-bold">•</span>
              <span>The room may have been deleted by its admin</span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary font-bold">•</span>
              <span>Try logging in again if you are experiencing issues</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
