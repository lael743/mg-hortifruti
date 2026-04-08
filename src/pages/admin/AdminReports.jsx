import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Download, Search, FileText, Filter } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths, parseISO, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const STATUS_COLORS = {
  Pendente: 'bg-yellow-100 text-yellow-800',
  Confirmado: 'bg-blue-100 text-blue-800',
  Entregue: 'bg-green-100 text-green-800',
  Cancelado: 'bg-red-100 text-red-800',
};

const MONTHS = Array.from({ length: 12 }, (_, i) => {
  const d = subMonths(new Date(), i);
  return { label: format(d, 'MMMM yyyy', { locale: ptBR }), value: format(d, 'yyyy-MM') };
});

export default function AdminReports() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState(format(new Date(), 'yyyy-MM'));

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['orders-reports'],
    queryFn: () => base44.entities.Order.list('-created_date', 1000),
  });

  const filtered = useMemo(() => {
    const [year, month] = monthFilter.split('-').map(Number);
    const start = startOfMonth(new Date(year, month - 1));
    const end = endOfMonth(new Date(year, month - 1));

    return orders.filter(o => {
      const inMonth = isWithinInterval(new Date(o.created_date), { start, end });
      const inStatus = statusFilter === 'all' || o.status === statusFilter;
      const inSearch = !search || 
        (o.customer_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (o.customer_email || '').toLowerCase().includes(search.toLowerCase());
      return inMonth && inStatus && inSearch;
    });
  }, [orders, monthFilter, statusFilter, search]);

  const summary = useMemo(() => ({
    total: filtered.reduce((s, o) => s + (o.total || 0), 0),
    count: filtered.length,
    delivered: filtered.filter(o => o.status === 'Entregue').reduce((s, o) => s + (o.total || 0), 0),
    pending: filtered.filter(o => o.status === 'Pendente').length,
    cancelled: filtered.filter(o => o.status === 'Cancelado').length,
  }), [filtered]);

  const handleExportCSV = () => {
    const rows = [
      ['Data', 'Cliente', 'Email', 'Status', 'Total', 'Itens'],
      ...filtered.map(o => [
        format(new Date(o.created_date), 'dd/MM/yyyy HH:mm'),
        o.customer_name || '',
        o.customer_email || '',
        o.status || '',
        (o.total || 0).toFixed(2),
        (o.items || []).map(i => `${i.quantity}x ${i.product_name}`).join('; '),
      ])
    ];
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-${monthFilter}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    const [year, month] = monthFilter.split('-').map(Number);
    const monthLabel = format(new Date(year, month - 1), 'MMMM yyyy', { locale: ptBR });
    const rows = filtered.map(o => `
      <tr>
        <td>${format(new Date(o.created_date), 'dd/MM/yyyy')}</td>
        <td>${o.customer_name || o.customer_email}</td>
        <td>${o.status}</td>
        <td>${(o.items || []).length} item(s)</td>
        <td style="text-align:right">R$ ${(o.total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
      </tr>
    `).join('');
    const html = `
      <html><head><title>Relatório ${monthLabel}</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 12px; padding: 24px; }
        h2 { margin-bottom: 4px; } p { color: #666; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 6px 8px; }
        th { background: #f5f5f5; font-weight: 600; }
        tfoot td { font-weight: bold; background: #f9f9f9; }
        .summary { display: flex; gap: 24px; margin-bottom: 16px; }
        .stat { background: #f5f5f5; border-radius: 6px; padding: 8px 16px; }
        .stat b { display: block; font-size: 18px; }
      </style></head>
      <body>
        <h2>Relatório Mensal — ${monthLabel}</h2>
        <p>Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}</p>
        <div class="summary">
          <div class="stat"><b>${summary.count}</b>Pedidos</div>
          <div class="stat"><b>R$ ${summary.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</b>Faturamento Bruto</div>
          <div class="stat"><b>R$ ${summary.delivered.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</b>Entregues</div>
          <div class="stat"><b>${summary.cancelled}</b>Cancelados</div>
        </div>
        <table>
          <thead><tr><th>Data</th><th>Cliente</th><th>Status</th><th>Itens</th><th>Total</th></tr></thead>
          <tbody>${rows}</tbody>
          <tfoot><tr>
            <td colspan="4">TOTAL (${summary.count} pedidos)</td>
            <td style="text-align:right">R$ ${summary.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
          </tr></tfoot>
        </table>
      </body></html>
    `;
    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
    w.print();
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Relatórios Mensais</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrint} size="sm">
            <FileText className="w-4 h-4 mr-1" /> Imprimir
          </Button>
          <Button onClick={handleExportCSV} size="sm">
            <Download className="w-4 h-4 mr-1" /> Exportar CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
              <Filter className="w-4 h-4" /> Filtros
            </div>
            <Select value={monthFilter} onValueChange={setMonthFilter}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map(m => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="Pendente">Pendente</SelectItem>
                <SelectItem value="Confirmado">Confirmado</SelectItem>
                <SelectItem value="Entregue">Entregue</SelectItem>
                <SelectItem value="Cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Buscar cliente..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total de Pedidos', value: summary.count },
          { label: 'Faturamento Bruto', value: `R$ ${summary.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` },
          { label: 'Valor Entregue', value: `R$ ${summary.delivered.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` },
          { label: 'Pendentes', value: summary.pending },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-xl font-bold mt-1">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Orders Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{filtered.length} pedido(s) encontrado(s)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">Nenhum pedido encontrado para os filtros selecionados.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-semibold">Data</th>
                    <th className="text-left p-3 font-semibold">Cliente</th>
                    <th className="text-left p-3 font-semibold">Itens</th>
                    <th className="text-left p-3 font-semibold">Status</th>
                    <th className="text-right p-3 font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(order => (
                    <tr key={order.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                      <td className="p-3 text-muted-foreground whitespace-nowrap">
                        {format(new Date(order.created_date), 'dd/MM/yyyy HH:mm')}
                      </td>
                      <td className="p-3">
                        <p className="font-medium">{order.customer_name || '—'}</p>
                        <p className="text-xs text-muted-foreground">{order.customer_email}</p>
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {(order.items || []).length} item(s)
                      </td>
                      <td className="p-3">
                        <Badge className={`${STATUS_COLORS[order.status]} border-0 text-xs`}>
                          {order.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-right font-semibold text-primary">
                        R$ {(order.total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-muted/50 border-t-2 border-border">
                  <tr>
                    <td colSpan={4} className="p-3 font-bold">Total ({filtered.length} pedidos)</td>
                    <td className="p-3 text-right font-bold text-primary text-base">
                      R$ {summary.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}