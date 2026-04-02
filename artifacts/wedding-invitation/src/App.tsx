import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Invitation from "@/pages/Invitation";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Invitation />
    </QueryClientProvider>
  );
}

export default App;
