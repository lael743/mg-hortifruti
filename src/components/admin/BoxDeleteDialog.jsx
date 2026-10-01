import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { filterAllPages } from '@/lib/pagination';

/**
 * Exclusão de um Box do Ceasa com proteção referencial.
 *
 * Box em uso por qualquer operação CEASA (ativa ou inativa) é INATIVADO em vez de
 * excluído: sai das listas de seleção, mas o nome e o CNPJ continuam exibidos na
 * Gestão e na impressão, e nenhuma operação é alterada. Box sem nenhuma operação
 * vinculada pode ser excluído de fato.
 */
export default function BoxDeleteDialog({ box, onClose, onDone }) {
  const queryClient = useQueryClient();

  const { data: usage, isLoading } = useQuery({
    queryKey: ['ceasa-box-usage', box.id],
    queryFn: async () => {
      const { items } = await filterAllPages(
        base44.entities.CeasaReportItem,
        { box_id: box.id },
        { maxRecords: 20000 },
      );
      return { total: items.length, active: items.filter(op => op.active !== false).length };
    },
  });

  const inUse = (usage?.total || 0) > 0;

  const mutation = useMutation({
    mutationFn: () => (inUse
      ? base44.entities.CeasaBox.update(box.id, { active: false })
      : base44.entities.CeasaBox.delete(box.id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ceasa-boxes'] });
      queryClient.invalidateQueries({ queryKey: ['ceasa-report-items'] });
      queryClient.invalidateQueries({ queryKey: ['ceasa-conferencia'] });
      toast.success(inUse ? 'Box inativado (em uso) — histórico preservado.' : 'Box excluído.');
      onDone();
    },
    onError: () => toast.error('Erro ao processar o Box.'),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{inUse ? `Inativar ${box.name}` : `Excluir ${box.name}`}</DialogTitle>
          <DialogDescription>
            {isLoading
              ? 'Verificando o uso deste Box...'
              : inUse
                ? `${usage.total} operação(ões) CEASA usam este Box (${usage.active} ativa(s)). O Box será inativado: sai das listas de seleção, mas o nome e o CNPJ continuam aparecendo na Gestão e na impressão — nenhuma operação é alterada.`
                : 'Nenhuma operação CEASA usa este Box — ele pode ser excluído de fato.'}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            variant={inUse ? 'default' : 'destructive'}
            disabled={isLoading || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {inUse ? 'Inativar Box' : 'Excluir Box'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}