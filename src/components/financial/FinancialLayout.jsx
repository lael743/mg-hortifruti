import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import {
  LayoutDashboard, ArrowLeftRight, Tag, Users2, FileText,
  CheckSquare, ChevronLeft, Menu, X, TrendingUp, BarChart2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const navItems = [
  { label: 'Dashboard', path: '/financeiro', icon: LayoutDashboard },
  { label: 'Lançamentos', path: '/financeiro/lancamentos', icon: ArrowLeftRight },
  { label: 'Boletos', path: '/financeiro/boletos', icon: FileText },
  { label: 'Cheques', path: '/financeiro/cheques', icon: CheckSquare },
  { label: 'Fornecedores', path: '/financeiro/fornecedores', icon: Users2 },
  { label: 'Categorias', path: '/financeiro/categorias', icon: Tag },
  { label: 'Relatórios', path: '/financeiro/relatorios', icon: BarChart2 },
];

export default function FinancialLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const isActive = (path) => {
    if (path === '/financeiro') return location.pathname === '/financeiro';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-60 bg-card border-r flex flex-col transition-transform duration-200 shadow-lg",
        sidebarOpen ? "translate-x-0" : "-translate-x-full",
        "lg:translate-x-0 lg:static lg:shadow-none"
      )}>
        {/* Logo */}
        <div className="flex items-center gap-2 px-5 py-4 border-b">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-base">Financeiro</span>
          <button className="ml-auto lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(({ label, path, icon: Icon }) => (
            <button
              key={path}
              onClick={() => { navigate(path); setSidebarOpen(false); }}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left",
                isActive(path)
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </button>
          ))}
        </nav>

        {/* Back to admin */}
        <div className="p-3 border-t">
          <button
            onClick={() => navigate('/admin')}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Voltar ao painel
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 border-b bg-card sticky top-0 z-30">
          <button onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <span className="font-bold">Financeiro</span>
          </div>
        </header>

        <div className="flex-1 overflow-auto">
          <Outlet context={{ user }} />
        </div>
      </div>
    </div>
  );
}