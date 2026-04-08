import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, ShoppingBag, Users, DollarSign } from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell
} from 'recharts';
import { format, subDays, subMonths, startOfDay, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const COLORS = ['#22c55e', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

const PERIODS = [
  { label: 'Últimos 7 dias', value: '7d' },
  { label: 'Últimos 30 dias', value: '30d' },
  { label: 'Últimos 90 dias', value: '90d' },
  { label: 'Últimos 6 meses', value: '6m' },
];

export default function AdminDashboard() {
  const [period, setPeriod] = useState('30d');

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['orders-dashboard'],
    queryFn: () => base44.entities.Order.list('-created_date', 500),
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
  const uniqueClients = useMemo(() => new Set(filtered.map(o => o.customer_email)).size, [filtered]);
  const avgTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // Sales over time
  const salesByDay = useMemo(() => {
    const map = {};
    filtered.forEach(o => {
      const d = format(new Date(o.created_date), period === '6m' ? 'MMM/yy' : 'dd/MM', { locale: ptBR });
      map[d] = (map[d] || 0) + (o.total || 0);
    });
    return Object.entries(map).map(([date, total]) => ({ date, total }));
  }, [filtered, period]);

  // Top products
  const topProducts = useMemo(() => {
    const map = {};
    filtered.forEach(o => {
      (o.items || []).forEach(item => {
        if (!map[item.product_name]) map[item.product_name] = { name: item.product_name, qty: 0, revenue: 0 };
        map[item.product_name].qty += item.quantity || 0;
        map[item.product_name].revenue += (item.unit_price || 0) * (item.quantity || 0);
      });
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 8);
  }, [filtered]);

  const stats = [
    { title: 'Faturamento', value: `R$ ${totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: DollarSign, color: 'text-green-600' },
    { title: 'Pedidos', value: totalOrders, icon: ShoppingBag, color: 'text-blue-600' },
    { title: 'Clientes Únicos', value: uniqueClients, icon: Users, color: 'text-purple-600' },
    { title: 'Ticket Médio', value: `R$ ${avgTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: TrendingUp, color: 'text-orange-500' },
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <Card key={s.title}>
            <CardContent className="p-4 flex items-start gap-3">
              <div className={`p-2 rounded-lg bg-muted ${s.color}`}>
                <s.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{s.title}</p>
                <p className="text-lg font-bold leading-tight">{s.value}</p>
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

      {/* Top Products */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Produtos Mais Vendidos (por faturamento)</CardTitle>
        </CardHeader>
        <CardContent>
          {topProducts.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">Sem dados no período</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={topProducts} layout="vertical" margin={{ left: 16 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
                <Tooltip formatter={v => [`R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Receita']} />
                <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                  {topProducts.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}