import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Download, Search, FileText, Filter } from 'lucide-react';


function parseAsUTC(dateInput) {
  if (dateInput instanceof Date) return dateInput;
  let str = String(dateInput);
  if (!str.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(str)) {
    str = str + 'Z';
  }
  return new Date(str);
}

function formatLocalDateTime(dateInput) {
  const date = parseAsUTC(dateInput);
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Porto_Velho',
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).formatToParts(date);
  const p = Object.fromEntries(parts.map(x => [x.type, x.value]));
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}

const STATUS_COLORS = {
  Pendente: 'bg-yellow-100 text-yellow-800',
  Confirmado: 'bg-blue-100 text-blue-800',
  Entregue: 'bg-green-100 text-green-800',
  Cancelado: 'bg-red-100 text-red-800',
};

export default function AdminReports() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Porto_Velho' });
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toLocaleDateString('en-CA', { timeZone: 'America/Porto_Velho' });
  const [dateStart, setDateStart] = useState(firstOfMonth);
  const [dateEnd, setDateEnd] = useState(today);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['orders-reports'],
    queryFn: () => base44.entities.Order.list('-created_date', 1000),
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['users-list'],
    queryFn: () => base44.entities.User.list(),
  });

  const userByEmail = useMemo(() => {
    const map = {};
    allUsers.forEach(u => { map[u.email] = u; });
    return map;
  }, [allUsers]);

  const filtered = useMemo(() => {
    return orders.filter(o => {
      const orderDateStr = parseAsUTC(o.created_date).toLocaleDateString('en-CA', { timeZone: 'America/Porto_Velho' });
      const inRange = (!dateStart || orderDateStr >= dateStart) && (!dateEnd || orderDateStr <= dateEnd);
      const inStatus = statusFilter === 'all' || o.status === statusFilter;
      const u = userByEmail[o.customer_email] || {};
      const inSearch = !search ||
        (o.customer_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (u.company_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (o.customer_email || '').toLowerCase().includes(search.toLowerCase());
      return inRange && inStatus && inSearch;
    });
  }, [orders, dateStart, dateEnd, statusFilter, search]);

  const summary = useMemo(() => ({
    total: filtered.reduce((s, o) => s + (o.total || 0), 0),
    count: filtered.length,
    delivered: filtered.filter(o => o.status === 'Entregue').reduce((s, o) => s + (o.total || 0), 0),
    pending: filtered.filter(o => o.status === 'Pendente').length,
    cancelled: filtered.filter(o => o.status === 'Cancelado').length,
  }), [filtered]);

  const handleExportCSV = () => {
    const rows = [
      ['Data', 'Cliente', 'Email', 'Status', 'Subtotal', 'Desconto', 'Total', 'Itens'],
      ...filtered.map(o => [
        formatLocalDateTime(o.created_date),
        o.customer_name || '',
        o.customer_email || '',
        o.status || '',
        (o.subtotal ?? o.total ?? 0).toFixed(2),
        (o.discount_amount || 0).toFixed(2),
        (o.total || 0).toFixed(2),
        (o.items || []).map(i => `${i.quantity}x ${i.product_name}`).join('; '),
      ])
    ];
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-${dateStart || 'inicio'}-${dateEnd || 'fim'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    const periodLabel = dateStart && dateEnd ? `${dateStart} a ${dateEnd}` : 'Período selecionado';
    const rows = filtered.map(o => `
      <tr>
        <td>${formatLocalDateTime(o.created_date)}</td>
        <td>${userByEmail[o.customer_email]?.company_name || o.customer_name || o.customer_email}</td>
        <td>${o.status}</td>
        <td>${(o.items || []).length} item(s)</td>
        <td style="text-align:right">
          R$ ${(o.total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          ${o.discount_amount > 0 ? `<br/><span style="font-size:10px;color:#16a34a;">🏷️ Desc. -R$ ${o.discount_amount.toFixed(2)}</span>` : ''}
        </td>
      </tr>
    `).join('');
    const html = `
      <html><head><title>Relatório ${periodLabel}</title>
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
        <h2>Relatório — ${periodLabel}</h2>
        <p>Gerado em ${formatLocalDateTime(new Date())}</p>
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
        <h1 className="text-2xl font-bold">Relatórios</h1>
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
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground whitespace-nowrap">De</label>
              <Input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} className="w-36" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground whitespace-nowrap">Até</label>
              <Input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} className="w-36" />
            </div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="all">Todos os status</option>
              <option value="Pendente">Pendente</option>
              <option value="Confirmado">Confirmado</option>
              <option value="Entregue">Entregue</option>
              <option value="Cancelado">Cancelado</option>
            </select>
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
                        {formatLocalDateTime(order.created_date)}
                      </td>
                      <td className="p-3">
                        <p className="font-medium">{userByEmail[order.customer_email]?.company_name || order.customer_name || '—'}</p>
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
                        {order.discount_amount > 0 && (
                          <span className="block text-[10px] text-green-600 font-normal">
                            🏷️ − R$ {order.discount_amount.toFixed(2)}
                          </span>
                        )}
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