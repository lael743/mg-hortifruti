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

/**
 * Pedido dentro do card do cliente. Ao expandir, mostra a aplicação global de
 * caminhão e a operação CEASA de cada item.
 */
export default function CeasaOrderSection({ order, boxes, trucks = [], startDate, onDeleteRow }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [bulkTruck, setBulkTruck] = useState('');

  const totalQty = order.rows.reduce((s, r) => s + r.qtde, 0);
  const totalValor = order.rows.reduce((s, r) => s + r.subtotal, 0);
  const savedCount = order.rows.filter(r => r.operation).length;

  // Aplica o caminhão a todos os itens do pedido, criando a operação quando não existir.
  // Nunca altera o Order nem os demais campos da operação (Box, valor CEASA, quantidade, observação).
  const applyTruckMutation = useMutation({
    mutationFn: async (truckName) => {
      const existing = await base44.entities.CeasaReportItem.filter(
        { order_id: order.orderId },
        '-created_date',
        500
      );
      const byKey = {};
      existing.forEach(op => {
        if (op.item_key && !byKey[op.item_key]) byKey[op.item_key] = op;
      });

      const toUpdate = [];
      const toCreate = [];
      order.rows.forEach(r => {
        const op = byKey[r.itemKey];
        if (op) {
          if ((op.caminhao || '') !== truckName) toUpdate.push({ id: op.id, caminhao: truckName });
          return;
        }
        toCreate.push({
          order_id: order.orderId,
          item_key: r.itemKey,
          product_id: r.productId || '',
          product_name: r.produto,
          quantity: r.qtde,
          client_name: r.cliente || '',
          nfe_company_name: r.nfeCompanyName || '',
          nfe_cnpj: r.cnpj || '',
          caminhao: truckName,
          date: r.orderDate || startDate,
        });
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
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 px-4 py-2 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          {open ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
          <span className="font-semibold text-sm">Pedido #{order.orderNumber ?? '—'}</span>
          {order.caminhao && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Truck className="w-3 h-3" /> {order.caminhao}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="outline" className="text-[10px]">
            {savedCount}/{order.rows.length} operações
          </Badge>
          <Badge variant="secondary">{totalQty} un.</Badge>
          <Badge variant="secondary">R$ {totalValor.toFixed(2)}</Badge>
        </div>
      </button>

      {open && (
        <div className="divide-y border-t">
          <div className="px-4 py-3 bg-muted/20 flex flex-wrap items-end gap-2">
            <div className="w-[240px]">
              <Label className="text-[11px] text-muted-foreground">Aplicar caminhão a todos os itens</Label>
              <TruckCombobox
                trucks={trucks}
                value={bulkTruck}
                onChange={setBulkTruck}
                placeholder="Selecionar caminhão"
              />
            </div>
            <Button
              size="sm"
              className="h-8 gap-1"
              disabled={!bulkTruck || applyTruckMutation.isPending}
              onClick={() => applyTruckMutation.mutate(bulkTruck)}
            >
              <Truck className="w-3.5 h-3.5" /> Aplicar a todos os itens
            </Button>
            <p className="text-[11px] text-muted-foreground basis-full">
              Altera apenas o caminhão das operações CEASA deste pedido. Box, valor CEASA, quantidade e observação são preservados.
            </p>
          </div>

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
        </div>
      )}
    </div>
  );
}