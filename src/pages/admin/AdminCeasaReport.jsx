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
import { Download, Printer, Plus, Package, ChevronDown, ChevronRight } from 'lucide-react';
import { createPortal } from 'react-dom';
import ClientReportCard from '@/components/admin/ClientReportCard';
import ReportRowDeleteButton from '@/components/admin/ReportRowDeleteButton';
import CeasaPrintLayout from '@/components/admin/CeasaPrintLayout';

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
  const [printTarget, setPrintTarget] = useState(null); // null | 'all' | { type:'client'|'box', id }

  const doPrint = (target) => {
    setPrintTarget(target || 'all');
    document.body.classList.add('ceasa-printing');
    const cleanup = () => {
      document.body.classList.remove('ceasa-printing');
      setPrintTarget(null);
      window.removeEventListener('afterprint', cleanup);
      clearTimeout(fallback);
    };
    const fallback = setTimeout(cleanup, 8000);
    window.addEventListener('afterprint', cleanup);
    setTimeout(() => window.print(), 200);
  };

  const { data: allOrders = [] } = useQuery({
    queryKey: ['orders'],
    queryFn: () => base44.entities.Order.list('-created_date', 500),
  });

  const { data: boxes = [] } = useQuery({
    queryKey: ['ceasa-boxes'],
    queryFn: () => base44.entities.CeasaBox.list(),
  });

  const { data: trucks = [] } = useQuery({
    queryKey: ['ceasa-trucks'],
    queryFn: () => base44.entities.CeasaTruck.list('-created_date', 200),
  });

  const { data: reportItems = [] } = useQuery({
    queryKey: ['ceasa-report-items'],
    queryFn: () => base44.entities.CeasaReportItem.list('-created_date', 500),
  });

  const { data: company } = useQuery({
    queryKey: ['company-settings'],
    queryFn: () => base44.entities.CompanySettings.list().then(r => r[0]),
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

  // Operações CEASA existentes, indexadas por order_id + item_key
  const operationByKey = useMemo(() => {
    const map = {};
    reportItems.forEach(ri => {
      if (ri.order_id && ri.item_key && !map[ri.item_key]) map[ri.item_key] = ri;
    });
    return map;
  }, [reportItems]);

  const boxById = useMemo(() => {
    const map = {};
    boxes.forEach(b => { map[b.id] = b; });
    return map;
  }, [boxes]);

  // Achata itens: somente os marcados como nfe_included (não bônus)
  const flatRows = useMemo(() => {
    const rows = [];
    nfeOrders.forEach(o => {
      (o.items || []).forEach((it, idx) => {
        if (it.is_bonus) return;
        if (!it.nfe_included) return;
        const itemKey = `${o.id}:${idx}`;
        const operation = operationByKey[itemKey] || null;
        // O relatório usa os dados da operação CEASA, não os valores fiscais do pedido
        const qtde = operation?.quantity ?? it.quantity;
        const valorCeasa = operation?.ceasa_value ?? it.final_unit_price ?? 0;
        rows.push({
          orderId: o.id,
          orderNumber: o.order_number,
          itemIndex: idx,
          itemKey,
          orderDate: new Date(o.created_date).toLocaleDateString('en-CA', { timeZone: LOCAL_TZ }),
          // Caminhão vem da operação CEASA (nunca de Order.caminhao)
          caminhao: operation?.caminhao || '',
          cnpj: o.nfe_cnpj || '',
          nfeCompanyName: o.nfe_company_name || '',
          cliente: o.nfe_company_name || o.customer_display_name || o.customer_name || '',
          productId: it.product_id,
          produto: operation?.product_name || it.product_name,
          qtde,
          // Valor do pedido — usado apenas na coluna "Valor pedido" da Gestão CEASA
          valorUn: getEffectiveNfeValue(it),
          // Valor CEASA por unidade
          valorCeasa,
          // Valor inicial da operação CEASA: preço final do item (sem fallback para nfe_value)
          valorCeasaBase: it.final_unit_price ?? 0,
          // Subtotal CEASA = quantidade × valor CEASA
          subtotal: valorCeasa * qtde,
          obs: operation?.notes || '',
          operation,
          box: operation?.box_id ? (boxById[operation.box_id] || null) : null,
        });
      });
    });
    return rows;
  }, [nfeOrders, operationByKey, boxById]);

  // Agrupamento por Box — definido pela operação CEASA de cada item
  const groupedByBox = useMemo(() => {
    const groups = {};
    const noBox = [];
    flatRows.forEach(row => {
      const box = row.box;
      if (box) {
        if (!groups[box.id]) groups[box.id] = { box, rows: [] };
        groups[box.id].rows.push(row);
      } else {
        noBox.push(row);
      }
    });
    // Adiciona itens manuais (CeasaReportItem sem item_key).
    // Operações de itens de pedido já entram pelo flatRows — evita duplicidade.
    reportItems.forEach(ri => {
      if (ri.item_key) return;
      if (ri.date < startDate || ri.date > endDate) return;
      const box = boxes.find(b => b.id === ri.box_id);
      if (!box) return;
      if (!groups[box.id]) groups[box.id] = { box, rows: [] };
      const qtde = ri.quantity || 0;
      const valorCeasa = ri.ceasa_value ?? 0;
      groups[box.id].rows.push({
        caminhao: ri.caminhao || '',
        cnpj: '',
        cliente: ri.client_name || '—',
        produto: ri.product_name,
        qtde,
        valorUn: 0,
        valorCeasa,
        subtotal: valorCeasa * qtde,
        obs: ri.notes || '',
        isManual: true,
        manualId: ri.id,
      });
    });
    return { groups: Object.values(groups), noBox };
  }, [flatRows, boxes, reportItems, startDate, endDate]);

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
    const headers = ['Box', 'Cliente', 'Pedido', 'Produto', 'Quantidade', 'Valor CEASA', 'Subtotal', 'Caminhão', 'Observação'];
    const lines = [headers.join(';')];
    flatRows.forEach(r => {
      lines.push([
        r.box?.name || 'Sem Box',
        r.cliente,
        r.orderNumber ?? '—',
        r.produto,
        r.qtde,
        r.valorCeasa.toFixed(2).replace('.', ','),
        r.subtotal.toFixed(2).replace('.', ','),
        r.caminhao,
        r.obs || '',
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

  // === Excluir a operação CEASA de um item (ou item manual) ===
  // Remove somente o CeasaReportItem. O pedido e seus itens nunca são alterados.
  const deleteRowMutation = useMutation({
    mutationFn: async (row) => {
      const reportItemId = row.manualId || row.operation?.id;
      if (!reportItemId) return null;
      return base44.entities.CeasaReportItem.delete(reportItemId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ceasa-report-items'] });
      toast.success('Operação CEASA removida.');
    },
    onError: () => toast.error('Erro ao remover a operação CEASA.'),
  });

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
          <Button variant="outline" size="sm" className="gap-1" onClick={() => doPrint('allClient')} disabled={totalRows === 0}>
            <Printer className="w-4 h-4" /> Imprimir Lista por Cliente
          </Button>
          <Button variant="outline" size="sm" className="gap-1" onClick={() => doPrint('allBox')} disabled={groupedByBox.groups.length === 0}>
            <Printer className="w-4 h-4" /> Imprimir Agrupado por Box
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
                  boxes={boxes}
                  trucks={trucks}
                  startDate={startDate}
                  onPrint={() => doPrint({ type: 'client', id: g.cnpj || g.cliente })}
                  onDeleteRow={(r) => deleteRowMutation.mutate(r)}
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
                  onItemAdded={() => queryClient.invalidateQueries({ queryKey: ['ceasa-report-items'] })}
                  onPrint={() => doPrint({ type: 'box', id: box.id })}
                  onDeleteRow={(r) => deleteRowMutation.mutate(r)}
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
                    Defina o Box da operação de cada item na aba "Lista por Cliente" para que apareçam agrupados.
                  </p>
                </Card>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* === Portal de impressão — layout compacto, um cliente/box por página === */}
      {printTarget && createPortal(
        <div className="ceasa-print-root" style={{ padding: '8px 12px' }}>
          {(printTarget === 'allClient' || (printTarget && printTarget.type === 'client')) && (
            <CeasaPrintLayout
              mode="client"
              groupedByClient={groupedByClient.filter(g => printTarget === 'allClient' || printTarget.id === (g.cnpj || g.cliente))}
              company={company}
              startDate={startDate}
              endDate={endDate}
              fmtDate={fmtDate}
            />
          )}
          {(printTarget === 'allBox' || (printTarget && printTarget.type === 'box')) && (
            <CeasaPrintLayout
              mode="box"
              groupedByBox={{ groups: groupedByBox.groups.filter(({ box }) => printTarget === 'allBox' || printTarget.id === box.id), noBox: [] }}
              company={company}
              startDate={startDate}
              endDate={endDate}
              fmtDate={fmtDate}
            />
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

// === Subcomponente: Grupo por Box com adição de itens manuais ===
function BoxGroup({ box, rows, startDate, onItemAdded, forceOpen, onPrint, onDeleteRow }) {
  const [showAdd, setShowAdd] = useState(false);
  const [open, setOpen] = useState(false);
  const [newItem, setNewItem] = useState({ product_name: '', quantity: 1, client_name: '' });
  const expanded = forceOpen || open;

  const totalQty = rows.reduce((s, r) => s + r.qtde, 0);

  // Agrupa itens por cliente dentro do box
  const clientGroups = useMemo(() => {
    const map = new Map();
    rows.forEach(r => {
      const key = r.cnpj || r.cliente || '—';
      if (!map.has(key)) map.set(key, { cliente: r.cliente || '—', cnpj: r.cnpj || '', caminhoes: new Set(), rows: [] });
      const g = map.get(key);
      g.rows.push(r);
      if (r.caminhao) g.caminhoes.add(r.caminhao);
    });
    return [...map.values()].sort((a, b) => a.cliente.localeCompare(b.cliente, 'pt-BR'));
  }, [rows]);

  const addMutation = useMutation({
    mutationFn: (data) => base44.entities.CeasaReportItem.create(data),
    onSuccess: () => { onItemAdded(); toast.success('Item adicionado ao Box.'); setNewItem({ product_name: '', quantity: 1, client_name: '' }); setShowAdd(false); },
    onError: () => toast.error('Erro ao adicionar item.'),
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
    <Card className="overflow-hidden border-2 border-primary/15 print:break-inside-avoid">
      <div
        className={`bg-primary/8 px-4 py-3 flex items-center justify-between gap-2 ${!forceOpen ? 'hover:bg-primary/12 cursor-pointer' : ''}`}
        onClick={!forceOpen ? () => setOpen(o => !o) : undefined}
      >
        <div>
          <p className="font-bold text-primary">{box.name}</p>
          {box.cnpj && <p className="text-xs text-muted-foreground">CNPJ: {box.cnpj}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-primary text-primary-foreground">{totalQty} un. total</Badge>
          {onPrint && (
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 print:hidden"
              title="Imprimir este Box"
              onClick={(e) => { e.stopPropagation(); onPrint(); }}
            >
              <Printer className="w-4 h-4" />
            </Button>
          )}
          {!forceOpen && (
            <Button size="icon" variant="ghost" className="h-7 w-7 print:hidden" onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}>
              {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </Button>
          )}
          {!forceOpen && (
            <Button size="sm" variant="outline" className="h-7 gap-1 print:hidden" onClick={(e) => { e.stopPropagation(); setShowAdd(!showAdd); }}>
              <Plus className="w-3.5 h-3.5" /> Adicionar item
            </Button>
          )}
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

      {expanded && (
      <div className="divide-y">
        {clientGroups.map((cg, gi) => {
          const caminhaoLabel = [...cg.caminhoes].filter(Boolean).join(', ');
          const clientQty = cg.rows.reduce((s, r) => s + r.qtde, 0);
          const clientValor = cg.rows.reduce((s, r) => s + r.subtotal, 0);
          return (
            <div key={gi} className="px-4 py-2">
              {/* Sub-cabeçalho do cliente dentro do box */}
              <div className="flex items-start justify-between gap-2 mb-1 pb-1 border-b border-dashed">
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">{cg.cliente}</p>
                  {cg.cnpj && <p className="text-xs text-muted-foreground font-mono">CNPJ: {cg.cnpj}</p>}
                  {caminhaoLabel && <p className="text-xs text-muted-foreground">Caminhão: {caminhaoLabel}</p>}
                </div>
                <Badge variant="secondary" className="shrink-0">{clientQty} un.</Badge>
              </div>
              <div className="divide-y">
                {cg.rows.map((r, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">
                        {r.produto}
                        {r.isManual && <Badge variant="outline" className="ml-1.5 text-[10px] text-blue-600 border-blue-300">Manual</Badge>}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {r.valorCeasa > 0 && <span className="text-xs text-muted-foreground">R$ {r.valorCeasa.toFixed(2)}/un</span>}
                      <span className="font-bold text-primary">{r.qtde}</span>
                      {!forceOpen && onDeleteRow && (r.operation || r.isManual) && (
                        <ReportRowDeleteButton
                          onConfirm={() => onDeleteRow(r)}
                          description={r.isManual
                            ? 'Este item manual será removido do Box.'
                            : 'A operação CEASA deste item será removida. O pedido e seus itens permanecem intactos.'}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {clientValor > 0 && (
                <p className="text-right text-xs text-muted-foreground mt-1">Subtotal cliente: R$ {clientValor.toFixed(2)}</p>
              )}
            </div>
          );
        })}
        {rows.length === 0 && <p className="text-center text-xs text-muted-foreground py-4">Nenhum item neste Box.</p>}
      </div>
      )}
    </Card>
  );
}