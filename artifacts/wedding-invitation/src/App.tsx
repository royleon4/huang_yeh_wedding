import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Route, Switch } from "wouter";
import Invitation from "@/pages/Invitation";
import Memories from "@/pages/Memories";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Switch>
        <Route path="/Memories" component={Memories} />
        <Route path="/Memories/" component={Memories} />
        <Route path="/memories" component={Memories} />
        <Route path="/memories/" component={Memories} />
        <Route component={Invitation} />
      </Switch>
    </QueryClientProvider>
  );
}

export default App;
