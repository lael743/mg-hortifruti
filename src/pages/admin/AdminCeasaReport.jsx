import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, Printer, Plus, Trash2, Package } from 'lucide-react';
import ClientReportCard from '@/components/admin/ClientReportCard';

const LOCAL_TZ = 'America/Porto_Velho';

function todayStr() {
  return new Date().toLocaleDateString('en-CA', { timeZone: LOCAL_TZ });
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR');
}

function getEffectiveNfeValue(item) {
  if (item.nfe_value != null) return item.nfe_value;
  return item.final_unit_price ?? item.unit_price ?? 0;
}

export default function AdminCeasaReport() {
  const queryClient = useQueryClient();
  const [startDate, setStartDate] = useState(todayStr());
  const [endDate, setEndDate] = useState(todayStr());
  const [activeTab, setActiveTab] = useState('lista');

  const { data: allOrders = [] } = useQuery({
    queryKey: ['orders'],
    queryFn: () => base44.entities.Order.list('-created_date', 500),
  });

  const { data: boxes = [] } = useQuery({
    queryKey: ['ceasa-boxes'],
    queryFn: () => base44.entities.CeasaBox.list(),
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list(),
  });

  const { data: reportItems = [] } = useQuery({
    queryKey: ['ceasa-report-items'],
    queryFn: () => base44.entities.CeasaReportItem.list('-created_date', 500),
  });

  // Filtra pedidos por data e que requerem NF-e
  const nfeOrders = useMemo(() => {
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T23:59:59');
    return allOrders.filter(o => {
      if (!o.requires_nfe) return false;
      const created = new Date(o.created_date);
      return created >= start && created <= end && o.status !== 'Cancelado';
    });
  }, [allOrders, startDate, endDate]);

  // Achata itens: somente os marcados como nfe_included (não bônus)
  const flatRows = useMemo(() => {
    const rows = [];
    nfeOrders.forEach(o => {
      (o.items || []).forEach(it => {
        if (it.is_bonus) return;
        if (!it.nfe_included) return;
        rows.push({
          orderId: o.id,
          orderNumber: o.order_number,
          caminhao: o.caminhao || '',
          cnpj: o.nfe_cnpj || '',
          cliente: o.nfe_company_name || o.customer_display_name || o.customer_name || '',
          productId: it.product_id,
          produto: it.product_name,
          qtde: it.quantity,
          valorUn: getEffectiveNfeValue(it),
          subtotal: getEffectiveNfeValue(it) * it.quantity,
        });
      });
    });
    return rows;
  }, [nfeOrders]);

  // Mapa produto -> box
  const productToBox = useMemo(() => {
    const map = {};
    boxes.forEach(b => {
      (b.product_ids || []).forEach(pid => {
        if (!map[pid]) map[pid] = b;
      });
    });
    return map;
  }, [boxes]);

  // Agrupamento por Box
  const groupedByBox = useMemo(() => {
    const groups = {};
    const noBox = [];
    flatRows.forEach(row => {
      const box = row.productId ? productToBox[row.productId] : null;
      if (box) {
        if (!groups[box.id]) groups[box.id] = { box, rows: [] };
        groups[box.id].rows.push(row);
      } else {
        noBox.push(row);
      }
    });
    // Adiciona itens manuais (CeasaReportItem)
    reportItems.forEach(ri => {
      if (ri.date < startDate || ri.date > endDate) return;
      const box = boxes.find(b => b.id === ri.box_id);
      if (!box) return;
      if (!groups[box.id]) groups[box.id] = { box, rows: [] };
      groups[box.id].rows.push({
        caminhao: '',
        cnpj: '',
        cliente: ri.client_name || '—',
        produto: ri.product_name,
        qtde: ri.quantity,
        valorUn: 0,
        subtotal: 0,
        isManual: true,
        manualId: ri.id,
      });
    });
    return { groups: Object.values(groups), noBox };
  }, [flatRows, productToBox, boxes, reportItems, startDate, endDate]);

  // Totais
  const totalRows = flatRows.length;
  const totalValor = flatRows.reduce((s, r) => s + r.subtotal, 0);
  const totalClientes = new Set(nfeOrders.map(o => o.nfe_cnpj || o.customer_email)).size;

  // Agrupamento por cliente para a Lista por Cliente
  const groupedByClient = useMemo(() => {
    const map = new Map();
    flatRows.forEach(r => {
      const key = r.cnpj || r.cliente || '—';
      if (!map.has(key)) map.set(key, { cliente: r.cliente, cnpj: r.cnpj, caminhoes: new Set(), rows: [] });
      const g = map.get(key);
      g.rows.push(r);
      if (r.caminhao) g.caminhoes.add(r.caminhao);
    });
    return [...map.values()].sort((a, b) => a.cliente.localeCompare(b.cliente, 'pt-BR'));
  }, [flatRows]);

  // === Exportação CSV ===
  const exportCsv = () => {
    const headers = ['Caminhão', 'CNPJ', 'Cliente', 'Produto', 'Qtde', 'Valor Un.'];
    const lines = [headers.join(';')];
    flatRows.forEach(r => {
      lines.push([
        r.caminhao,
        r.cnpj,
        r.cliente,
        r.produto,
        r.qtde,
        r.valorUn.toFixed(2).replace('.', ','),
      ].join(';'));
    });
    // Resumo por produto
    lines.push('');
    lines.push('RESUMO POR PRODUTO');
    const prodSummary = {};
    flatRows.forEach(r => {
      if (!prodSummary[r.produto]) prodSummary[r.produto] = 0;
      prodSummary[r.produto] += r.qtde;
    });
    Object.entries(prodSummary).forEach(([p, q]) => {
      lines.push([p, q].join(';'));
    });
    const csv = '\uFEFF' + lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-ceasa-${startDate}_a_${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exportado!');
  };

  // === Impressão ===
  const handlePrint = () => {
    window.print();
  };

  const productName = (pid) => products.find(p => p.id === pid)?.name || '—';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2 print:hidden">
        <div>
          <h2 className="text-lg font-bold">Relação de Vendas e Boxes Ceasa</h2>
          <p className="text-sm text-muted-foreground">Pedidos com NF-e — organize a separação por Box.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1" onClick={exportCsv} disabled={totalRows === 0}>
            <Download className="w-4 h-4" /> Exportar CSV
          </Button>
          <Button variant="outline" size="sm" className="gap-1" onClick={handlePrint}>
            <Printer className="w-4 h-4" /> Imprimir
          </Button>
        </div>
      </div>

      {/* Filtros de data */}
      <Card className="p-4 print:hidden">
        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <Label className="text-xs">Data inicial</Label>
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-40" />
          </div>
          <div>
            <Label className="text-xs">Data final</Label>
            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-40" />
          </div>
          <div className="flex gap-2 text-sm">
            <Badge variant="secondary">{totalClientes} clientes</Badge>
            <Badge variant="secondary">{totalRows} itens</Badge>
            <Badge variant="secondary">R$ {totalValor.toFixed(2)}</Badge>
          </div>
        </div>
      </Card>

      {/* Cabeçalho de impressão */}
      <div className="hidden print:block text-center mb-4">
        <h1 className="text-xl font-bold">Relação de Vendas e Boxes Ceasa</h1>
        <p className="text-sm">{fmtDate(startDate)} até {fmtDate(endDate)}</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="print:hidden">
          <TabsTrigger value="lista">Lista por Cliente</TabsTrigger>
          <TabsTrigger value="box">Agrupado por Box</TabsTrigger>
        </TabsList>

        {/* === Formato 1: Lista por Cliente === */}
        <TabsContent value="lista">
          {totalRows === 0 ? (
            <Card className="p-8 text-center">
              <Package className="w-10 h-10 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-muted-foreground">Nenhum pedido com NF-e no período selecionado.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {/* Total geral */}
              <div className="flex items-center justify-end gap-3 text-sm">
                <Badge variant="secondary">{groupedByClient.length} clientes</Badge>
                <Badge variant="secondary">{flatRows.reduce((s, r) => s + r.qtde, 0)} un.</Badge>
                <Badge className="bg-primary text-primary-foreground">R$ {totalValor.toFixed(2)}</Badge>
              </div>

              {/* Cards por cliente, expansíveis */}
              {groupedByClient.map((g, i) => (
                <ClientReportCard
                  key={i}
                  cliente={g.cliente}
                  cnpj={g.cnpj}
                  caminhoes={[...g.caminhoes]}
                  rows={g.rows}
                  productToBox={productToBox}
                />
              ))}
            </div>
          )}

          {/* Resumo por produto */}
          {totalRows > 0 && (
            <Card className="p-4 mt-3 bg-primary/5">
              <p className="text-sm font-semibold mb-2">Resumo por produto</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(flatRows.reduce((acc, r) => {
                  if (!acc[r.produto]) acc[r.produto] = 0;
                  acc[r.produto] += r.qtde;
                  return acc;
                }, {})).map(([prod, qty]) => (
                  <Badge key={prod} className="bg-primary/10 text-primary border border-primary/20">
                    {qty} {prod}
                  </Badge>
                ))}
              </div>
            </Card>
          )}
        </TabsContent>

        {/* === Formato 2: Agrupado por Box === */}
        <TabsContent value="box">
          {groupedByBox.groups.length === 0 && groupedByBox.noBox.length === 0 ? (
            <Card className="p-8 text-center">
              <Package className="w-10 h-10 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-muted-foreground">Nenhum dado para agrupar no período.</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {groupedByBox.groups.map(({ box, rows }) => (
                <BoxGroup
                  key={box.id}
                  box={box}
                  rows={rows}
                  startDate={startDate}
                  endDate={endDate}
                  onItemAdded={() => queryClient.invalidateQueries({ queryKey: ['ceasa-report-items'] })}
                  onItemDeleted={() => queryClient.invalidateQueries({ queryKey: ['ceasa-report-items'] })}
                />
              ))}

              {groupedByBox.noBox.length > 0 && (
                <Card className="p-4 border-amber-200 bg-amber-50/40">
                  <p className="font-semibold text-sm mb-2">Sem Box associado</p>
                  <div className="space-y-1">
                    {groupedByBox.noBox.map((r, i) => (
                      <div key={i} className="flex justify-between text-sm border-b last:border-b-0 py-1">
                        <span>{r.cliente} — <strong>{r.produto}</strong></span>
                        <span className="text-muted-foreground">{r.qtde} un.</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Associe estes produtos a um Box no cadastro de Boxes para que apareçam agrupados.
                  </p>
                </Card>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// === Subcomponente: Grupo por Box com adição de itens manuais ===
function BoxGroup({ box, rows, startDate, endDate, onItemAdded, onItemDeleted }) {
  const [showAdd, setShowAdd] = useState(false);
  const [newItem, setNewItem] = useState({ product_name: '', quantity: 1, client_name: '' });

  const totalQty = rows.reduce((s, r) => s + r.qtde, 0);

  const addMutation = useMutation({
    mutationFn: (data) => base44.entities.CeasaReportItem.create(data),
    onSuccess: () => { onItemAdded(); toast.success('Item adicionado ao Box.'); setNewItem({ product_name: '', quantity: 1, client_name: '' }); setShowAdd(false); },
    onError: () => toast.error('Erro ao adicionar item.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.CeasaReportItem.delete(id),
    onSuccess: () => { onItemDeleted(); toast.success('Item removido.'); },
  });

  const handleAdd = () => {
    if (!newItem.product_name.trim()) { toast.error('Informe o produto.'); return; }
    addMutation.mutate({
      box_id: box.id,
      box_name: box.name,
      product_name: newItem.product_name,
      quantity: parseInt(newItem.quantity) || 1,
      client_name: newItem.client_name || '',
      date: startDate,
    });
  };

  return (
    <Card className="overflow-hidden border-2 border-primary/15">
      <div className="bg-primary/8 px-4 py-3 flex items-center justify-between gap-2">
        <div>
          <p className="font-bold text-primary">{box.name}</p>
          {box.cnpj && <p className="text-xs text-muted-foreground">CNPJ: {box.cnpj}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-primary text-primary-foreground">{totalQty} un. total</Badge>
          <Button size="sm" variant="outline" className="h-7 gap-1 print:hidden" onClick={() => setShowAdd(!showAdd)}>
            <Plus className="w-3.5 h-3.5" /> Adicionar item
          </Button>
        </div>
      </div>

      {showAdd && (
        <div className="px-4 py-3 border-b bg-muted/30 print:hidden">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <Input placeholder="Produto" value={newItem.product_name} onChange={e => setNewItem(p => ({ ...p, product_name: e.target.value }))} />
            <Input placeholder="Cliente (opcional)" value={newItem.client_name} onChange={e => setNewItem(p => ({ ...p, client_name: e.target.value }))} />
            <Input type="number" min="1" placeholder="Qtd" value={newItem.quantity} onChange={e => setNewItem(p => ({ ...p, quantity: e.target.value }))} />
            <Button onClick={handleAdd} disabled={addMutation.isPending}>Adicionar</Button>
          </div>
        </div>
      )}

      <div className="divide-y">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center justify-between px-4 py-2 text-sm hover:bg-muted/20">
            <div className="min-w-0 flex-1">
              <p className="font-medium truncate">
                {r.produto}
                {r.isManual && <Badge variant="outline" className="ml-1.5 text-[10px] text-blue-600 border-blue-300">Manual</Badge>}
              </p>
              <p className="text-xs text-muted-foreground truncate">{r.cliente}{r.caminhao && ` • ${r.caminhao}`}</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {r.valorUn > 0 && <span className="text-xs text-muted-foreground">R$ {r.valorUn.toFixed(2)}/un</span>}
              <span className="font-bold text-primary">{r.qtde}</span>
              {r.isManual && r.manualId && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-destructive print:hidden"
                  onClick={() => deleteMutation.mutate(r.manualId)}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              )}
            </div>
          </div>
        ))}
        {rows.length === 0 && <p className="text-center text-xs text-muted-foreground py-4">Nenhum item neste Box.</p>}
      </div>
    </Card>
  );
}