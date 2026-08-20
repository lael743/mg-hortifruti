import React, { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, Truck, Building2, Package, Printer } from 'lucide-react';
import ReportRowDeleteButton from '@/components/admin/ReportRowDeleteButton';

export default function ClientReportCard({ cliente, cnpj, caminhoes, rows, productToBox, forceOpen, onPrint, onDeleteRow }) {
  const [open, setOpen] = useState(false);
  const expanded = forceOpen || open;

  const totalQty = rows.reduce((s, r) => s + r.qtde, 0);
  const totalValor = rows.reduce((s, r) => s + r.subtotal, 0);
  const caminhaoLabel = caminhoes.filter(Boolean).join(', ') || '—';

  // Agrupa itens por box dentro do cliente
  const { boxGroups, noBoxRows } = useMemo(() => {
    const map = new Map();
    const noBox = [];
    rows.forEach(r => {
      const box = r.productId ? productToBox[r.productId] : null;
      if (box) {
        if (!map.has(box.id)) map.set(box.id, { box, rows: [] });
        map.get(box.id).rows.push(r);
      } else {
        noBox.push(r);
      }
    });
    return { boxGroups: [...map.values()].sort((a, b) => a.box.name.localeCompare(b.box.name, 'pt-BR')), noBoxRows: noBox };
  }, [rows, productToBox]);

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

      {/* Lista expansível — itens agrupados por box */}
      {expanded && (
        <div className="divide-y">
          {boxGroups.map(({ box, rows: bRows }) => (
            <div key={box.id} className="px-4 py-2">
              <p className="text-xs font-semibold text-primary/80 uppercase tracking-wide mb-1 flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5" /> {box.name}
                <Badge variant="outline" className="text-[10px] ml-1">{bRows.reduce((s, r) => s + r.qtde, 0)} un.</Badge>
              </p>
              <div className="divide-y">
                {bRows.map((r, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 text-sm">
                    <span className="font-medium truncate flex-1">{r.produto}</span>
                    <div className="flex items-center gap-4 shrink-0">
                      <span className="text-xs text-muted-foreground">R$ {r.valorUn.toFixed(2)}/un</span>
                      <span className="font-bold text-primary text-center w-12">{r.qtde}</span>
                      <span className="text-right w-20">R$ {r.subtotal.toFixed(2)}</span>
                      {!forceOpen && onDeleteRow && <ReportRowDeleteButton onConfirm={() => onDeleteRow(r)} />}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {noBoxRows.length > 0 && (
            <div className="px-4 py-2 border-amber-200 bg-amber-50/40">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">Sem Box associado</p>
              <div className="divide-y">
                {noBoxRows.map((r, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 text-sm">
                    <span className="font-medium truncate flex-1">{r.produto}</span>
                    <div className="flex items-center gap-4 shrink-0">
                      <span className="text-xs text-muted-foreground">R$ {r.valorUn.toFixed(2)}/un</span>
                      <span className="font-bold text-primary text-center w-12">{r.qtde}</span>
                      <span className="text-right w-20">R$ {r.subtotal.toFixed(2)}</span>
                      {!forceOpen && onDeleteRow && <ReportRowDeleteButton onConfirm={() => onDeleteRow(r)} />}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {rows.length === 0 && <p className="text-center text-xs text-muted-foreground py-4">Nenhum item.</p>}
        </div>
      )}
    </Card>
  );
}