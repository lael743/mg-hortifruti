import { Toaster } from "@/components/ui/toaster"
import { Toaster as SonnerToaster } from "sonner"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

import AppLayout from './components/layout/AppLayout';
import Catalog from './pages/Catalog';
import Cart from './pages/Cart';
import Orders from './pages/Orders';
import OrderDetail from './pages/OrderDetail';
import AdminLayout from './components/admin/AdminLayout';
import AdminProducts from './pages/admin/AdminProducts';
import AdminOrders from './pages/admin/AdminOrders';
import AdminClients from './pages/admin/AdminClients';
import AdminPriceGroups from './pages/admin/AdminPriceGroups';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminReports from './pages/admin/AdminReports';
import AdminChat from './pages/admin/AdminChat';
import AdminBackup from './pages/admin/AdminBackup';
import AdminCampaign from './pages/admin/AdminCampaign';
import AdminSalespersons from './pages/admin/AdminSalespersons';
import ClientFinancial from './pages/ClientFinancial';
import NewOrder from './pages/NewOrder';
import Profile from './pages/Profile';
import FinancialLayout from './components/financial/FinancialLayout.jsx';
import FinancialDashboard from './pages/financial/FinancialDashboard';
import Transactions from './pages/financial/Transactions';
import Bills from './pages/financial/Bills';
import Checks from './pages/financial/Checks';
import FinancialCategories from './pages/financial/FinancialCategories';
import Suppliers from './pages/financial/Suppliers';
import FinancialReports from './pages/financial/FinancialReports';
import ContasAReceber from './pages/financial/ContasAReceber';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Catalog />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/new-order" element={<NewOrder />} />
        <Route path="/orders/:id" element={<OrderDetail />} />
        <Route path="/financial" element={<ClientFinancial />} />
        <Route path="/profile" element={<Profile />} />
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<AdminProducts />} />
          <Route path="/admin/orders" element={<AdminOrders />} />
          <Route path="/admin/clients" element={<AdminClients />} />
          <Route path="/admin/price-groups" element={<AdminPriceGroups />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/reports" element={<AdminReports />} />
          <Route path="/admin/chat" element={<AdminChat />} />
          <Route path="/admin/backup" element={<AdminBackup />} />
          <Route path="/admin/campaign" element={<AdminCampaign />} />
          <Route path="/admin/salespersons" element={<AdminSalespersons />} />
        </Route>
      </Route>
      <Route element={<FinancialLayout />}>
        <Route path="/financeiro" element={<FinancialDashboard />} />
        <Route path="/financeiro/lancamentos" element={<Transactions />} />
        <Route path="/financeiro/boletos" element={<Bills />} />
        <Route path="/financeiro/cheques" element={<Checks />} />
        <Route path="/financeiro/categorias" element={<FinancialCategories />} />
        <Route path="/financeiro/fornecedores" element={<Suppliers />} />
        <Route path="/financeiro/contas-a-receber" element={<ContasAReceber />} />
        <Route path="/financeiro/relatorios" element={<FinancialReports />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
        <SonnerToaster position="top-center" richColors />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App