import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight, Truck } from 'lucide-react';
import CeasaOperationItemRow from '@/components/admin/CeasaOperationItemRow';

/**
 * Pedido dentro do card do cliente. Ao expandir, mostra os itens e a
 * operação CEASA de cada um.
 */
export default function CeasaOrderSection({ order, boxes, startDate, onDeleteRow }) {
  const [open, setOpen] = useState(false);

  const totalQty = order.rows.reduce((s, r) => s + r.qtde, 0);
  const totalValor = order.rows.reduce((s, r) => s + r.subtotal, 0);
  const savedCount = order.rows.filter(r => r.operation).length;

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
          {order.rows.map(r => (
            <CeasaOperationItemRow
              key={r.itemKey}
              row={r}
              boxes={boxes}
              startDate={startDate}
              onDeleteRow={onDeleteRow}
            />
          ))}
        </div>
      )}
    </div>
  );
}