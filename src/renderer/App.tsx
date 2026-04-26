import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './features/auth/authStore';
import { LoginPage } from './features/auth/LoginPage';
import { AppShell } from './components/AppShell';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { PosPage } from './features/pos/PosPage';
import { ProductsPage } from './features/products/ProductsPage';
import { InventoryPage } from './features/inventory/InventoryPage';
import { SalesPage } from './features/sales/SalesPage';
import { CustomersPage } from './features/customers/CustomersPage';
import { SuppliersPage } from './features/suppliers/SuppliersPage';
import { PurchasesPage } from './features/purchases/PurchasesPage';
import { ReportsPage } from './features/reports/ReportsPage';
import { DrawerPage } from './features/drawer/DrawerPage';
import { UsersPage } from './features/users/UsersPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { HelpPage } from './features/help/HelpPage';

export function App() {
  const { user, loading, refresh } = useAuth();

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (loading) return <div className="flex h-screen items-center justify-center">Loading...</div>;
  if (!user) return <LoginPage />;

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/pos" element={<PosPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/sales" element={<SalesPage />} />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/suppliers" element={<SuppliersPage />} />
        <Route path="/purchases" element={<PurchasesPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/drawer" element={<DrawerPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/help" element={<HelpPage />} />
        <Route path="/help/:slug" element={<HelpPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AppShell>
  );
}
