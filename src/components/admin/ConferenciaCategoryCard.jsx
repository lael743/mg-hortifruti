import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChevronDown, ChevronRight } from 'lucide-react';

const ROWS_VISIBLE = 20;

const money = (value) => (value == null ? '—' : `R$ ${Number(value).toFixed(2)}`);

/**
 * Card de uma categoria de divergência da Conferência CEASA.
 * Somente leitura, colapsado por padrão.
 */
export default function ConferenciaCategoryCard({ category }) {
  const [open, setOpen] = useState(false);
  const rows = category.rows || [];
  const visible = rows.slice(0, ROWS_VISIBLE);

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          {open ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
          <span className="font-semibold text-sm truncate">{category.label}</span>
        </div>
        <Badge variant={category.count > 0 ? 'destructive' : 'secondary'} className="shrink-0">
          {category.count}
        </Badge>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          <p className="text-xs text-muted-foreground">{category.description}</p>

          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-3 text-center">Nenhuma ocorrência nesta categoria.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pedido</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Box</TableHead>
                    <TableHead className="text-right">Valor CEASA</TableHead>
                    <TableHead>Caminhão</TableHead>
                    <TableHead className="text-right">Criado em</TableHead>
                    <TableHead>Detalhe</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((row, index) => (
                    <TableRow key={`${row.operation_id || row.order_id}-${index}`}>
                      <TableCell className="whitespace-nowrap">{row.order_number ?? '—'}</TableCell>
                      <TableCell className="max-w-[180px] truncate" title={row.cliente}>{row.cliente || '—'}</TableCell>
                      <TableCell className="max-w-[160px] truncate" title={row.produto}>{row.produto || '—'}</TableCell>
                      <TableCell className="max-w-[140px] truncate" title={row.box}>{row.box || '—'}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{money(row.valor_ceasa)}</TableCell>
                      <TableCell className="max-w-[130px] truncate" title={row.caminhao}>{row.caminhao || '—'}</TableCell>
                      <TableCell className="text-right whitespace-nowrap text-muted-foreground">{row.criado_em || '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{row.detalhe}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {rows.length > visible.length && (
                <p className="text-xs text-muted-foreground mt-2">
                  Mostrando {visible.length} de {rows.length} registros — exporte o CSV para ver todos.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}