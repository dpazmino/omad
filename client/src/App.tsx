import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "@/pages/Home";
import Agents from "@/pages/Agents";
import Workflows from "@/pages/Workflows";
import Projects from "@/pages/Projects";
import ProjectDetail from "@/pages/ProjectDetail";
import Guide from "@/pages/Guide";
import DevView from "@/pages/DevView";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/projects" component={Projects} />
      <Route path="/projects/:id/dev" component={DevView} />
      <Route path="/projects/:id" component={ProjectDetail} />
      <Route path="/agents" component={Agents} />
      <Route path="/workflows" component={Workflows} />
      <Route path="/guide" component={Guide} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;