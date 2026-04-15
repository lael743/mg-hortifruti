import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Printer, Eye, ChevronDown, Building2, MapPin, FileText, ShoppingBasket, X, MessageCircle, Users, Pencil } from 'lucide-react';
import OrderEditDialog from '../../components/admin/OrderEditDialog';
import { format, startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import OrderPurchaseListDialog from '../../components/admin/OrderPurchaseListDialog';

const statusColors = {
  Pendente: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  Confirmado: 'bg-blue-100 text-blue-800 border-blue-200',
  Entregue: 'bg-green-100 text-green-800 border-green-200',
  Cancelado: 'bg-red-100 text-red-800 border-red-200',
};

const STATUSES = ['Todos', 'Pendente', 'Confirmado', 'Entregue', 'Cancelado'];

const PERIOD_OPTIONS = [
  { value: 'all', label: 'Todos os períodos' },
  { value: 'today', label: 'Hoje' },
  { value: 'yesterday', label: 'Ontem' },
  { value: 'week', label: 'Esta semana' },
  { value: 'month', label: 'Este mês' },
  { value: 'custom', label: 'Período personalizado' },
];

function getPeriodRange(period, customStart, customEnd) {
  const now = new Date();
  switch (period) {
    case 'today': return [startOfDay(now), endOfDay(now)];
    case 'yesterday': { const y = subDays(now, 1); return [startOfDay(y), endOfDay(y)]; }
    case 'week': return [startOfWeek(now, { locale: ptBR }), endOfWeek(now, { locale: ptBR })];
    case 'month': return [startOfMonth(now), endOfMonth(now)];
    case 'custom': return [
      customStart ? startOfDay(new Date(customStart)) : null,
      customEnd ? endOfDay(new Date(customEnd)) : null,
    ];
    default: return [null, null];
  }
}

export default function AdminOrders() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [period, setPeriod] = useState('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [groupFilter, setGroupFilter] = useState(''); // city or company_name filter
  const [showPurchaseList, setShowPurchaseList] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['admin-orders'],
    queryFn: () => base44.entities.Order.list('-created_date'),
  });

  const { data: settings = [] } = useQuery({
    queryKey: ['company-settings'],
    queryFn: () => base44.entities.CompanySettings.list(),
  });
  const company = settings[0];

  const { data: users = [] } = useQuery({
    queryKey: ['admin-clients'],
    queryFn: () => base44.entities.User.list(),
  });

  const userByEmail = Object.fromEntries(users.map(u => [u.email, u]));

  // Unique cities for quick group filter
  const cities = [...new Set(users.map(u => u.city).filter(Boolean))].sort();

  const updateMutation = useMutation({
    mutationFn: ({ id, status }) => base44.entities.Order.update(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      toast.success('Status atualizado');
    },
  });

  const updateOrderItemsMutation = useMutation({
    mutationFn: ({ id, items, total }) => base44.entities.Order.update(id, { items, total }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      toast.success('Pedido atualizado com sucesso');
      setEditingOrder(null);
    },
  });

  const [periodStart, periodEnd] = getPeriodRange(period, customStart, customEnd);

  const filtered = orders.filter(o => {
    const u = userByEmail[o.customer_email] || {};

    const matchSearch = !search ||
      o.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      o.customer_email?.toLowerCase().includes(search.toLowerCase()) ||
      u?.company_name?.toLowerCase().includes(search.toLowerCase()) ||
      u?.cnpj_cpf?.toLowerCase().includes(search.toLowerCase()) ||
      u?.city?.toLowerCase().includes(search.toLowerCase());

    const matchStatus = statusFilter === 'Todos' || o.status === statusFilter;

    const orderDate = new Date(o.created_date);
    const matchPeriod = (!periodStart || orderDate >= periodStart) && (!periodEnd || orderDate <= periodEnd);

    const matchGroup = !groupFilter ||
      u?.city?.toLowerCase().includes(groupFilter.toLowerCase()) ||
      u?.company_name?.toLowerCase().includes(groupFilter.toLowerCase());

    return matchSearch && matchStatus && matchPeriod && matchGroup;
  });

  // Label for the purchase list dialog
  const periodLabel = (() => {
    const base = PERIOD_OPTIONS.find(p => p.value === period)?.label || 'Todos';
    const parts = [base];
    if (period === 'custom' && (customStart || customEnd)) {
      parts[0] = `${customStart || '?'} a ${customEnd || '?'}`;
    }
    if (groupFilter) parts.push(`Grupo: "${groupFilter}"`);
    if (statusFilter !== 'Todos') parts.push(`Status: ${statusFilter}`);
    if (search) parts.push(`Busca: "${search}"`);
    return parts.join(' • ');
  })();

  const handlePrintAllClients = () => {
    // Group filtered orders by customer_email
    const grouped = {};
    filtered.forEach(order => {
      if (!grouped[order.customer_email]) grouped[order.customer_email] = [];
      grouped[order.customer_email].push(order);
    });

    const companyHeader = `
      <div class="company-header">
        ${company?.logo_url ? `<img src="${company.logo_url}" style="height:48px;object-fit:contain;margin-bottom:6px;" />` : ''}
        <h2 style="margin:0;font-size:16px;">${company?.company_name || 'Empresa'}</h2>
        ${company?.address ? `<p style="margin:2px 0;font-size:11px;color:#555;">${company.address}${company.city ? `, ${company.city}` : ''}${company.state ? ` - ${company.state}` : ''}</p>` : ''}
        ${company?.whatsapp ? `<p style="margin:2px 0;font-size:11px;color:#555;">WhatsApp: ${company.whatsapp}</p>` : ''}
        ${company?.cnpj ? `<p style="margin:2px 0;font-size:11px;color:#555;">CNPJ: ${company.cnpj}</p>` : ''}
      </div>`;

    const clientPages = Object.entries(grouped).map(([email, clientOrders], index) => {
      const u = userByEmail[email] || {};
      const orderBlocks = clientOrders.map(order => {
        const itemsRows = (order.items || []).map(item => `
          <tr>
            <td>${item.product_name}</td>
            <td style="text-align:center;">${item.packaging_type || '—'}</td>
            <td style="text-align:center;">${item.weight || '—'}</td>
            <td style="text-align:center;font-weight:bold;">${item.quantity}</td>
            <td style="text-align:right;">R$ ${item.unit_price?.toFixed(2)}</td>
            <td style="text-align:right;">R$ ${(item.unit_price * item.quantity).toFixed(2)}</td>
          </tr>`).join('');
        return `
          <div class="order-block">
            <div class="order-header">
              <span>Pedido #${order.order_number || '—'}</span>
              <span>${format(new Date(order.created_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
              <span class="status-badge status-${order.status}">${order.status}</span>
            </div>
            <table>
              <thead><tr>
                <th style="text-align:left;">Produto</th>
                <th style="text-align:center;">Embalagem</th>
                <th style="text-align:center;">Peso</th>
                <th style="text-align:center;">Qtd</th>
                <th style="text-align:right;">Unit.</th>
                <th style="text-align:right;">Subtotal</th>
              </tr></thead>
              <tbody>${itemsRows}</tbody>
              <tfoot><tr>
                <td colspan="5" style="text-align:right;font-weight:bold;">Total do pedido:</td>
                <td style="text-align:right;font-weight:bold;">R$ ${order.total?.toFixed(2)}</td>
              </tr></tfoot>
            </table>
            ${order.notes ? `<p style="margin-top:6px;font-size:11px;color:#666;"><strong>Obs:</strong> ${order.notes}</p>` : ''}
          </div>`;
      }).join('');

      const clientTotal = clientOrders.reduce((s, o) => s + (o.total || 0), 0);

      return `
        <div class="client-page${index > 0 ? ' page-break' : ''}">
          ${companyHeader}
          <div class="client-info">
            <h3>${u.company_name || clientOrders[0]?.customer_name || email}</h3>
            ${u.company_name && clientOrders[0]?.customer_name ? `<p><strong>Contato:</strong> ${clientOrders[0].customer_name}</p>` : ''}
            ${u.cnpj_cpf ? `<p><strong>CNPJ/CPF:</strong> ${u.cnpj_cpf}</p>` : ''}
            ${u.address ? `<p><strong>Endereço:</strong> ${u.address}${u.city ? `, ${u.city}` : ''}${u.state ? ` - ${u.state}` : ''}</p>` : ''}
            ${u.whatsapp ? `<p><strong>WhatsApp:</strong> ${u.whatsapp}</p>` : ''}
            <p><strong>Email:</strong> ${email}</p>
            ${!u.company_name && clientOrders[0]?.customer_name ? `<p><strong>Nome:</strong> ${clientOrders[0].customer_name}</p>` : ''}
          </div>
          ${orderBlocks}
          <div class="client-total">Total geral do cliente: <strong>R$ ${clientTotal.toFixed(2)}</strong> (${clientOrders.length} pedido${clientOrders.length > 1 ? 's' : ''})</div>
          <div class="print-footer">Impresso em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")} &nbsp;|&nbsp; ${company?.company_name || ''}</div>
        </div>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Espelho de Pedidos</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: Arial, sans-serif; font-size: 12px; color: #222; }
      .client-page { padding: 20px 24px; }
      .page-break { page-break-before: always; }
      .company-header { border-bottom: 2px solid #2d7a3a; padding-bottom: 10px; margin-bottom: 14px; }
      .company-header h2 { color: #2d7a3a; }
      .client-info { background: #f5f5f5; border-left: 4px solid #2d7a3a; padding: 10px 14px; margin-bottom: 14px; border-radius: 0 6px 6px 0; }
      .client-info h3 { font-size: 15px; margin-bottom: 4px; }
      .client-info p { font-size: 11px; color: #444; margin: 2px 0; }
      .order-block { margin-bottom: 16px; }
      .order-header { display: flex; gap: 16px; align-items: center; background: #2d7a3a; color: #fff; padding: 5px 10px; border-radius: 4px 4px 0 0; font-size: 11px; font-weight: bold; }
      .status-badge { padding: 1px 6px; border-radius: 10px; font-size: 10px; background: rgba(255,255,255,0.25); }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #ddd; padding: 5px 8px; font-size: 11px; }
      thead th { background: #e8f5e9; font-weight: 600; }
      tfoot td { background: #f9f9f9; }
      tbody tr:nth-child(even) { background: #fafafa; }
      .client-total { text-align: right; margin-top: 10px; font-size: 13px; border-top: 2px solid #2d7a3a; padding-top: 6px; }
      .print-footer { text-align: center; font-size: 10px; color: #aaa; margin-top: 16px; border-top: 1px solid #eee; padding-top: 6px; }
      @media print { @page { margin: 10mm; size: A4; } body { font-size: 11px; } }
    </style></head>
    <body>${clientPages}</body></html>`;

    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 400);
  };

  const handlePrintSeparation = (order) => {
    const u = userByEmail[order.customer_email] || {};
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html><head><title>Lista de Separação - ${order.customer_name || order.customer_email}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 24px; color: #222; }
        h1 { font-size: 20px; margin-bottom: 4px; }
        .meta { font-size: 13px; color: #555; margin-bottom: 16px; }
        .meta p { margin: 2px 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th, td { padding: 10px 12px; text-align: left; border: 1px solid #ddd; font-size: 13px; }
        th { background: #f0f0f0; font-weight: 600; }
        .total { text-align: right; margin-top: 16px; font-size: 15px; }
        .footer { margin-top: 32px; font-size: 12px; color: #888; border-top: 1px solid #eee; padding-top: 8px; }
      </style></head><body>
      <h1>Lista de Separação</h1>
      <div class="meta">
        <p><strong>Cliente:</strong> ${order.customer_name || order.customer_email}</p>
        ${u.company_name ? `<p><strong>Empresa:</strong> ${u.company_name}</p>` : ''}
        ${u.cnpj_cpf ? `<p><strong>CNPJ/CPF:</strong> ${u.cnpj_cpf}</p>` : ''}
        ${u.address ? `<p><strong>Endereço:</strong> ${u.address}</p>` : ''}
        ${(u.city || u.state) ? `<p><strong>Cidade:</strong> ${[u.city, u.state].filter(Boolean).join(' - ')}</p>` : ''}
        ${u.whatsapp ? `<p><strong>WhatsApp:</strong> ${u.whatsapp}</p>` : ''}
        <p><strong>Data do pedido:</strong> ${format(new Date(order.created_date), "dd/MM/yyyy HH:mm")}</p>
        <p><strong>Pedido #:</strong> ${order.order_number}</p>
      </div>
      <table>
        <tr><th>Produto</th><th>Embalagem</th><th>Peso</th><th>Qtd</th><th>Unit.</th><th>Subtotal</th></tr>
        ${order.items?.map(i => `<tr>
          <td>${i.product_name}</td>
          <td>${i.packaging_type || ''}</td>
          <td>${i.weight || ''}</td>
          <td><strong>${i.quantity}</strong></td>
          <td>R$ ${i.unit_price?.toFixed(2)}</td>
          <td>R$ ${(i.unit_price * i.quantity).toFixed(2)}</td>
        </tr>`).join('')}
      </table>
      <div class="total"><strong>Total: R$ ${order.total?.toFixed(2)}</strong></div>
      ${order.notes ? `<div class="footer">Obs: ${order.notes}</div>` : ''}
      </body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const hasActiveFilters = period !== 'all' || groupFilter || statusFilter !== 'Todos' || search;

  return (
    <div className="space-y-4">
      {/* Filters row */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por cliente, empresa, CNPJ, cidade..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {/* Period & group filters */}
      <div className="bg-muted/40 rounded-xl p-3 space-y-3 border">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[180px]">
            <Label className="text-xs mb-1 block">Período</Label>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>{PERIOD_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {period === 'custom' && (
            <>
              <div>
                <Label className="text-xs mb-1 block">De</Label>
                <Input type="date" className="h-9 w-36" value={customStart} onChange={e => setCustomStart(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Até</Label>
                <Input type="date" className="h-9 w-36" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
              </div>
            </>
          )}

          <div className="flex-1 min-w-[180px]">
            <Label className="text-xs mb-1 block">Grupo / Cidade</Label>
            <div className="relative">
              <Input
                placeholder="Ex: São Paulo, Mercadinho..."
                className="h-9 pr-8"
                value={groupFilter}
                onChange={e => setGroupFilter(e.target.value)}
              />
              {groupFilter && (
                <button onClick={() => setGroupFilter('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {cities.length > 0 && !groupFilter && (
              <div className="flex flex-wrap gap-1 mt-1">
                {cities.slice(0, 6).map(city => (
                  <button key={city} onClick={() => setGroupFilter(city)}
                    className="text-[10px] bg-background border rounded-full px-2 py-0.5 hover:bg-primary hover:text-primary-foreground transition-colors">
                    {city}
                  </button>
                ))}
              </div>
            )}
          </div>

          <Button
            onClick={() => setShowPurchaseList(true)}
            disabled={filtered.length === 0}
            className="bg-primary text-primary-foreground h-9 shrink-0"
            title="Compilar lista de compra dos pedidos filtrados"
          >
            <ShoppingBasket className="w-4 h-4 mr-1.5" />
            Lista de Compra ({filtered.length})
          </Button>
          <Button
            onClick={handlePrintAllClients}
            disabled={filtered.length === 0}
            variant="outline"
            className="h-9 shrink-0"
            title="Imprimir espelho de entrega por cliente (quebra de página por cliente)"
          >
            <Users className="w-4 h-4 mr-1.5" />
            Espelho por Cliente
          </Button>
        </div>

        {hasActiveFilters && (
          <p className="text-xs text-muted-foreground">
            Mostrando <strong>{filtered.length}</strong> de {orders.length} pedidos com os filtros aplicados.
            {' '}<button onClick={() => { setPeriod('all'); setGroupFilter(''); setStatusFilter('Todos'); setSearch(''); }} className="underline text-primary">Limpar filtros</button>
          </p>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">Nenhum pedido encontrado.</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(order => {
            const u = userByEmail[order.customer_email] || {};
            return (
              <Card key={order.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{u.company_name || order.customer_name || order.customer_email}</span>
                      <Badge className={`${statusColors[order.status]} border text-xs`}>{order.status}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                      {u.company_name && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Building2 className="w-3 h-3" />{u.company_name}
                        </span>
                      )}
                      {u.cnpj_cpf && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <FileText className="w-3 h-3" />{u.cnpj_cpf}
                        </span>
                      )}
                      {(u.city || u.state) && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="w-3 h-3" />{[u.city, u.state].filter(Boolean).join(' - ')}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(order.created_date), "dd/MM/yyyy HH:mm", { locale: ptBR })} • {order.items?.length || 0} itens
                    </p>
                    <p className="font-bold text-primary mt-1">R$ {order.total?.toFixed(2)}</p>
                  </div>

                  <div className="flex gap-1 flex-shrink-0">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                          Status <ChevronDown className="w-3 h-3 ml-1" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        {['Pendente', 'Confirmado', 'Entregue', 'Cancelado'].map(s => (
                          <DropdownMenuItem key={s} onClick={() => updateMutation.mutate({ id: order.id, status: s })}>
                            {s}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    {(u.whatsapp || u.phone) && (
                      <a
                        href={`https://wa.me/55${(u.whatsapp || u.phone).replace(/\D/g, '')}?text=${encodeURIComponent(`Olá ${order.customer_name || ''}! Passando para confirmar seu pedido de R$ ${order.total?.toFixed(2)}.`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:bg-green-50" title="Abrir WhatsApp">
                          <MessageCircle className="w-4 h-4" />
                        </Button>
                      </a>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="Editar preços dos itens" onClick={() => setEditingOrder(order)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handlePrintSeparation(order)}>
                      <Printer className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}>
                      <Eye className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {expandedOrder === order.id && (
                  <div className="mt-4 pt-4 border-t space-y-2">
                    {(u.address || u.whatsapp) && (
                      <div className="text-xs text-muted-foreground bg-muted rounded-lg p-3 space-y-0.5 mb-3">
                        {u.address && <p>📍 {u.address}{u.city && `, ${u.city}`}{u.state && ` - ${u.state}`}</p>}
                        {u.whatsapp && <p>📱 {u.whatsapp}</p>}
                        {u.cnpj_cpf && <p>📄 CNPJ/CPF: {u.cnpj_cpf}</p>}
                      </div>
                    )}
                    {order.items?.map((item, idx) => {
                      const effectivePrice = item.final_unit_price ?? item.unit_price;
                      const isModified = item.final_unit_price != null && item.final_unit_price !== item.unit_price;
                      return (
                        <div key={idx} className="flex justify-between text-sm">
                          <span>
                            {item.quantity}x {item.product_name}{' '}
                            <span className="text-muted-foreground">({item.packaging_type}{item.weight && ` • ${item.weight}`})</span>
                          </span>
                          <span className={`font-medium ${isModified ? 'text-amber-700' : ''}`}>
                            {isModified && <span className="line-through text-muted-foreground mr-1 font-normal">R$ {(item.unit_price * item.quantity).toFixed(2)}</span>}
                            R$ {(effectivePrice * item.quantity).toFixed(2)}
                          </span>
                        </div>
                      );
                    })}
                    {order.notes && <p className="text-xs text-muted-foreground mt-2 p-2 bg-muted rounded">Obs: {order.notes}</p>}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {showPurchaseList && (
        <OrderPurchaseListDialog
          orders={filtered}
          userByEmail={userByEmail}
          periodLabel={periodLabel}
          onClose={() => setShowPurchaseList(false)}
        />
      )}

      {editingOrder && (
        <OrderEditDialog
          order={editingOrder}
          onSave={({ items, total }) => updateOrderItemsMutation.mutate({ id: editingOrder.id, items, total })}
          onClose={() => setEditingOrder(null)}
        />
      )}
    </div>
  );
}