import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChevronDown, ChevronRight, Layers } from 'lucide-react';
import BoxCombobox from '@/components/admin/BoxCombobox';

/**
 * Linha da tabela "Itens Agrupado" — um produto por linha, com aplicação de Box
 * em massa no próprio popover da linha.
 *
 * Define o Box das operações CEASA de TODOS os itens deste produto na consulta
 * atual. Nunca escreve no pedido comercial. Operações já existentes são
 * atualizadas preservando os demais campos (valor CEASA, caminhão, observação);
 * operações inexistentes são criadas com o Box informado.
 *
 * A expansão da linha serve APENAS para conferência dos itens (cliente, pedido,
 * qtde, box) — não contém controles de edição.
 */
export default function CeasaProductGroup({ produto, rows = [], boxes = [] }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [boxId, setBoxId] = useState('');

  const totalQty = rows.reduce((s, r) => s + r.qtde, 0);
  const totalClientes = new Set(rows.map(r => r.cnpj || r.cliente)).size;
  // Itens com preço comercial e valor CEASA zerado: precisam de digitação do operador.
  const pendingCount = rows.filter(r => r.valorCeasaPendente).length;

  const applyMutation = useMutation({
    mutationFn: async () => {
      const box = boxes.find(b => b.id === boxId);
      if (!box) throw new Error('Box não selecionado.');

      const toUpdate = [];
      const toCreate = [];

      rows.forEach(r => {
        if (r.operation) {
          // Altera SOMENTE o Box da operação existente
          if (r.operation.box_id !== box.id) {
            toUpdate.push({ id: r.operation.id, box_id: box.id, box_name: box.name });
          }
          return;
        }
        // Operação inexistente: cria com o Box informado e os dados do item
        const record = {
          order_id: r.orderId,
          line_id: r.lineId,
          item_key: r.itemKey,
          product_id: r.productId || '',
          box_id: box.id,
          box_name: box.name,
          product_name: r.produto,
          quantity: r.qtde,
          client_name: r.cliente || '',
          date: r.orderDate,
          caminhao: '',
          nfe_company_name: r.nfeCompanyName || '',
          nfe_cnpj: r.cnpj || '',
          notes: '',
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
      toast.success(`${created} operação(ões) criada(s) e ${updated} atualizada(s).`);
      setBoxId('');
    },
    onError: () => toast.error('Erro ao aplicar o Box aos itens.'),
  });

  return (
    <>
      <TableRow>
        <TableCell className="w-8 px-2">
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={() => setOpen(o => !o)}
            title={open ? 'Recolher itens' : 'Conferir itens'}
          >
            {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </Button>
        </TableCell>
        <TableCell className="font-medium">
          {produto}
          {pendingCount > 0 && (
            <span
              className="ml-1.5 text-[10px] font-semibold text-amber-800 bg-amber-100 border border-amber-300 rounded px-1 py-0.5 whitespace-nowrap"
              title="Itens com preço comercial e valor CEASA zerado — digite o valor na aba Lista por Cliente"
            >
              {pendingCount} sem valor CEASA
            </span>
          )}
        </TableCell>
        <TableCell className="text-right text-muted-foreground">{totalClientes}</TableCell>
        <TableCell className="text-right text-muted-foreground">{rows.length}</TableCell>
        <TableCell className="text-right font-semibold text-primary whitespace-nowrap">{totalQty} un.</TableCell>
        <TableCell>
          <div className="flex items-center justify-end gap-2">
            <BoxCombobox boxes={boxes} value={boxId} onChange={setBoxId} className="h-8 w-40" />
            <Button
              size="sm"
              className="gap-1 shrink-0"
              onClick={() => applyMutation.mutate()}
              disabled={!boxId || applyMutation.isPending}
              title="Aplicar este Box a todos os itens deste produto"
            >
              <Layers className="w-3.5 h-3.5" /> Aplicar
            </Button>
          </div>
        </TableCell>
      </TableRow>

      {open && (
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          <TableCell colSpan={6} className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="h-8">Cliente</TableHead>
                  <TableHead className="h-8">Pedido</TableHead>
                  <TableHead className="h-8 text-right">Qtde</TableHead>
                  <TableHead className="h-8">Box</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="py-1.5">
                      {r.cliente || '—'}
                      <span className="text-xs text-muted-foreground ml-2">{r.cnpj || 'sem CNPJ'}</span>
                    </TableCell>
                    <TableCell className="py-1.5 text-muted-foreground">{r.orderNumber ?? '—'}</TableCell>
                    <TableCell className="py-1.5 text-right">{r.qtde} un.</TableCell>
                    <TableCell className="py-1.5">
                      {r.box ? (
                        <Badge variant="outline" className="text-[10px]">{r.box.name}</Badge>
                      ) : (
                        <span className="text-[10px] font-medium text-amber-600">Sem Box</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}