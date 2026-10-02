import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Percent } from 'lucide-react';
import { formatCeasaMoney, parseCeasaValueInput } from '@/lib/ceasaValue';
import { buildCeasaBatchPreview, isValidAdjustPercent, MEIA_NOTA_PERCENT } from '@/lib/ceasaBatchAdjust';
import { operationsForLine, pickOperation } from '@/lib/ceasaOperations';
import { fetchAllPages } from '@/lib/pagination';

const MOTIVO_LABEL = {
  zero: 'valor CEASA 0,00 — mantido',
  'sem-valor': 'sem valor CEASA informado',
  'sem-operacao': 'operação não salva',
};

/**
 * Ajuste em lote dos valores CEASA de um pedido: redução percentual (meia nota ou
 * percentual informado) nos itens selecionados.
 *
 * Grava SOMENTE `ceasa_value` das operações das linhas selecionadas deste pedido —
 * preço comercial, quantidade, Box, caminhão, observação e o pedido nunca são
 * tocados. A identidade é resolvida por order_id + line_id na releitura antes da
 * gravação, com a mesma regra da leitura. Sempre mostra a prévia com o total
 * anterior e o novo total e exige confirmação explícita: cancelar não grava nada.
 */
export default function CeasaBatchAdjustDialog({ open, onOpenChange, order, rows = [] }) {
  const queryClient = useQueryClient();
  const [percentText, setPercentText] = useState('');
  const [selected, setSelected] = useState({});

  const percentual = parseCeasaValueInput(percentText);
  const percentualValido = isValidAdjustPercent(percentual);

  const preview = useMemo(
    () => buildCeasaBatchPreview(rows, order?.orderId, percentual, Object.keys(selected).filter(k => selected[k])),
    [rows, order?.orderId, percentual, selected]
  );

  const ajustaveis = preview.linhas.filter(l => l.ajustavel);
  const todosMarcados = ajustaveis.length > 0 && ajustaveis.every(l => selected[l.lineId]);

  const alternar = (lineId) => setSelected(s => ({ ...s, [lineId]: !s[lineId] }));
  const alternarTodos = (marcar) => setSelected(Object.fromEntries(ajustaveis.map(l => [l.lineId, marcar])));

  // Abrir sempre com todos os itens ajustáveis marcados e o percentual em branco.
  // A inicialização vive aqui (não no clique de quem abre): o diálogo é reutilizável
  // e nunca fica com seleção vazia por causa do ponto de abertura.
  // Cancelar/fechar não grava nada — nenhuma escrita acontece antes da confirmação.
  useEffect(() => {
    if (!open) return;
    setPercentText('');
    setSelected(Object.fromEntries(
      rows
        .filter(r => r.operation?.ceasa_value != null && Number(r.operation.ceasa_value) !== 0)
        .map(r => [r.lineId, true])
    ));
  }, [open]);

  const mutation = useMutation({
    mutationFn: async () => {
      // Releitura das operações do próprio pedido antes de gravar: cada ajuste é
      // aplicado exatamente na operação que a linha exibe (order_id + line_id),
      // nunca em outra linha, em outro pedido ou em outro cliente.
      const { items: existing } = await fetchAllPages((cursor) => {
        const options = { sort: '-created_date', limit: 500 };
        if (cursor) options.cursor = cursor;
        return base44.entities.CeasaReportItem.filter({ order_id: order.orderId }, options);
      });
      const toUpdate = [];
      preview.ajustes.forEach(a => {
        const target = pickOperation(operationsForLine(existing, order.orderId, a.lineId));
        if (!target) return;
        toUpdate.push({ id: target.id, ceasa_value: a.para });
      });
      if (!toUpdate.length) return { updated: 0 };
      await base44.entities.CeasaReportItem.bulkUpdate(toUpdate);
      return { updated: toUpdate.length };
    },
    onSuccess: ({ updated }) => {
      queryClient.invalidateQueries({ queryKey: ['ceasa-report-items'] });
      toast.success(`Ajuste em lote aplicado — ${updated} operação(ões) atualizada(s).`);
      onOpenChange(false);
    },
    onError: () => toast.error('Erro ao aplicar o ajuste em lote.'),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Ajuste em lote — valores CEASA</DialogTitle>
          <DialogDescription>
            Pedido #{order?.orderNumber ?? '—'} · {rows[0]?.cliente || 'cliente'} — reduz apenas o valor CEASA
            das operações selecionadas deste pedido. Preço comercial, quantidade, Box, caminhão, observação e
            o pedido não são alterados.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs">Reduzir em (%)</Label>
            <Input
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="Ex.: 5"
              aria-label="Percentual de redução do ajuste em lote"
              className="h-8 w-24 text-xs"
              value={percentText}
              onChange={e => setPercentText(e.target.value)}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1 text-xs"
            onClick={() => setPercentText(String(MEIA_NOTA_PERCENT))}
            title="Reduz pela metade os valores CEASA selecionados"
          >
            <Percent className="w-3.5 h-3.5" /> Meia nota (50%)
          </Button>
          <span className="text-xs text-muted-foreground">
            {percentualValido
              ? `Redução de ${percentual}% nos itens selecionados.`
              : 'Informe um percentual maior que 0 e até 100.'}
          </span>
        </div>

        {/* Prévia: produto, valor atual e valor após o ajuste */}
        <div className="max-h-[320px] overflow-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={todosMarcados}
                    disabled={ajustaveis.length === 0}
                    onCheckedChange={(v) => alternarTodos(!!v)}
                    aria-label="Selecionar todos os itens"
                    title="Selecionar todos os itens"
                  />
                </TableHead>
                <TableHead>Produto</TableHead>
                <TableHead className="text-right">Valor CEASA atual</TableHead>
                <TableHead className="text-right">Valor CEASA após o ajuste</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {preview.linhas.map(l => (
                <TableRow key={l.lineId}>
                  <TableCell className="py-1.5">
                    <Checkbox
                      checked={!!selected[l.lineId] && l.ajustavel}
                      disabled={!l.ajustavel}
                      onCheckedChange={() => alternar(l.lineId)}
                      aria-label={`Selecionar ${l.produto}`}
                    />
                  </TableCell>
                  <TableCell className="py-1.5">
                    <span className="block max-w-[260px] truncate text-xs font-medium" title={l.produto}>
                      {l.produto}
                    </span>
                    {l.motivo && (
                      <span className="text-[10px] text-muted-foreground">{MOTIVO_LABEL[l.motivo]}</span>
                    )}
                  </TableCell>
                  <TableCell className="py-1.5 text-right text-xs whitespace-nowrap">
                    {l.valorAtual == null ? '—' : `R$ ${formatCeasaMoney(l.valorAtual)}`}
                  </TableCell>
                  <TableCell className="py-1.5 text-right text-xs whitespace-nowrap">
                    {l.valorNovo == null ? '—' : `R$ ${formatCeasaMoney(l.valorNovo)}`}
                    {l.ajustavel && !l.marcado && <span className="ml-1 text-[10px] text-muted-foreground">mantido</span>}
                  </TableCell>
                </TableRow>
              ))}
              {preview.linhas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-4 text-center text-xs text-muted-foreground">
                    Nenhum item neste pedido.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <span className="text-muted-foreground">
            {preview.selecionados} de {ajustaveis.length} item(ns) ajustável(is) selecionado(s)
          </span>
          <div className="flex items-center gap-4">
            <span>
              Total anterior: <span className="font-semibold">R$ {formatCeasaMoney(preview.totalAnterior)}</span>
            </span>
            <span>
              Novo total: <span className="font-semibold text-primary">R$ {formatCeasaMoney(preview.totalNovo)}</span>
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            size="sm"
            disabled={!percentualValido || preview.ajustes.length === 0 || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            Confirmar ajuste
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}