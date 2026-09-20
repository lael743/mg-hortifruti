import React, { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, Truck, Building2, Printer } from 'lucide-react';
import CeasaOrderSection from '@/components/admin/CeasaOrderSection';

export default function ClientReportCard({ cliente, cnpj, caminhoes, rows, boxes = [], trucks = [], startDate, forceOpen, onPrint, onDeleteRow }) {
  const [open, setOpen] = useState(false);
  const expanded = forceOpen || open;

  const totalQty = rows.reduce((s, r) => s + r.qtde, 0);
  const totalValor = rows.reduce((s, r) => s + r.subtotal, 0);
  const caminhaoLabel = caminhoes.filter(Boolean).join(', ') || '—';

  // Agrupa os itens por pedido — a operação CEASA é feita item a item
  const orders = useMemo(() => {
    const map = new Map();
    rows.forEach(r => {
      if (!map.has(r.orderId)) {
        map.set(r.orderId, { orderId: r.orderId, orderNumber: r.orderNumber, caminhao: r.caminhao, rows: [] });
      }
      map.get(r.orderId).rows.push(r);
    });
    return [...map.values()].sort((a, b) => (a.orderNumber || 0) - (b.orderNumber || 0));
  }, [rows]);

  return (
    <Card className="overflow-hidden print:break-inside-avoid">
      {/* Cabeçalho do cliente — Caminhão, CNPJ e Cliente aparecem só aqui */}
      <div
        className={`w-full flex items-center justify-between gap-3 px-4 py-3 bg-primary/8 ${!forceOpen ? 'hover:bg-primary/12 cursor-pointer' : ''} transition-colors text-left`}
        onClick={!forceOpen ? () => setOpen(o => !o) : undefined}
      >
        <div className="min-w-0 flex-1">
          <p className="font-bold text-primary truncate flex items-center gap-1.5">
            {cliente || '—'}
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 mt-0.5">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Building2 className="w-3 h-3" /> {cnpj || '—'}
            </span>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Truck className="w-3 h-3" /> {caminhaoLabel}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge className="bg-primary text-primary-foreground">{totalQty} un.</Badge>
          <Badge variant="secondary">R$ {totalValor.toFixed(2)}</Badge>
          {onPrint && (
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 print:hidden"
              title="Imprimir este cliente"
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
        </div>
      </div>

      {/* Lista expansível — pedidos do cliente e seus itens */}
      {expanded && (
        <div className="divide-y">
          {orders.map(o => (
            <CeasaOrderSection
              key={o.orderId}
              order={o}
              boxes={boxes}
              trucks={trucks}
              startDate={startDate}
              onDeleteRow={onDeleteRow}
            />
          ))}
          {rows.length === 0 && <p className="text-center text-xs text-muted-foreground py-4">Nenhum item.</p>}
        </div>
      )}
    </Card>
  );
}