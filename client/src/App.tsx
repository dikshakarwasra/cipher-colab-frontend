import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import EnhancedWorkspace from "@/pages/EnhancedWorkspace";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Login from "./pages/Login";
import RoleAndRoom from "./pages/RoleAndRoom";
import ThemeToggle from "./components/ThemeToggle";

function Router() {
  const [location] = useLocation();
  const isWorkspace = location.startsWith("/workspace") || location.startsWith("/enhanced-workspace");
  return (
    <>
      {!isWorkspace && <ThemeToggle />}
      <Switch>
        <Route path={"/"} component={Login} />
        <Route path={"/role-room"} component={RoleAndRoom} />
        <Route path={"/workspace"} component={EnhancedWorkspace} />
        <Route path={"/enhanced-workspace"} component={EnhancedWorkspace} />
        <Route path={"/404"} component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark" switchable>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
