import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ChevronDown, ChevronRight, Truck } from 'lucide-react';
import CeasaOperationItemRow from '@/components/admin/CeasaOperationItemRow';
import TruckCombobox from '@/components/admin/TruckCombobox';
import { formatCeasaMoney } from '@/lib/ceasaValue';
import { operationsForLine, pickOperation } from '@/lib/ceasaOperations';
import { fetchAllPages } from '@/lib/pagination';

// Colunas da tabela operacional — espelham a linha em CeasaOperationItemRow
const COLUMNS = [
  { key: 'produto', label: 'Produto' },
  { key: 'qtde', label: 'Qtde', align: 'right' },
  { key: 'valor', label: 'Valor pedido', align: 'right' },
  { key: 'box', label: 'Box' },
  { key: 'ceasa', label: 'Valor CEASA', align: 'right' },
  { key: 'caminhao', label: 'Caminhão' },
  { key: 'obs', label: 'Observação' },
  { key: 'acao', label: 'Ação', align: 'right' },
];

/**
 * Pedido dentro do card do cliente. Cabeçalho compacto e, ao expandir,
 * a tabela operacional com a operação CEASA de cada item.
 */
export default function CeasaOrderSection({ order, boxes, trucks = [], startDate, onDeleteRow }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [bulkTruck, setBulkTruck] = useState('');

  const totalQty = order.rows.reduce((s, r) => s + r.qtde, 0);
  const totalValor = order.rows.reduce((s, r) => s + r.subtotal, 0);
  const savedCount = order.rows.filter(r => r.operation).length;
  // Caminhão vem da operação CEASA de cada item — um mesmo pedido pode ter mais de um
  const orderTrucks = [...new Set(order.rows.map(r => r.caminhao).filter(Boolean))];

  // Aplica o caminhão a todos os itens do pedido, criando a operação quando não existir.
  // Nunca altera o Order nem os demais campos da operação (Box, valor CEASA, quantidade, observação).
  const applyTruckMutation = useMutation({
    mutationFn: async (truckName) => {
      const { items: existing } = await fetchAllPages((cursor) => {
        const options = { sort: '-created_date', limit: 500 };
        if (cursor) options.cursor = cursor;
        return base44.entities.CeasaReportItem.filter({ order_id: order.orderId }, options);
      });
      const toUpdate = [];
      const toCreate = [];
      order.rows.forEach(r => {
        // Identidade da operação: order_id + line_id (nunca a posição do item).
        // Mesma resolução da leitura: a operação mais recente ativa da linha.
        const op = pickOperation(operationsForLine(existing, order.orderId, r.lineId));
        if (op) {
          if ((op.caminhao || '') !== truckName) toUpdate.push({ id: op.id, caminhao: truckName });
          return;
        }
        const record = {
          order_id: order.orderId,
          line_id: r.lineId,
          item_key: r.itemKey,
          product_id: r.productId || '',
          product_name: r.produto,
          quantity: r.qtde,
          client_name: r.cliente || '',
          nfe_company_name: r.nfeCompanyName || '',
          nfe_cnpj: r.cnpj || '',
          caminhao: truckName,
          date: r.orderDate || startDate,
        };
        // Item sem preço comercial: a operação nasce sem valor definido.
        if (r.valorCeasaBase > 0) record.ceasa_value = r.valorCeasaBase;
        toCreate.push(record);
      });

      if (toUpdate.length) await base44.entities.CeasaReportItem.bulkUpdate(toUpdate);
      if (toCreate.length) await base44.entities.CeasaReportItem.bulkCreate(toCreate);
      return { updated: toUpdate.length, created: toCreate.length };
    },
    onSuccess: ({ updated, created }) => {
      queryClient.invalidateQueries({ queryKey: ['ceasa-report-items'] });
      toast.success(`Caminhão aplicado — ${updated} operação(ões) atualizada(s), ${created} criada(s).`);
    },
    onError: () => toast.error('Erro ao aplicar o caminhão aos itens.'),
  });

  return (
    <div>
      {/* Cabeçalho do pedido — compacto */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 px-3 py-2 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          {open ? (
            <ChevronDown className="w-4 h-4 shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 shrink-0" />
          )}
          <span className="font-semibold text-sm whitespace-nowrap">Pedido #{order.orderNumber ?? '—'}</span>
          {orderTrucks.length > 0 && (
            <span className="text-xs text-muted-foreground flex items-center gap-1 truncate">
              <Truck className="w-3 h-3 shrink-0" /> {orderTrucks.join(', ')}
            </span>
          )}
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {order.rows.length} itens · {savedCount} salvas
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="secondary" className="text-[10px]">{totalQty} un.</Badge>
          <Badge variant="secondary" className="text-[10px]">R$ {formatCeasaMoney(totalValor)}</Badge>
        </div>
      </button>

      {open && (
        <>
          {/* Aplicação global do caminhão no pedido */}
          <div className="px-3 py-2 bg-muted/20 border-t flex flex-wrap items-center gap-2">
            <Label className="text-[11px] text-muted-foreground whitespace-nowrap">
              Aplicar caminhão a todos os itens
            </Label>
            <div className="w-[190px]">
              <TruckCombobox
                trucks={trucks}
                value={bulkTruck}
                onChange={setBulkTruck}
                placeholder="Selecionar caminhão"
                className="h-7 px-2 text-xs"
              />
            </div>
            <Button
              size="sm"
              className="h-7 gap-1 text-xs"
              disabled={!bulkTruck || applyTruckMutation.isPending}
              onClick={() => applyTruckMutation.mutate(bulkTruck)}
            >
              <Truck className="w-3.5 h-3.5" /> Aplicar
            </Button>
            <span className="text-[11px] text-muted-foreground">
              Altera apenas o caminhão das operações deste pedido.
            </span>
          </div>

          {/* Tabela operacional dos itens */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-y bg-muted/40">
                  {COLUMNS.map(c => (
                    <th
                      key={c.key}
                      className={`px-2 py-1.5 text-[11px] font-semibold text-muted-foreground whitespace-nowrap ${c.align === 'right' ? 'text-right' : 'text-left'}`}
                    >
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {order.rows.map(r => (
                  <CeasaOperationItemRow
                    key={r.itemKey}
                    row={r}
                    boxes={boxes}
                    trucks={trucks}
                    startDate={startDate}
                    onDeleteRow={onDeleteRow}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}