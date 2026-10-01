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
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, Printer, Package, Search, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import ClientReportCard from '@/components/admin/ClientReportCard';
import CeasaProductGroup from '@/components/admin/CeasaProductGroup';
import CeasaPrintLayout from '@/components/admin/CeasaPrintLayout';

const LOCAL_TZ = 'America/Porto_Velho';

function todayStr() {
  return new Date().toLocaleDateString('en-CA', { timeZone: LOCAL_TZ });
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR');
}

// Normaliza texto para busca: sem acentos e sem pontuação
function normalize(s) {
  return (s || '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .toLowerCase()
    .trim();
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
  const [search, setSearch] = useState('');
  const [printing, setPrinting] = useState(false);

  // === Impressão única: Relação CEASA ===
  const doPrint = () => {
    setPrinting(true);
    document.body.classList.add('ceasa-printing');
    const cleanup = () => {
      document.body.classList.remove('ceasa-printing');
      setPrinting(false);
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

  // Filtra pedidos por data e que requerem NF-e.
  // requires_nfe = true → TODOS os itens do pedido participam da Gestão CEASA.
  const nfeOrders = useMemo(() => {
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T23:59:59');
    return allOrders.filter(o => {
      if (!o.requires_nfe) return false;
      const created = new Date(o.created_date);
      return created >= start && created <= end && o.status !== 'Cancelado';
    });
  }, [allOrders, startDate, endDate]);

  // Operações CEASA ativas, indexadas por order_id + line_id.
  // Operações inativas (item removido do pedido ou pedido sem NF-e) ficam fora da Gestão.
  const operationByLineId = useMemo(() => {
    const map = {};
    reportItems.forEach(ri => {
      if (ri.active === false) return;
      if (ri.order_id && ri.line_id && !map[`${ri.order_id}:${ri.line_id}`]) {
        map[`${ri.order_id}:${ri.line_id}`] = ri;
      }
    });
    return map;
  }, [reportItems]);

  const boxById = useMemo(() => {
    const map = {};
    boxes.forEach(b => { map[b.id] = b; });
    return map;
  }, [boxes]);

  // Achata os itens dos pedidos NF-e. Não existe seleção individual de itens:
  // o pedido inteiro entra na Gestão CEASA. Itens de bônus (brinde) ficam fora.
  const flatRows = useMemo(() => {
    const rows = [];
    nfeOrders.forEach(o => {
      (o.items || []).forEach(it => {
        if (it.is_bonus) return;
        // Identidade da linha: order_id + line_id — nunca a posição no array
        const lineId = it.line_id || null;
        const operation = lineId ? operationByLineId[`${o.id}:${lineId}`] || null : null;
        // O relatório usa os dados da operação CEASA, não os valores fiscais do pedido
        const qtde = operation?.quantity ?? it.quantity;
        const valorCeasa = operation?.ceasa_value ?? it.final_unit_price ?? 0;
        rows.push({
          orderId: o.id,
          orderNumber: o.order_number,
          lineId,
          // Chave de compatibilidade — reflete a identidade, não o índice
          itemKey: lineId ? `${o.id}:${lineId}` : null,
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
  }, [nfeOrders, operationByLineId, boxById]);

  // Agrupamento por Box — usado exclusivamente na impressão.
  // Itens sem Box não são impressos.
  const printGroups = useMemo(() => {
    const groups = {};
    flatRows.forEach(row => {
      if (!row.box) return;
      if (!groups[row.box.id]) groups[row.box.id] = { box: row.box, rows: [] };
      groups[row.box.id].rows.push(row);
    });
    return Object.values(groups).sort((a, b) => a.box.name.localeCompare(b.box.name, 'pt-BR'));
  }, [flatRows]);

  // Busca por cliente ou produto — ignora acentos e pontuação
  const searchedRows = useMemo(() => {
    const q = normalize(search);
    if (!q) return flatRows;
    return flatRows.filter(r => normalize(r.cliente).includes(q) || normalize(r.produto).includes(q));
  }, [flatRows, search]);

  // Agrupamento por produto — aba "Itens Agrupado" (operação em massa por produto)
  const groupedByProduct = useMemo(() => {
    const map = new Map();
    searchedRows.forEach(r => {
      const key = r.produto || '—';
      if (!map.has(key)) map.set(key, { produto: key, rows: [] });
      map.get(key).rows.push(r);
    });
    return [...map.values()].sort((a, b) => a.produto.localeCompare(b.produto, 'pt-BR'));
  }, [searchedRows]);

  // Totais
  const totalRows = flatRows.length;
  const totalValor = flatRows.reduce((s, r) => s + r.subtotal, 0);
  const totalClientes = new Set(nfeOrders.map(o => o.nfe_cnpj || o.customer_email)).size;

  // Agrupamento por cliente para a Lista por Cliente
  const groupedByClient = useMemo(() => {
    const map = new Map();
    searchedRows.forEach(r => {
      const key = r.cnpj || r.cliente || '—';
      if (!map.has(key)) map.set(key, { cliente: r.cliente, cnpj: r.cnpj, caminhoes: new Set(), rows: [] });
      const g = map.get(key);
      g.rows.push(r);
      if (r.caminhao) g.caminhoes.add(r.caminhao);
    });
    return [...map.values()].sort((a, b) => a.cliente.localeCompare(b.cliente, 'pt-BR'));
  }, [searchedRows]);

  // Totais dos itens exibidos (respeitam a busca)
  const searchedQty = searchedRows.reduce((s, r) => s + r.qtde, 0);
  const searchedValor = searchedRows.reduce((s, r) => s + r.subtotal, 0);

  // === Exportação CSV (dados da operação CEASA) ===
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
    const csv = '\uFEFF' + lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relacao-ceasa-${startDate}_a_${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exportado!');
  };

  // === Excluir a operação CEASA de um item ===
  // Remove somente o CeasaReportItem. O pedido e seus itens nunca são alterados.
  const deleteRowMutation = useMutation({
    mutationFn: async (row) => {
      const reportItemId = row.operation?.id;
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
          <Button
            size="sm"
            className="gap-1"
            onClick={doPrint}
            disabled={printGroups.length === 0}
            title={printGroups.length === 0 ? 'Nenhum item com Box definido' : 'Imprimir a Relação CEASA'}
          >
            <Printer className="w-4 h-4" /> Imprimir Relação CEASA
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

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center gap-3 flex-wrap print:hidden">
          <TabsList>
            <TabsTrigger value="lista">Lista por Cliente</TabsTrigger>
            <TabsTrigger value="itens">Itens Agrupado</TabsTrigger>
          </TabsList>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por cliente ou produto..."
              className="pl-9 pr-8"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                title="Limpar busca"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* === Aba 1: Lista por Cliente (ajustes individuais) === */}
        <TabsContent value="lista">
          {searchedRows.length === 0 ? (
            <Card className="p-8 text-center">
              <Package className="w-10 h-10 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-muted-foreground">
                {search
                  ? 'Nenhum cliente ou produto encontrado para a busca.'
                  : 'Nenhum pedido com NF-e no período selecionado.'}
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-end gap-3 text-sm">
                <Badge variant="secondary">{groupedByClient.length} clientes</Badge>
                <Badge variant="secondary">{searchedQty} un.</Badge>
                <Badge className="bg-primary text-primary-foreground">R$ {searchedValor.toFixed(2)}</Badge>
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
                  onDeleteRow={(r) => deleteRowMutation.mutate(r)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* === Aba 2: Itens Agrupado (operação em massa por produto) === */}
        <TabsContent value="itens">
          {groupedByProduct.length === 0 ? (
            <Card className="p-8 text-center">
              <Package className="w-10 h-10 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-muted-foreground">
                {search
                  ? 'Nenhum produto encontrado para a busca.'
                  : 'Nenhum item para agrupar no período selecionado.'}
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-end gap-3 text-sm">
                <Badge variant="secondary">{groupedByProduct.length} produtos</Badge>
                <Badge variant="secondary">{searchedRows.length} itens</Badge>
                <Badge variant="secondary">{searchedQty} un.</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Aplique um Box a todos os itens de um produto de uma só vez. Depois, se um pedido específico
                precisar de outro Box, ajuste individualmente na aba "Lista por Cliente".
              </p>

              <Card className="overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8 px-2" />
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-right">Clientes</TableHead>
                      <TableHead className="text-right">Itens</TableHead>
                      <TableHead className="text-right">Qtde</TableHead>
                      <TableHead className="text-right">Aplicar Box</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupedByProduct.map(g => (
                      <CeasaProductGroup key={g.produto} produto={g.produto} rows={g.rows} boxes={boxes} />
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* === Portal de impressão — Relação CEASA, um Box por página === */}
      {printing && createPortal(
        <div className="ceasa-print-root" style={{ padding: '8px 12px' }}>
          <CeasaPrintLayout
            groups={printGroups}
            company={company}
            startDate={startDate}
            endDate={endDate}
            fmtDate={fmtDate}
          />
        </div>,
        document.body
      )}
    </div>
  );
}