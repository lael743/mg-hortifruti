import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, Truck, Building2 } from 'lucide-react';

export default function ClientReportCard({ cliente, cnpj, caminhoes, rows, productToBox }) {
  const [open, setOpen] = useState(true);

  const totalQty = rows.reduce((s, r) => s + r.qtde, 0);
  const totalValor = rows.reduce((s, r) => s + r.subtotal, 0);
  const caminhaoLabel = caminhoes.filter(Boolean).join(', ') || '—';

  return (
    <Card className="overflow-hidden">
      {/* Cabeçalho do cliente — Caminhão, CNPJ e Cliente aparecem só aqui */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-primary/8 hover:bg-primary/12 transition-colors text-left"
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
          <Button size="icon" variant="ghost" className="h-7 w-7">
            {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </Button>
        </div>
      </button>

      {/* Lista expansível de produtos */}
      {open && (
        <div className="divide-y">
          {rows.map((r, i) => {
            const box = r.productId ? productToBox[r.productId] : null;
            return (
              <div key={i} className="flex items-center justify-between px-4 py-2 text-sm hover:bg-muted/20">
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate flex items-center gap-1.5">
                    {r.produto}
                    {box && <Badge variant="outline" className="text-[10px]">{box.name}</Badge>}
                  </p>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <span className="text-xs text-muted-foreground">R$ {r.valorUn.toFixed(2)}/un</span>
                  <span className="font-bold text-primary text-center w-12">{r.qtde}</span>
                  <span className="text-right w-20">R$ {r.subtotal.toFixed(2)}</span>
                </div>
              </div>
            );
          })}
          {rows.length === 0 && <p className="text-center text-xs text-muted-foreground py-4">Nenhum item.</p>}
        </div>
      )}
    </Card>
  );
}