import React, { useState } from 'react';
import { Link, Outlet, useLocation, useOutletContext, Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Package, Users, ClipboardList, ArrowLeft, Tag, Settings, BarChart2, FileText, MessageCircle } from 'lucide-react';
import CompanySettingsDialog from './CompanySettingsDialog';

const tabs = [
  { label: 'Dashboard', path: '/admin/dashboard', icon: BarChart2 },
  { label: 'Produtos', path: '/admin', icon: Package },
  { label: 'Pedidos', path: '/admin/orders', icon: ClipboardList },
  { label: 'Clientes', path: '/admin/clients', icon: Users },
  { label: 'Tabelas', path: '/admin/price-groups', icon: Tag },
  { label: 'Relatórios', path: '/admin/reports', icon: FileText },
  { label: 'Chat', path: '/admin/chat', icon: MessageCircle },
];

export default function AdminLayout() {
  const { user } = useOutletContext();
  const location = useLocation();
  const [showSettings, setShowSettings] = useState(false);

  if (!user || user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Painel Administrativo</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowSettings(true)}>
            <Settings className="w-4 h-4 mr-1" />Empresa
          </Button>
          <Link to="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-1" />Catálogo
            </Button>
          </Link>
        </div>
      </div>
      {showSettings && <CompanySettingsDialog onClose={() => setShowSettings(false)} />}

      <div className="flex gap-1 bg-muted p-1 rounded-xl">
        {tabs.map(tab => {
          const isActive = location.pathname === tab.path;
          const Icon = tab.icon;
          return (
            <Link key={tab.path} to={tab.path} className="flex-1">
              <Button
                variant={isActive ? 'default' : 'ghost'}
                className={`w-full ${isActive ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}
                size="sm"
              >
                <Icon className="w-4 h-4 mr-1.5" />{tab.label}
              </Button>
            </Link>
          );
        })}
      </div>

      <Outlet context={{ user }} />
    </div>
  );
}