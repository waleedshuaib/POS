import { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuth, hasRole } from '../features/auth/authStore';
import i18n from '../i18n';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Boxes,
  Receipt,
  Users,
  Truck,
  ClipboardList,
  BarChart3,
  Banknote,
  UserCog,
  Settings,
  HelpCircle,
  LogOut,
  Globe,
  Scale,
} from 'lucide-react';

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  roles?: Array<'admin' | 'manager' | 'cashier'>;
}

export function AppShell({ children }: { children: ReactNode }) {
  const { t, i18n: i18nInstance } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const lang = i18nInstance.language as 'ar' | 'en';

  const settings = useQuery({
    queryKey: ['settings'],
    queryFn: () => api<Record<string, string>>('settings.getAll', {}),
    staleTime: 60_000,
  });
  const storeName = lang === 'ar' ? settings.data?.['store.name_ar'] : settings.data?.['store.name_en'];

  const nav: NavItem[] = [
    { to: '/dashboard', label: t('nav.dashboard'), icon: <LayoutDashboard size={18} /> },
    { to: '/pos', label: t('nav.pos'), icon: <ShoppingCart size={18} /> },
    { to: '/products', label: t('nav.products'), icon: <Package size={18} /> },
    { to: '/inventory', label: t('nav.inventory'), icon: <Boxes size={18} /> },
    { to: '/sales', label: t('nav.sales'), icon: <Receipt size={18} /> },
    { to: '/customers', label: t('nav.customers'), icon: <Users size={18} /> },
    { to: '/suppliers', label: t('nav.suppliers'), icon: <Truck size={18} />, roles: ['admin', 'manager'] },
    { to: '/purchases', label: t('nav.purchases'), icon: <ClipboardList size={18} />, roles: ['admin', 'manager'] },
    { to: '/reports', label: t('nav.reports'), icon: <BarChart3 size={18} />, roles: ['admin', 'manager'] },
    { to: '/drawer', label: t('nav.drawer'), icon: <Banknote size={18} /> },
    { to: '/users', label: t('nav.users'), icon: <UserCog size={18} />, roles: ['admin'] },
    { to: '/settings', label: t('nav.settings'), icon: <Settings size={18} />, roles: ['admin', 'manager'] },
    { to: '/help', label: t('nav.help'), icon: <HelpCircle size={18} /> },
  ];

  const visible = nav.filter((n) => !n.roles || hasRole(user, ...n.roles));

  async function onLogout() {
    await logout();
    navigate('/');
  }

  function toggleLang() {
    i18n.changeLanguage(i18n.language === 'ar' ? 'en' : 'ar');
  }

  const initials = (user?.fullName ?? user?.username ?? '?').slice(0, 1).toUpperCase();

  return (
    <div className="h-screen flex overflow-hidden bg-slate-50">
      <aside className="w-60 flex-shrink-0 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800 text-slate-100 flex flex-col h-full">
        {/* Brand */}
        <div className="p-4 border-b border-slate-800/60 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-lg">
            <Scale size={20} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-base truncate">{t('app.title')}</div>
            <div className="text-[11px] text-slate-400 truncate" title={storeName ?? ''}>
              {storeName ?? t('app.tagline')}
            </div>
          </div>
        </div>

        {/* User chip */}
        <div className="p-3 border-b border-slate-800/60 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-brand-600 text-white grid place-items-center font-semibold">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{user?.fullName}</div>
            <div className="text-[11px] text-slate-400">{user && t(`users.role.${user.role}`)}</div>
          </div>
        </div>

        {/* Nav (scrolls only if it overflows) */}
        <nav className="flex-1 overflow-y-auto p-2 space-y-1">
          {visible.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                  isActive ? 'bg-brand-600 text-white shadow-sm' : 'hover:bg-slate-800/80'
                }`
              }
            >
              {n.icon}
              <span>{n.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-2 border-t border-slate-800/60 space-y-1">
          <button
            onClick={toggleLang}
            className="w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-slate-800/80"
          >
            <Globe size={18} />
            <span>{i18n.language === 'ar' ? 'English' : 'العربية'}</span>
          </button>
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-red-600/20 text-red-300"
          >
            <LogOut size={18} />
            <span>{t('nav.logout')}</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-[1600px] mx-auto">{children}</div>
      </main>
    </div>
  );
}
