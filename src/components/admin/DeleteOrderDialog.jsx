import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import { filterAllPages, toItems } from '@/lib/pagination';
import { buildOrderDeletionPlan } from '@/lib/orderDeletion';

/**
 * Exclusão de pedido com efeitos colaterais explícitos:
 *  - conta a receber SEM movimento financeiro: excluída (sem fatura órfã);
 *  - conta a receber COM movimento (parcela paga, parcial ou quitada): nunca
 *    excluída — é cancelada e o histórico financeiro é preservado; nesse caso o
 *    pedido também é cancelado (não excluído), para o título não ficar órfão;
 *  - inativa as operações CEASA do pedido, preservando Box, valor, caminhão e
 *    observação;
 *  - não toca em nenhum outro lançamento financeiro (boleto, cheque, transação).
 */
export default function DeleteOrderDialog({ order, onClose, onDeleted }) {
  const queryClient = useQueryClient();

  const { data: plan, isLoading } = useQuery({
    queryKey: ['order-deletion-plan', order.id],
    queryFn: async () => {
      const [receivables, operations] = await Promise.all([
        base44.entities.ContasAReceber.filter({ order_id: order.id }, { sort: '-created_date', limit: 500 }),
        filterAllPages(base44.entities.CeasaReportItem, { order_id: order.id }, { maxRecords: 5000 }),
      ]);
      return buildOrderDeletionPlan({
        receivables: toItems(receivables),
        operations: operations.items,
      });
    },
  });

  const mutation = useMutation({
    mutationFn: async () => {
      if (plan.operationIds.length) {
        await base44.entities.CeasaReportItem.bulkUpdate(
          plan.operationIds.map(id => ({ id, active: false })),
        );
      }
      if (plan.receivableIds.length) {
        await base44.entities.ContasAReceber.deleteMany({ id: { $in: plan.receivableIds } });
      }
      if (plan.cancelReceivableIds.length) {
        await base44.entities.ContasAReceber.bulkUpdate(
          plan.cancelReceivableIds.map(id => ({ id, status: 'cancelada' })),
        );
      }
      if (plan.cancelOrder) {
        await base44.entities.Order.update(order.id, { status: 'Cancelado' });
      } else {
        await base44.entities.Order.delete(order.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      queryClient.invalidateQueries({ queryKey: ['my-orders'] });
      queryClient.invalidateQueries({ queryKey: ['contas-a-receber'] });
      queryClient.invalidateQueries({ queryKey: ['ceasa-report-items'] });
      queryClient.invalidateQueries({ queryKey: ['ceasa-conferencia'] });
      toast.success(plan.cancelOrder
        ? 'Pedido cancelado — histórico financeiro preservado.'
        : 'Pedido excluído.');
      onDeleted();
    },
    onError: () => toast.error('Erro ao excluir o pedido.'),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            {plan?.cancelOrder ? 'Cancelar' : 'Excluir'} pedido #{order.order_number ?? '—'}
          </DialogTitle>
          <DialogDescription>
            {isLoading ? (
              'Verificando o que está vinculado a este pedido...'
            ) : (
              <>
                Cliente: {order.customer_name || order.customer_email || '—'} — R$ {(order.total || 0).toFixed(2)}.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {!isLoading && plan && (
          <div className="text-sm space-y-1 border rounded-lg p-3 bg-muted/30">
            <p className={plan.counts.receivables > 0 ? 'font-medium' : 'text-muted-foreground'}>
              {plan.counts.receivables > 0
                ? <>• {plan.counts.receivables} conta(s) a receber SEM movimento serão EXCLUÍDAS.</>
                : '• Nenhuma conta a receber sem movimento vinculada.'}
            </p>
            {plan.counts.cancelledReceivables > 0 && (
              <p className="font-medium text-amber-700">
                • {plan.counts.cancelledReceivables} conta(s) a receber COM movimento serão CANCELADAS e preservadas (histórico financeiro mantido).
              </p>
            )}
            <p className={plan.counts.operations > 0 ? 'font-medium' : 'text-muted-foreground'}>
              {plan.counts.operations > 0
                ? <>• {plan.counts.operations} operação(ões) CEASA serão INATIVADAS (Box, valor, caminhão e observação preservados).</>
                : '• Nenhuma operação CEASA ativa vinculada.'}
            </p>
            {plan.cancelOrder ? (
              <p className="font-medium text-amber-700">
                • O pedido será CANCELADO (não excluído) porque existe movimentação financeira.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">Nenhum outro lançamento financeiro é afetado.</p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            variant="destructive"
            disabled={isLoading || !plan || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {plan?.cancelOrder ? 'Cancelar pedido' : 'Excluir pedido'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}