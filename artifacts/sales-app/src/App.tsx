import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import Home from "@/pages/Home";
import YoyReport from "@/pages/YoyReport";
import MomReport from "@/pages/MomReport";
import CustomerDetail from "@/pages/CustomerDetail";
import ArAging from "@/pages/ArAging";
import OrdersHome from "@/pages/OrdersHome";
import NewOrder from "@/pages/NewOrder";
import OrderDetail from "@/pages/OrderDetail";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/reports/yoy" component={YoyReport} />
      <Route path="/reports/mom" component={MomReport} />
      <Route path="/reports/customer/:customerId" component={CustomerDetail} />
      <Route path="/ar" component={ArAging} />
      <Route path="/orders" component={OrdersHome} />
      <Route path="/orders/new" component={NewOrder} />
      <Route path="/orders/:id" component={OrderDetail} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
