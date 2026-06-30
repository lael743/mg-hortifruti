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
import { Search, Printer, Eye, ChevronDown, Building2, MapPin, FileText, ShoppingBasket, X, MessageCircle, Users, Pencil, Plus, Trash2, ArrowDownAZ, ArrowDownUp } from 'lucide-react';
import OrderEditDialog from '../../components/admin/OrderEditDialog';
import AdHocOrderModal from '../../components/admin/AdHocOrderModal';
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

// Parseia string "YYYY-MM-DD" como data LOCAL (evita bug de UTC midnight)
function parseLocalDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function toDateInputValue(date) {
  return format(date, 'yyyy-MM-dd');
}

// Normaliza string ISO (com ou sem 'Z') para um Date UTC válido antes de formatar no fuso local
function parseAsUTC(dateInput) {
  if (dateInput instanceof Date) return dateInput;
  let str = String(dateInput);
  // Se termina com 'Z' já é UTC explícito; se não, assume UTC e adiciona 'Z'
  if (!str.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(str)) {
    str = str + 'Z';
  }
  return new Date(str);
}

// Formata data no fuso IANA America/Porto_Velho (UTC-4) usando Intl.DateTimeFormat
function fmtLocal(dateInput, fmtStr) {
  const date = parseAsUTC(dateInput);
  const opts = { timeZone: 'America/Porto_Velho', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' };
  const parts = new Intl.DateTimeFormat('pt-BR', opts).formatToParts(date);
  const p = Object.fromEntries(parts.map(x => [x.type, x.value]));
  if (fmtStr === "dd/MM/yyyy HH:mm") return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
  if (fmtStr === "dd/MM/yyyy 'às' HH:mm") return `${p.day}/${p.month}/${p.year} às ${p.hour}:${p.minute}`;
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}

export default function AdminOrders() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [customStart, setCustomStart] = useState(toDateInputValue(subDays(new Date(), 1)));
  const [customEnd, setCustomEnd] = useState(toDateInputValue(new Date()));
  const [cityFilters, setCityFilters] = useState([]); // multiple cities
  const [showPurchaseList, setShowPurchaseList] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [showAdHocModal, setShowAdHocModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [sortBy, setSortBy] = useState('date'); // 'date' | 'alpha'

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['admin-orders'],
    queryFn: () => base44.entities.Order.list('-created_date', 5000),
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

  const { data: walkInClients = [] } = useQuery({
    queryKey: ['walk-in-clients'],
    queryFn: () => base44.entities.WalkInClient.list(),
  });

  const { data: salespersons = [] } = useQuery({
    queryKey: ['salespersons'],
    queryFn: () => base44.entities.Salesperson.list(),
  });

  const userByEmail = Object.fromEntries(users.map(u => [u.email, u]));
  const walkInById = Object.fromEntries(walkInClients.map(c => [c.id, c]));
  const salespersonById = Object.fromEntries(salespersons.map(s => [s.id, s]));

  // Retorna dados do cliente: Walk-in > User cadastrado > fallback do pedido
  const getClientInfo = (order) => {
    if (order.walk_in_client_id) {
      const w = walkInById[order.walk_in_client_id] || {};
      const sp = w.salesperson_id ? salespersonById[w.salesperson_id] : null;
      return {
        company_name: w.company_name || '',
        cnpj_cpf: w.cnpj_cpf || '',
        address: w.address || '',
        city: w.city || '',
        state: w.state || '',
        whatsapp: w.whatsapp || '',
        full_name: w.full_name || order.customer_name || '',
        is_walk_in: true,
        salesperson_name: sp?.name || '',
        salesperson_whatsapp: sp?.whatsapp || '',
      };
    }
    const u = userByEmail[order.customer_email] || {};
    const sp = u.salesperson_id ? salespersonById[u.salesperson_id] : null;
    return {
      company_name: u.company_name || '',
      cnpj_cpf: u.cnpj_cpf || '',
      address: u.address || '',
      city: u.city || '',
      state: u.state || '',
      whatsapp: u.whatsapp || u.phone || '',
      full_name: u.full_name || order.customer_name || order.customer_email,
      is_walk_in: false,
      salesperson_name: sp?.name || '',
      salesperson_whatsapp: sp?.whatsapp || '',
    };
  };

  // Unique cities for quick group filter
  const cities = [...new Set([
    ...users.map(u => u.city),
    ...walkInClients.map(c => c.city),
  ].filter(Boolean))].sort();

  const updateMutation = useMutation({
    mutationFn: async ({ id, status, order }) => {
      await base44.entities.Order.update(id, { status });
      // Ao marcar como Entregue, cria ContasAReceber (evita duplicatas por order_id)
      if (status === 'Entregue') {
        const existing = await base44.entities.ContasAReceber.filter({ order_id: id });
        if (!existing || existing.length === 0) {
          await base44.entities.ContasAReceber.create({
            order_id: id,
            order_number: order.order_number || null,
            customer_email: order.customer_email || '',
            customer_name: order.customer_name || '',
            total_amount: order.total || 0,
            delivery_date: new Date().toISOString().split('T')[0],
            status: 'pendente_definicao',
            installments_count: 1,
            installment_interval_days: 30,
            installments: [],
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      queryClient.invalidateQueries({ queryKey: ['contas-a-receber'] });
      toast.success('Status atualizado');
    },
  });

  const updateOrderItemsMutation = useMutation({
    mutationFn: ({ id, items, total, subtotal, discount_type, discount_value, discount_amount }) =>
      base44.entities.Order.update(id, { items, total, subtotal, discount_type, discount_value, discount_amount }),
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ['admin-orders'] });
      toast.success('Pedido atualizado com sucesso');
      setEditingOrder(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (orderId) => base44.entities.Order.delete(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      queryClient.invalidateQueries({ queryKey: ['my-orders'] });
      queryClient.invalidateQueries({ queryKey: ['contas-a-receber'] });
      setConfirmDelete(null);
      toast.success('Pedido excluído com sucesso.');
    },
  });

  const filtered = orders.filter(o => {
    const u = getClientInfo(o);

    const matchSearch = !search ||
      o.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      o.customer_email?.toLowerCase().includes(search.toLowerCase()) ||
      u?.company_name?.toLowerCase().includes(search.toLowerCase()) ||
      u?.cnpj_cpf?.toLowerCase().includes(search.toLowerCase()) ||
      u?.city?.toLowerCase().includes(search.toLowerCase());

    const matchStatus = statusFilter === 'Todos' || o.status === statusFilter;

    // Extrai YYYY-MM-DD da data do pedido no fuso local e compara como string com os filtros
    const orderDateStr = parseAsUTC(o.created_date)
      .toLocaleDateString('en-CA', { timeZone: 'America/Porto_Velho' });
    const matchPeriod = (!customStart || orderDateStr >= customStart) && (!customEnd || orderDateStr <= customEnd);

    const matchGroup = cityFilters.length === 0 ||
      cityFilters.some(f =>
        u?.city?.toLowerCase().includes(f.toLowerCase()) ||
        u?.company_name?.toLowerCase().includes(f.toLowerCase())
      );

    return matchSearch && matchStatus && matchPeriod && matchGroup;
  });

  const sorted = sortBy === 'alpha'
    ? [...filtered].sort((a, b) => {
        const nameA = (getClientInfo(a).company_name || getClientInfo(a).full_name || '').toLowerCase();
        const nameB = (getClientInfo(b).company_name || getClientInfo(b).full_name || '').toLowerCase();
        return nameA.localeCompare(nameB, 'pt-BR');
      })
    : filtered;

  // Label for the purchase list dialog
  const periodLabel = (() => {
    const parts = [`${customStart || '?'} a ${customEnd || '?'}`];
    if (cityFilters.length > 0) parts.push(`Cidades: ${cityFilters.join(', ')}`);
    if (statusFilter !== 'Todos') parts.push(`Status: ${statusFilter}`);
    if (search) parts.push(`Busca: "${search}"`);
    return parts.join(' • ');
  })();

  const calcTotalVolume = (items) => {
    return (items || []).reduce((sum, item) => sum + (item.quantity || 0), 0);
  };

  const buildCityBadge = (city, state) => {
    if (!city) return '';
    return `<span style="display:inline-block;background:#2d7a3a;color:#fff;font-size:13px;font-weight:bold;padding:4px 14px;border-radius:20px;letter-spacing:0.5px;">${city}${state ? ` - ${state}` : ''}</span>`;
  };

  const buildCompanyHeader = (salespersonName, salespersonWa) => `
      <div class="company-header">
        ${company?.logo_url ? `<img src="${company.logo_url}" style="height:48px;object-fit:contain;margin-bottom:6px;" />` : ''}
        <h2 style="margin:0;font-size:16px;">${company?.company_name || 'Empresa'}</h2>
        ${company?.address ? `<p style="margin:2px 0;font-size:11px;color:#555;">${company.address}${company.city ? `, ${company.city}` : ''}${company.state ? ` - ${company.state}` : ''}</p>` : ''}
        ${company?.whatsapp ? `<p style="margin:2px 0;font-size:11px;color:#555;">WhatsApp: ${company.whatsapp}</p>` : ''}
        ${company?.cnpj ? `<p style="margin:2px 0;font-size:11px;color:#555;">CNPJ: ${company.cnpj}</p>` : ''}
        ${salespersonName ? `<p style="margin:2px 0;font-size:11px;color:#2d7a3a;font-weight:bold;">Vendedor: ${salespersonName}${salespersonWa ? ` &nbsp;|&nbsp; WhatsApp: ${salespersonWa}` : ''}</p>` : ''}
      </div>`;

  const handlePrintAllClients = () => {
    // Group orders respecting the current sort order (sorted already applies date or alpha)
    const grouped = {};
    const emailOrder = [];
    sorted.forEach(order => {
      if (!grouped[order.customer_email]) {
        grouped[order.customer_email] = [];
        emailOrder.push(order.customer_email);
      }
      grouped[order.customer_email].push(order);
    });

    const clientPages = emailOrder.map((email, index) => {
      const clientOrders = grouped[email];
      const u = getClientInfo(clientOrders[0]);
      const companyHeader = buildCompanyHeader(u.salesperson_name, u.salesperson_whatsapp);
      const orderBlocks = clientOrders.map(order => {
        const itemsRows = [...(order.items || [])].sort((a, b) => (a.product_name || '').localeCompare(b.product_name || '', 'pt-BR')).map(item => {
           const effPrice = item.final_unit_price ?? item.unit_price;
           // Somente destaca como desconto se o preço final for MENOR que o original
           const isDisc = item.final_unit_price != null && item.final_unit_price < item.unit_price;
           const pricePerKg = calcPricePerKg(effPrice, item.weight);
           return `
           <tr${isDisc ? ' style="background:#fffbe6;"' : ''}>
             <td style="text-align:center;font-weight:bold;">${item.quantity}</td>
             <td>${item.product_name}</td>
             <td style="text-align:center;">${item.packaging_type || '—'}</td>
             <td style="text-align:center;">${item.weight || '—'}</td>
             <td style="text-align:right;">${isDisc ? `<span style="text-decoration:line-through;color:#999;font-size:10px;">R$ ${item.unit_price?.toFixed(2)}</span> <span style="color:#b45309;font-weight:bold;">R$ ${effPrice.toFixed(2)}</span>` : `R$ ${effPrice.toFixed(2)}`}</td>
             <td style="text-align:right;color:#555;font-size:10px;">${pricePerKg != null ? `R$ ${pricePerKg.toFixed(2)}/kg` : '—'}</td>
             <td style="text-align:right;">${isDisc ? `<span style="color:#b45309;font-weight:bold;">R$ ${(effPrice * item.quantity).toFixed(2)}</span>` : `R$ ${(effPrice * item.quantity).toFixed(2)}`}</td>
           </tr>`;
         }).join('');
        return `
          <div class="order-block">
            <div class="order-header">
              <span>Pedido #${order.order_number || '—'}</span>
              <span>${new Date(order.created_date).toLocaleString('pt-BR', { timeZone: 'America/Campo_Grande', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              <span class="status-badge status-${order.status}">${order.status}</span>
            </div>
            <table>
              <thead><tr>
                <th style="text-align:center;">Qtd</th>
                <th style="text-align:left;">Produto</th>
                <th style="text-align:center;">Embalagem</th>
                <th style="text-align:center;">Peso</th>
                <th style="text-align:right;">Unit.</th>
                <th style="text-align:right;">R$/kg·un</th>
                <th style="text-align:right;">Subtotal</th>
              </tr></thead>
              <tbody>${itemsRows}</tbody>
              <tfoot>
                <tr>
                  <td style="text-align:center;font-size:10px;color:#555;">${calcTotalVolume(order.items)} vol.</td>
                  <td colspan="5" style="text-align:right;font-weight:bold;">Total do pedido:</td>
                  <td style="text-align:right;font-weight:bold;">R$ ${order.total?.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
            ${order.discount_amount > 0 ? `
            <div style="text-align:right;margin-top:4px;font-size:11px;color:#555;">
              Subtotal itens: R$ ${(order.subtotal ?? (order.total + order.discount_amount)).toFixed(2)} &nbsp;|&nbsp;
              <span style="color:#16a34a;font-weight:bold;">Desconto${order.discount_type === 'percent' ? ` (${order.discount_value}%)` : ''}: - R$ ${order.discount_amount.toFixed(2)}</span>
            </div>` : ''}
            ${order.notes ? `<p style="margin-top:6px;font-size:11px;color:#666;"><strong>Obs:</strong> ${order.notes}</p>` : ''}
            </div>
            ${buildPixBlock(order.total)}`;
            }).join('');

      const clientTotal = clientOrders.reduce((s, o) => s + (o.total || 0), 0);

      return `
        <div class="client-page${index > 0 ? ' page-break' : ''}">
          ${companyHeader}
          <div class="client-info">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:6px;">
              <h3 style="margin:0;">${u.company_name || u.full_name || email}</h3>
              ${buildCityBadge(u.city, u.state)}
            </div>
            ${u.company_name && u.full_name ? `<p><strong>Contato:</strong> ${u.full_name}</p>` : ''}
            ${u.cnpj_cpf ? `<p><strong>CNPJ/CPF:</strong> ${u.cnpj_cpf}</p>` : ''}
            ${u.address ? `<p><strong>Endereço:</strong> ${u.address}${u.city ? `, ${u.city}` : ''}${u.state ? ` - ${u.state}` : ''}</p>` : ''}
            ${u.whatsapp ? `<p><strong>WhatsApp:</strong> ${u.whatsapp}</p>` : ''}
          </div>
          ${orderBlocks}
          <div class="client-total">Total geral do cliente: <strong>R$ ${clientTotal.toFixed(2)}</strong> (${clientOrders.length} pedido${clientOrders.length > 1 ? 's' : ''})</div>
          ${company?.report_footer ? `<div style="margin-top:14px;border-top:1px dashed #ccc;padding-top:8px;font-size:10px;color:#666;text-align:center;white-space:pre-line;">${company.report_footer}</div>` : ''}
          <div class="print-footer">Impresso em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Campo_Grande', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })} &nbsp;|&nbsp; ${company?.company_name || ''}</div>
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

  // Gera payload PIX (BR Code) e retorna HTML com QR Code para impressão
  const buildPixBlock = (amount) => {
    if (!company?.pix_key || !amount || amount <= 0) return '';
    const pixKey = company.pix_key;
    const name = (company.company_name || 'Pagamento').slice(0, 25).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9 ]/g, '').trim();
    const city = (company.city || 'BRASIL').slice(0, 15).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9 ]/g, '').toUpperCase().trim();
    const amountStr = amount.toFixed(2);
    const field = (id, val) => `${id}${String(val.length).padStart(2,'0')}${val}`;
    const merchantAccount = field('26', field('00','BR.GOV.BCB.PIX') + field('01', pixKey));
    const payload0 = `000201${merchantAccount}${field('52','0000')}${field('53','986')}${field('54',amountStr)}${field('58','BR')}${field('59',name)}${field('60',city)}${field('62',field('05','***'))}6304`;
    let crc = 0xFFFF;
    for (let i = 0; i < payload0.length; i++) {
      crc ^= payload0.charCodeAt(i) << 8;
      for (let j = 0; j < 8; j++) crc = (crc & 0x8000) ? (crc << 1) ^ 0x1021 : crc << 1;
    }
    const pixPayload = payload0 + (crc & 0xFFFF).toString(16).toUpperCase().padStart(4,'0');
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(pixPayload)}`;
    return `
      <div style="margin-top:14px;border:2px solid #16a34a;border-radius:8px;padding:12px;display:flex;align-items:center;gap:16px;background:#f0fdf4;">
        <img src="${qrUrl}" alt="QR Code PIX" style="width:120px;height:120px;border-radius:4px;flex-shrink:0;" />
        <div>
          <p style="font-weight:bold;color:#15803d;font-size:13px;margin:0 0 4px;">Pagar com PIX</p>
          <p style="font-size:20px;font-weight:bold;color:#14532d;margin:0 0 6px;">R$ ${amount.toFixed(2)}</p>
          <p style="font-size:10px;color:#555;margin:0 0 2px;">Chave PIX:</p>
          <p style="font-size:11px;font-weight:bold;color:#166534;margin:0;word-break:break-all;">${pixKey}</p>
          <p style="font-size:10px;color:#166534;margin:6px 0 0;font-style:italic;">Escaneie o QR Code ou copie a chave PIX acima para efetuar o pagamento. Após pagamento encaminhar comprovante.</p>
        </div>
      </div>`;
  };

  const calcPricePerKg = (price, weight) => {
    if (!weight) return null;
    const match = String(weight).match(/([\d.,]+)\s*(kg|g|un|unid)?/i);
    if (!match) return null;
    const num = parseFloat(match[1].replace(',', '.'));
    if (!num) return null;
    const unit = (match[2] || 'kg').toLowerCase();
    if (unit === 'g') return price / (num / 1000);
    return price / num; // kg ou un
  };

  const handlePrintSeparation = (order) => {
    const u = getClientInfo(order);

    const itemsRows = [...(order.items || [])].sort((a, b) => (a.product_name || '').localeCompare(b.product_name || '', 'pt-BR')).map(item => {
      const ep = item.final_unit_price ?? item.unit_price;
      // Somente destaca como desconto se o preço final for MENOR que o original
      const isDisc = item.final_unit_price != null && item.final_unit_price < item.unit_price;
      const pricePerKg = calcPricePerKg(ep, item.weight);
      return `
      <tr${isDisc ? ' style="background:#fffbe6;"' : ''}>
        <td style="text-align:center;font-weight:bold;">${item.quantity}</td>
        <td>${item.product_name}</td>
        <td style="text-align:center;">${item.packaging_type || '—'}</td>
        <td style="text-align:center;">${item.weight || '—'}</td>
        <td style="text-align:right;">${isDisc
          ? `<span style="text-decoration:line-through;color:#999;font-size:10px;">R$ ${item.unit_price?.toFixed(2)}</span> <span style="color:#b45309;font-weight:bold;">R$ ${ep.toFixed(2)}</span>`
          : `R$ ${ep.toFixed(2)}`}</td>
        <td style="text-align:right;color:#555;font-size:10px;">${pricePerKg != null ? `R$ ${pricePerKg.toFixed(2)}/kg` : '—'}</td>
        <td style="text-align:right;">${isDisc
          ? `<span style="color:#b45309;font-weight:bold;">R$ ${(ep * item.quantity).toFixed(2)}</span>`
          : `R$ ${(ep * item.quantity).toFixed(2)}`}</td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Lista de Separação - Pedido #${order.order_number || ''}</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: Arial, sans-serif; font-size: 12px; color: #222; }
      .client-page { padding: 20px 24px; }
      .company-header { border-bottom: 2px solid #2d7a3a; padding-bottom: 10px; margin-bottom: 14px; }
      .company-header h2 { color: #2d7a3a; }
      .client-info { background: #f5f5f5; border-left: 4px solid #2d7a3a; padding: 10px 14px; margin-bottom: 14px; border-radius: 0 6px 6px 0; }
      .client-info h3 { font-size: 15px; margin-bottom: 4px; }
      .client-info p { font-size: 11px; color: #444; margin: 2px 0; }
      .order-block { margin-bottom: 16px; }
      .order-header { display: flex; gap: 16px; align-items: center; background: #2d7a3a; color: #fff; padding: 5px 10px; border-radius: 4px 4px 0 0; font-size: 11px; font-weight: bold; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #ddd; padding: 5px 8px; font-size: 11px; }
      thead th { background: #e8f5e9; font-weight: 600; }
      tfoot td { background: #f9f9f9; }
      tbody tr:nth-child(even) { background: #fafafa; }
      .client-total { text-align: right; margin-top: 10px; font-size: 13px; border-top: 2px solid #2d7a3a; padding-top: 6px; }
      .print-footer { text-align: center; font-size: 10px; color: #aaa; margin-top: 16px; border-top: 1px solid #eee; padding-top: 6px; }
      @media print { @page { margin: 10mm; size: A4; } body { font-size: 11px; } }
    </style></head>
    <body><div class="client-page">
      ${buildCompanyHeader(u.salesperson_name, u.salesperson_whatsapp)}
      <div class="client-info">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:6px;">
          <h3 style="margin:0;">${u.company_name || u.full_name || order.customer_email}</h3>
          ${buildCityBadge(u.city, u.state)}
        </div>
        ${u.company_name && u.full_name ? `<p><strong>Contato:</strong> ${u.full_name}</p>` : ''}
        ${u.cnpj_cpf ? `<p><strong>CNPJ/CPF:</strong> ${u.cnpj_cpf}</p>` : ''}
        ${u.address ? `<p><strong>Endereço:</strong> ${u.address}${u.city ? `, ${u.city}` : ''}${u.state ? ` - ${u.state}` : ''}</p>` : ''}
        ${u.whatsapp ? `<p><strong>WhatsApp:</strong> ${u.whatsapp}</p>` : ''}
      </div>
      <div class="order-block">
        <div class="order-header">
          <span>Pedido #${order.order_number || '—'}</span>
          <span>${fmtLocal(order.created_date, "dd/MM/yyyy 'às' HH:mm")}</span>
          <span>${order.status}</span>
        </div>
        <table>
          <thead><tr>
            <th style="text-align:center;">Qtd</th>
            <th style="text-align:left;">Produto</th>
            <th style="text-align:center;">Embalagem</th>
            <th style="text-align:center;">Peso</th>
            <th style="text-align:right;">Unit.</th>
            <th style="text-align:right;">R$/kg·un</th>
            <th style="text-align:right;">Subtotal</th>
          </tr></thead>
          <tbody>${itemsRows}</tbody>
          <tfoot>
            <tr>
              <td style="text-align:center;font-size:10px;color:#555;">${calcTotalVolume(order.items)} vol.</td>
              <td colspan="5" style="text-align:right;font-weight:bold;">Total do pedido:</td>
              <td style="text-align:right;font-weight:bold;">R$ ${order.total?.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
        ${order.discount_amount > 0 ? `
        <div style="text-align:right;margin-top:4px;font-size:11px;color:#555;">
          Subtotal itens: R$ ${(order.subtotal ?? (order.total + order.discount_amount)).toFixed(2)} &nbsp;|&nbsp;
          <span style="color:#16a34a;font-weight:bold;">Desconto${order.discount_type === 'percent' ? ` (${order.discount_value}%)` : ''}: - R$ ${order.discount_amount.toFixed(2)}</span>
        </div>` : ''}
        ${order.notes ? `<p style="margin-top:6px;font-size:11px;color:#666;"><strong>Obs:</strong> ${order.notes}</p>` : ''}
      </div>
      ${buildPixBlock(order.total)}
      ${company?.report_footer ? `<div style="margin-top:14px;border-top:1px dashed #ccc;padding-top:8px;font-size:10px;color:#666;text-align:center;white-space:pre-line;">${company.report_footer}</div>` : ''}
      <div class="print-footer">Impresso em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")} &nbsp;|&nbsp; ${company?.company_name || ''}</div>
    </div></body></html>`;

    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 400);
  };

  const hasActiveFilters = cityFilters.length > 0 || statusFilter !== 'Todos' || search || customStart || customEnd;

  return (
    <div className="space-y-4">
      {/* Filters row */}
      <div className="flex gap-3 flex-wrap">
        <Button onClick={() => setShowAdHocModal(true)} className="shrink-0">
          <Plus className="w-4 h-4 mr-1.5" />Novo Pedido Avulso
        </Button>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por cliente, empresa, CNPJ, cidade..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 border-slate-400" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 border-slate-400"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {/* Period & group filters */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border-2 border-slate-400 dark:border-slate-500 shadow-sm overflow-hidden">

        {/* City list — scrollable single row */}
        <div className="border-b border-slate-200 dark:border-slate-700 px-4 py-2 flex items-center gap-2">
          <span className="text-[11px] font-semibold text-muted-foreground shrink-0 uppercase tracking-wide">Cidade</span>
          <div className="flex gap-1.5 overflow-x-auto flex-1 pb-0.5">
            {cities.map(city => {
              const active = cityFilters.includes(city);
              return (
                <button
                  key={city}
                  onClick={() => setCityFilters(f => active ? f.filter(c => c !== city) : [...f, city])}
                  className={`text-[11px] border rounded-full px-2.5 py-0.5 font-medium transition-all whitespace-nowrap shrink-0 ${active ? 'bg-primary text-primary-foreground border-primary' : 'border-slate-300 text-muted-foreground hover:bg-primary/10 hover:border-primary'}`}
                >
                  {city}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected city chips — below the list */}
        {cityFilters.length > 0 && (
          <div className="border-b border-slate-200 dark:border-slate-700 px-4 py-1.5 flex items-center gap-1.5 flex-wrap bg-primary/5">
            <span className="text-[10px] text-muted-foreground shrink-0">Selecionadas:</span>
            {cityFilters.map(city => (
              <span key={city} className="inline-flex items-center gap-1 text-[11px] bg-primary text-primary-foreground rounded-full px-2.5 py-0.5 font-medium">
                {city}
                <button onClick={() => setCityFilters(f => f.filter(c => c !== city))} className="hover:opacity-70"><X className="w-2.5 h-2.5" /></button>
              </span>
            ))}
            <button onClick={() => setCityFilters([])} className="text-[11px] text-muted-foreground underline hover:text-foreground ml-1">Limpar</button>
          </div>
        )}

        <div className="p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <Label className="text-xs font-semibold mb-2 block text-foreground">De</Label>
              <Input type="date" className="h-10 w-36 bg-background" value={customStart} onChange={e => setCustomStart(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs font-semibold mb-2 block text-foreground">Até</Label>
              <Input type="date" className="h-10 w-36 bg-background" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
            </div>
            <Button
              onClick={() => setShowPurchaseList(true)}
              disabled={filtered.length === 0}
              className="h-10 shrink-0"
            >
              <ShoppingBasket className="w-4 h-4 mr-1.5" />
              Lista de Compra ({filtered.length})
            </Button>
            <Button
              onClick={handlePrintAllClients}
              disabled={filtered.length === 0}
              variant="outline"
              className="h-10 shrink-0 border-slate-400"
            >
              <Users className="w-4 h-4 mr-1.5" />
              Espelho por Cliente
            </Button>
            <Button
              variant={sortBy === 'alpha' ? 'default' : 'outline'}
              className="h-10 shrink-0 border-slate-400"
              onClick={() => setSortBy(s => s === 'alpha' ? 'date' : 'alpha')}
            >
              {sortBy === 'alpha' ? <ArrowDownAZ className="w-4 h-4 mr-1.5" /> : <ArrowDownUp className="w-4 h-4 mr-1.5" />}
              {sortBy === 'alpha' ? 'A→Z Empresa' : 'Mais recente'}
            </Button>
          </div>

          {hasActiveFilters && (
            <p className="text-xs text-muted-foreground mt-3">
              Mostrando <strong>{filtered.length}</strong> de {orders.length} pedidos.
              {' '}<button onClick={() => { setCityFilters([]); setStatusFilter('Todos'); setSearch(''); setCustomStart(toDateInputValue(subDays(new Date(), 1))); setCustomEnd(toDateInputValue(new Date())); }} className="underline text-primary">Limpar filtros</button>
            </p>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">Nenhum pedido encontrado.</div>
      ) : (
        <div className="space-y-3">
          {sorted.map(order => {
            const u = getClientInfo(order);
            return (
              <Card key={order.id} className="p-4 border-2 border-slate-400 dark:border-slate-500 shadow-sm hover:shadow-md transition-shadow bg-white dark:bg-slate-900">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{u.company_name || u.full_name || order.customer_name}</span>
                      <Badge className={`${statusColors[order.status]} border text-xs`}>{order.status}</Badge>
                      {u.is_walk_in && <Badge variant="outline" className="text-xs border-amber-400 text-amber-700">Avulso</Badge>}
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
                       {fmtLocal(order.created_date, "dd/MM/yyyy HH:mm")} • {order.items?.length || 0} itens
                     </p>
                    <p className="font-bold text-primary mt-1">
                      R$ {order.total?.toFixed(2)}
                      {order.discount_amount > 0 && (
                        <span className="ml-2 text-xs font-normal text-green-700 bg-green-50 border border-green-200 rounded px-1.5 py-0.5">
                          🏷️ Desc. R$ {order.discount_amount.toFixed(2)}
                        </span>
                      )}
                    </p>
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
                         <DropdownMenuItem key={s} onClick={() => updateMutation.mutate({ id: order.id, status: s, order })}>
                           {s}
                         </DropdownMenuItem>
                       ))}
                     </DropdownMenuContent>
                   </DropdownMenu>
                   {u.whatsapp && (
                     <a
                       href={`https://wa.me/55${u.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá ${order.customer_name || ''}! Passando para confirmar seu pedido de R$ ${order.total?.toFixed(2)}.`)}`}
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
                   <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                     const freshOrder = orders.find(o => o.id === order.id) || order;
                     handlePrintSeparation(freshOrder);
                   }}>
                     <Printer className="w-4 h-4" />
                   </Button>
                   <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}>
                     <Eye className="w-4 h-4" />
                   </Button>
                   {confirmDelete === order.id ? (
                     <div className="flex gap-1">
                       <Button
                         size="icon"
                         className="h-8 w-8"
                         variant="destructive"
                         disabled={deleteMutation.isPending}
                         onClick={() => deleteMutation.mutate(order.id)}
                         title="Confirmar exclusão"
                       >
                         ✓
                       </Button>
                       <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setConfirmDelete(null)}>
                         ✕
                       </Button>
                     </div>
                   ) : (
                     <Button
                       variant="ghost"
                       size="icon"
                       className="h-8 w-8 text-destructive hover:bg-destructive/10"
                       onClick={() => setConfirmDelete(order.id)}
                       title="Excluir pedido"
                     >
                       <Trash2 className="w-4 h-4" />
                     </Button>
                   )}
                  </div>
                </div>

                {expandedOrder === order.id && (
                  <div className="mt-4 pt-4 border-t space-y-2">
                    {(u.address || u.whatsapp || u.cnpj_cpf || u.salesperson_name) && (
                      <div className="text-xs text-muted-foreground bg-muted rounded-lg p-3 space-y-0.5 mb-3">
                        {u.address && <p>📍 {u.address}{u.city && `, ${u.city}`}{u.state && ` - ${u.state}`}</p>}
                        {u.whatsapp && <p>📱 {u.whatsapp}</p>}
                        {u.cnpj_cpf && <p>📄 CNPJ/CPF: {u.cnpj_cpf}</p>}
                        {u.salesperson_name && <p>👤 Vendedor: <strong>{u.salesperson_name}</strong>{u.salesperson_whatsapp && ` • ${u.salesperson_whatsapp}`}</p>}
                      </div>
                    )}
                    {order.items?.map((item, idx) => {
                      const effectivePrice = item.final_unit_price ?? item.unit_price;
                      // Somente destaca se for desconto (preço final menor que original)
                      const isModified = item.final_unit_price != null && item.final_unit_price < item.unit_price;
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
          companyName={company?.company_name || ''}
          onClose={() => setShowPurchaseList(false)}
        />
      )}

      {showAdHocModal && (
        <AdHocOrderModal
          onClose={() => setShowAdHocModal(false)}
          onSaved={() => {
            setShowAdHocModal(false);
            queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
          }}
        />
      )}

      {editingOrder && (() => {
        // Sempre usa o dado mais recente do query (não o snapshot antigo)
        const freshOrder = orders.find(o => o.id === editingOrder.id) || editingOrder;
        return (
          <OrderEditDialog
            key={freshOrder.id + JSON.stringify(freshOrder.items)}
            order={freshOrder}
            onSave={(payload) => updateOrderItemsMutation.mutate({ id: freshOrder.id, ...payload })}
            onClose={() => setEditingOrder(null)}
          />
        );
      })()}
    </div>
  );
}