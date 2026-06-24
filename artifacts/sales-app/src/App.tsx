import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import Home from "@/pages/Home";
import RevenueTrends from "@/pages/RevenueTrends";
import CustomerRevenueReport from "@/pages/CustomerRevenueReport";
import CustomerDetail from "@/pages/CustomerDetail";
import Customers from "@/pages/Customers";
import CustomerCrmDetail from "@/pages/CustomerCrmDetail";
import CustomerAccountPricing from "@/pages/CustomerAccountPricing";
import EkgxLeads from "@/pages/EkgxLeads";
import EkgxLeadDetail from "@/pages/EkgxLeadDetail";
import ArAging from "@/pages/ArAging";
import OrdersHome from "@/pages/OrdersHome";
import NewOrder from "@/pages/NewOrder";
import OrderDetail from "@/pages/OrderDetail";
import Catalog from "@/pages/Catalog";
import InvoiceDetail from "@/pages/InvoiceDetail";
import SupplyManagement from "@/pages/SupplyManagement";
import Tasks from "@/pages/Tasks";
import DataImports from "@/pages/DataImports";
import SharedWorkspace from "@/pages/SharedWorkspace";
import UserManagement from "@/pages/UserManagement";
import Login from "@/pages/Login";
import SetupPassword from "@/pages/SetupPassword";
import PosterBoard from "@/pages/PosterBoard";
import SalesWorkspace from "@/pages/SalesWorkspace";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/customers" component={Customers} />
      <Route path="/ekgx-leads" component={EkgxLeads} />
      <Route path="/ekgx-leads/:leadId" component={EkgxLeadDetail} />
      <Route path="/customers/ekgx-leads/:leadId" component={EkgxLeadDetail} />
      <Route path="/customers/:customerId/pricing" component={CustomerAccountPricing} />
      <Route path="/customers/:customerId" component={CustomerCrmDetail} />
      <Route path="/reports/customers" component={CustomerRevenueReport} />
      <Route path="/reports" component={RevenueTrends} />
      <Route path="/reports/revenue" component={RevenueTrends} />
      <Route path="/reports/yoy" component={RevenueTrends} />
      <Route path="/reports/mom" component={RevenueTrends} />
      <Route path="/reports/customer/:customerId" component={CustomerDetail} />
      <Route path="/ar" component={ArAging} />
      <Route path="/catalog" component={Catalog} />
      <Route path="/supply" component={SupplyManagement} />
      <Route path="/workspace" component={SharedWorkspace} />
      <Route path="/sales-workspace" component={SalesWorkspace} />
      <Route path="/imports" component={DataImports} />
      <Route path="/tasks" component={Tasks} />
      <Route path="/board" component={PosterBoard} />
      <Route path="/admin/users" component={UserManagement} />
      <Route path="/login" component={Login} />
      <Route path="/setup-password" component={SetupPassword} />
      <Route path="/orders" component={OrdersHome} />
      <Route path="/orders/new" component={NewOrder} />
      <Route path="/orders/:id" component={OrderDetail} />
      <Route path="/invoices/:id" component={InvoiceDetail} />
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
