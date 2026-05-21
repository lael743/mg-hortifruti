import React, { useState, useEffect } from 'react';
import { Link, Outlet, useLocation, useOutletContext, Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Package, Users, ClipboardList, ArrowLeft, Tag, Settings, BarChart2, FileText, MessageCircle, ShieldOff, ShieldCheck, Database, ChevronDown, Megaphone, TrendingUp, UserCheck } from 'lucide-react';
import AdminNotifications from './AdminNotifications';
import { useQuery, useQueryClient as _useQueryClient } from '@tanstack/react-query';
import CompanySettingsDialog from './CompanySettingsDialog';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Link as RouterLink } from 'react-router-dom';

const tabs = [
  { label: 'Dashboard', path: '/admin/dashboard', icon: BarChart2 },
  { label: 'Produtos', path: '/admin', icon: Package },
  { label: 'Pedidos', path: '/admin/orders', icon: ClipboardList },
  { label: 'Clientes', path: '/admin/clients', icon: Users },
  { label: 'Tabelas', path: '/admin/price-groups', icon: Tag },
  { label: 'Relatórios', path: '/admin/reports', icon: FileText },
  { label: 'Chat', path: '/admin/chat', icon: MessageCircle },
  { label: 'Campanha', path: '/admin/campaign', icon: Megaphone },
];

export default function AdminLayout() {
  const { user } = useOutletContext();
  const location = useLocation();
  const [showSettings, setShowSettings] = useState(false);
  const [catalogActive, setCatalogActive] = useState(true);
  const [settingsId, setSettingsId] = useState(null);
  const [toggling, setToggling] = useState(false);
  const queryClient = useQueryClient();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // Load initial unread count
    base44.entities.ChatMessage.list('-created_date', 200).then(msgs => {
      setUnreadCount(msgs.filter(m => !m.is_admin && !m.read_by_admin).length);
    });
    // Subscribe for real-time updates
    const unsub = base44.entities.ChatMessage.subscribe(() => {
      base44.entities.ChatMessage.list('-created_date', 200).then(msgs => {
        setUnreadCount(msgs.filter(m => !m.is_admin && !m.read_by_admin).length);
      });
    });
    return unsub;
  }, []);

  useEffect(() => {
    base44.entities.CompanySettings.list().then(list => {
      if (list[0]) {
        setSettingsId(list[0].id);
        setCatalogActive(list[0].catalog_active !== false);
      }
    });
  }, []);

  const toggleCatalog = async () => {
    if (!settingsId) return;
    setToggling(true);
    const next = !catalogActive;
    await base44.entities.CompanySettings.update(settingsId, { catalog_active: next });
    setCatalogActive(next);
    queryClient.invalidateQueries({ queryKey: ['company-settings'] });
    toast.success(next ? 'Catálogo ativado!' : 'Catálogo em manutenção.');
    setToggling(false);
  };

  const isAdmin = user?.role === 'admin' || user?.role === 'owner';
  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Painel Administrativo</h1>
        <div className="flex gap-2">
          <Button
            variant={catalogActive ? 'outline' : 'destructive'}
            size="sm"
            onClick={toggleCatalog}
            disabled={toggling}
            title={catalogActive ? 'Desativar catálogo (manutenção)' : 'Ativar catálogo'}
          >
            {catalogActive
              ? <><ShieldOff className="w-4 h-4 mr-1" />Desativar Catálogo</>
              : <><ShieldCheck className="w-4 h-4 mr-1" />Ativar Catálogo</>}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1">
                <Settings className="w-4 h-4" />
                <ChevronDown className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => setShowSettings(true)} className="gap-2 cursor-pointer">
                <Settings className="w-4 h-4" />
                Empresa
              </DropdownMenuItem>
              <RouterLink to="/admin/backup">
                <DropdownMenuItem className="gap-2 cursor-pointer">
                  <Database className="w-4 h-4" />
                  Backup
                </DropdownMenuItem>
              </RouterLink>
              <RouterLink to="/financeiro">
                <DropdownMenuItem className="gap-2 cursor-pointer">
                  <TrendingUp className="w-4 h-4" />
                  Financeiro
                </DropdownMenuItem>
              </RouterLink>
              <RouterLink to="/admin/salespersons">
                <DropdownMenuItem className="gap-2 cursor-pointer">
                  <UserCheck className="w-4 h-4" />
                  Vendedores
                </DropdownMenuItem>
              </RouterLink>
            </DropdownMenuContent>
          </DropdownMenu>
          <AdminNotifications />
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
          const isChat = tab.path === '/admin/chat';
          const badge = isChat && unreadCount > 0 ? unreadCount : 0;
          return (
            <Link key={tab.path} to={tab.path} className="flex-1">
              <Button
                variant={isActive ? 'default' : 'ghost'}
                className={`w-full relative ${isActive ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}
                size="sm"
              >
                <Icon className="w-4 h-4 mr-1.5" />{tab.label}
                {badge > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </Button>
            </Link>
          );
        })}
      </div>

      <Outlet context={{ user }} />
    </div>
  );
}