import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import EnhancedWorkspace from "@/pages/EnhancedWorkspace";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Login from "./pages/Login";
import RoleAndRoom from "./pages/RoleAndRoom";
import ThemeToggle from "./components/ThemeToggle";
function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <>
      <ThemeToggle />
      <Switch>
        <Route path={"/"} component={Login} />
        <Route path={"/role-room"} component={RoleAndRoom} />
        <Route path={"/workspace"} component={EnhancedWorkspace} />
        <Route path={"/enhanced-workspace"} component={EnhancedWorkspace} />
        <Route path={"/404"} component={NotFound} />
        {/* Final fallback route */}
        <Route component={NotFound} />
      </Switch>
    </>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="dark"
        switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
