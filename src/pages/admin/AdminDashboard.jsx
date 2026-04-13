import React, { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, ShoppingBag, Users, DollarSign, UserX, Package, Award } from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell
} from 'recharts';
import { format, subDays, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const COLORS = ['#22c55e', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

function InactiveClientTable({ clients }) {
  const handleWhatsApp = (client) => {
    const number = client.whatsapp?.replace(/\D/g, '');
    if (!number) {
      alert('WhatsApp não cadastrado para este cliente.');
      return;
    }
    const contactName = client.contact_name || client.name;
    const msg = encodeURIComponent(`Olá ${contactName}! Temos novidades no catálogo e gostaríamos de receber seu pedido. Acesse e confira as ofertas! 🛒`);
    window.open(`https://wa.me/55${number}?text=${msg}`, '_blank');
  };

  return (
    <div className="divide-y">
      {clients.map(c => (
        <div key={c.email} className="flex items-center gap-3 px-4 py-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{c.name}</p>
            <p className="text-xs text-muted-foreground">{c.email}</p>
          </div>
          {c.daysSince !== null && (
            <span className="text-xs text-muted-foreground whitespace-nowrap">{c.daysSince}d sem comprar</span>
          )}
          <button
            onClick={() => handleWhatsApp(c)}
            title={c.whatsapp ? `WhatsApp: ${c.whatsapp}` : 'WhatsApp não cadastrado'}
            className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors ${
              c.whatsapp
                ? 'bg-green-500 hover:bg-green-600 text-white'
                : 'bg-muted text-muted-foreground cursor-not-allowed'
            }`}
          >
            💬 WhatsApp
          </button>
        </div>
      ))}
    </div>
  );
}

const PERIODS = [
  { label: 'Últimos 7 dias', value: '7d' },
  { label: 'Últimos 30 dias', value: '30d' },
  { label: 'Últimos 90 dias', value: '90d' },
  { label: 'Últimos 6 meses', value: '6m' },
];

export default function AdminDashboard() {
  const [period, setPeriod] = useState('30d');
  const [topMode, setTopMode] = useState('qty');
  const [inactiveDays, setInactiveDays] = useState(30);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['orders-dashboard'],
    queryFn: () => base44.entities.Order.list('-created_date', 1000),
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['users-list'],
    queryFn: () => base44.entities.User.list(),
  });

  const cutoff = useMemo(() => {
    if (period === '7d') return subDays(new Date(), 7);
    if (period === '30d') return subDays(new Date(), 30);
    if (period === '90d') return subDays(new Date(), 90);
    return subMonths(new Date(), 6);
  }, [period]);

  const filtered = useMemo(() =>
    orders.filter(o => o.status !== 'Cancelado' && new Date(o.created_date) >= cutoff),
    [orders, cutoff]
  );

  const totalRevenue = useMemo(() => filtered.reduce((s, o) => s + (o.total || 0), 0), [filtered]);
  const totalOrders = filtered.length;
  const uniqueClientsInPeriod = useMemo(() => new Set(filtered.map(o => o.customer_email)), [filtered]);
  const avgTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // Clients who ordered before but NOT in the selected period
  const inactiveClients = useMemo(() => {
    const emailsBeforePeriod = new Set(
      orders
        .filter(o => o.status !== 'Cancelado' && new Date(o.created_date) < cutoff)
        .map(o => o.customer_email)
    );
    return [...emailsBeforePeriod]
      .filter(e => !uniqueClientsInPeriod.has(e))
      .map(email => {
        const u = allUsers.find(u => u.email === email);
        const lastOrder = orders
          .filter(o => o.customer_email === email && o.status !== 'Cancelado')
          .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))[0];
        const daysSince = lastOrder
          ? Math.floor((new Date() - new Date(lastOrder.created_date)) / 86400000)
          : null;
        return {
          email,
          name: u?.company_name || u?.full_name || email,
          whatsapp: u?.whatsapp || u?.phone || null,
          daysSince,
        };
      })
      .sort((a, b) => (b.daysSince || 0) - (a.daysSince || 0));
  }, [orders, cutoff, uniqueClientsInPeriod, allUsers]);

  // Clients who haven't bought in X days (separate, based on inactiveDays input)
  const notBoughtInDays = useMemo(() => {
    const dayCutoff = subDays(new Date(), inactiveDays);
    const lastOrderByEmail = {};
    orders.filter(o => o.status !== 'Cancelado').forEach(o => {
      const d = new Date(o.created_date);
      if (!lastOrderByEmail[o.customer_email] || d > lastOrderByEmail[o.customer_email].date) {
        lastOrderByEmail[o.customer_email] = { date: d, order: o };
      }
    });
    return Object.entries(lastOrderByEmail)
      .filter(([, v]) => v.date < dayCutoff)
      .map(([email, v]) => {
        const u = allUsers.find(u => u.email === email);
        return {
          email,
          name: u?.company_name || u?.full_name || email,
          whatsapp: u?.whatsapp || u?.phone || null,
          daysSince: Math.floor((new Date() - v.date) / 86400000),
        };
      })
      .sort((a, b) => b.daysSince - a.daysSince);
  }, [orders, inactiveDays, allUsers]);

  // Sales over time
  const salesByDay = useMemo(() => {
    const map = {};
    filtered.forEach(o => {
      const d = format(new Date(o.created_date), period === '6m' ? 'MMM/yy' : 'dd/MM', { locale: ptBR });
      map[d] = (map[d] || 0) + (o.total || 0);
    });
    return Object.entries(map).map(([date, total]) => ({ date, total }));
  }, [filtered, period]);

  // Top products by qty and revenue
  const topProducts = useMemo(() => {
    const map = {};
    filtered.forEach(o => {
      (o.items || []).forEach(item => {
        if (!map[item.product_name]) map[item.product_name] = { name: item.product_name, qty: 0, revenue: 0 };
        map[item.product_name].qty += item.quantity || 0;
        map[item.product_name].revenue += (item.unit_price || 0) * (item.quantity || 0);
      });
    });
    return Object.values(map).sort((a, b) => b[topMode] - a[topMode]).slice(0, 8);
  }, [filtered, topMode]);

  // Top clients by revenue in period
  const topClients = useMemo(() => {
    const map = {};
    filtered.forEach(o => {
      if (!map[o.customer_email]) {
        const u = allUsers.find(u => u.email === o.customer_email);
        map[o.customer_email] = { email: o.customer_email, name: u?.company_name || o.customer_name || o.customer_email, total: 0, orders: 0 };
      }
      map[o.customer_email].total += o.total || 0;
      map[o.customer_email].orders++;
    });
    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 5);
  }, [filtered, allUsers]);

  const stats = [
    { title: 'Faturamento', value: `R$ ${totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: DollarSign, color: 'text-green-600' },
    { title: 'Pedidos', value: totalOrders, icon: ShoppingBag, color: 'text-blue-600' },
    { title: 'Clientes Ativos', value: uniqueClientsInPeriod.size, icon: Users, color: 'text-purple-600' },
    { title: 'Ticket Médio', value: `R$ ${avgTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: TrendingUp, color: 'text-orange-500' },
    { title: 'Clientes Inativos', value: inactiveClients.length, icon: UserX, color: 'text-red-500', subtitle: 'compraram antes mas não no período' },
    { title: 'Produtos Distintos', value: topProducts.length > 0 ? Object.keys((() => { const m = {}; filtered.forEach(o => (o.items||[]).forEach(i => { m[i.product_name] = 1; })); return m; })()).length : 0, icon: Package, color: 'text-teal-600' },
  ];

  if (isLoading) return (
    <div className="p-6 space-y-4">
      {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
    </div>
  );

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIODS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {stats.map(s => (
          <Card key={s.title}>
            <CardContent className="p-4 flex items-start gap-3">
              <div className={`p-2 rounded-lg bg-muted ${s.color} flex-shrink-0`}>
                <s.icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground leading-tight">{s.title}</p>
                <p className="text-lg font-bold leading-tight">{s.value}</p>
                {s.subtitle && <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{s.subtitle}</p>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Sales Area Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Faturamento no Período</CardTitle>
        </CardHeader>
        <CardContent>
          {salesByDay.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">Sem dados no período</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={salesByDay}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={v => [`R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Faturamento']} />
                <Area type="monotone" dataKey="total" stroke="#22c55e" strokeWidth={2} fill="url(#colorTotal)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Award className="w-4 h-4 text-primary" /> Produtos Mais Vendidos
              </CardTitle>
              <div className="flex gap-1">
                <button
                  onClick={() => setTopMode('qty')}
                  className={`text-xs px-2 py-1 rounded ${topMode === 'qty' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
                >
                  Qtd.
                </button>
                <button
                  onClick={() => setTopMode('revenue')}
                  className={`text-xs px-2 py-1 rounded ${topMode === 'revenue' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
                >
                  R$
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {topProducts.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">Sem dados no período</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={topProducts} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={topMode === 'revenue' ? v => `R$${(v/1000).toFixed(0)}k` : undefined} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={90} />
                  <Tooltip formatter={v => topMode === 'revenue'
                    ? [`R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Receita']
                    : [v, 'Quantidade']} />
                  <Bar dataKey={topMode} radius={[0, 4, 4, 0]}>
                    {topProducts.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Top Clients */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" /> Top Clientes no Período
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topClients.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">Sem dados no período</p>
            ) : (
              <div className="space-y-2">
                {topClients.map((c, i) => (
                  <div key={c.email} className="flex items-center gap-3 py-2 border-b last:border-0">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0`}
                      style={{ backgroundColor: COLORS[i % COLORS.length] }}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.orders} pedido(s)</p>
                    </div>
                    <p className="text-sm font-bold text-primary whitespace-nowrap">
                      R$ {c.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Inactive in period */}
      {inactiveClients.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <UserX className="w-4 h-4 text-red-500" /> Não compraram no período selecionado ({inactiveClients.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <InactiveClientTable clients={inactiveClients} />
          </CardContent>
        </Card>
      )}

      {/* Not bought in X days */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <UserX className="w-4 h-4 text-orange-500" /> Sem compras há mais de
            </CardTitle>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                value={inactiveDays}
                onChange={e => setInactiveDays(Number(e.target.value))}
                className="w-20 h-8 text-sm"
              />
              <span className="text-sm text-muted-foreground">dias ({notBoughtInDays.length} clientes)</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {notBoughtInDays.length === 0
            ? <p className="text-sm text-muted-foreground text-center py-6">Nenhum cliente nesse critério.</p>
            : <InactiveClientTable clients={notBoughtInDays} />}
        </CardContent>
      </Card>
    </div>
  );
}