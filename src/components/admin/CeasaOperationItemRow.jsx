import React, { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Save, Check } from 'lucide-react';
import ReportRowDeleteButton from '@/components/admin/ReportRowDeleteButton';
import TruckCombobox from '@/components/admin/TruckCombobox';
import BoxCombobox from '@/components/admin/BoxCombobox';
import { operationsForLine, pickOperation } from '@/lib/ceasaOperations';

/**
 * Linha da tabela operacional de um item de pedido (operação CEASA).
 * Persiste um CeasaReportItem independente do pedido comercial, identificado por
 * order_id + line_id (identidade estável da linha do pedido). Nunca escreve no pedido.
 */
export default function CeasaOperationItemRow({ row, boxes = [], trucks = [], startDate, onDeleteRow }) {
  const queryClient = useQueryClient();
  const operation = row.operation;

  const [boxId, setBoxId] = useState(operation?.box_id || '');
  const [ceasaValue, setCeasaValue] = useState(operation?.ceasa_value ?? row.valorCeasaBase);
  const [caminhao, setCaminhao] = useState(operation?.caminhao || '');
  const [notes, setNotes] = useState(operation?.notes || '');

  // Recarrega os campos quando a operação vinculada muda
  useEffect(() => {
    setBoxId(operation?.box_id || '');
    setCeasaValue(operation?.ceasa_value ?? row.valorCeasaBase);
    setCaminhao(operation?.caminhao || '');
    setNotes(operation?.notes || '');
  }, [operation?.id, operation?.updated_date, row.lineId, row.valorCeasaBase]);

  // Upsert: localiza a operação por order_id + line_id e atualiza em vez de duplicar
  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const existing = await base44.entities.CeasaReportItem.filter(
        { order_id: row.orderId, line_id: row.lineId },
        '-created_date',
        500
      );
      // Grava exatamente a operação que a linha exibe (mesma resolução da leitura).
      // Sem isso o Box salvo podia cair em um registro que a tela não mostra.
      const target = pickOperation(operationsForLine(existing, row.orderId, row.lineId));
      if (target) {
        return base44.entities.CeasaReportItem.update(target.id, data);
      }
      return base44.entities.CeasaReportItem.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ceasa-report-items'] });
      toast.success('Operação CEASA salva.');
    },
    onError: () => toast.error('Erro ao salvar a operação CEASA.'),
  });

  const handleSave = () => {
    const box = boxes.find(b => b.id === boxId);
    if (!box) {
      toast.error('Selecione um Box para salvar a operação.');
      return;
    }
    saveMutation.mutate({
      order_id: row.orderId,
      line_id: row.lineId,
      item_key: row.itemKey,
      active: true,
      product_id: row.productId || '',
      box_id: box.id,
      box_name: box.name,
      product_name: row.produto,
      quantity: row.qtde,
      client_name: row.cliente || '',
      date: operation?.date || row.orderDate || startDate,
      ceasa_value: Number(ceasaValue) || 0,
      caminhao: caminhao || '',
      nfe_company_name: row.nfeCompanyName || '',
      nfe_cnpj: row.cnpj || '',
      notes: notes || '',
    });
  };

  return (
    <tr className="border-b last:border-0 hover:bg-muted/20">
      <td className="px-2 py-1 align-middle">
        <span className="block max-w-[220px] truncate font-medium" title={row.produto}>
          {row.produto}
        </span>
      </td>

      <td className="px-2 py-1 align-middle text-right whitespace-nowrap">{row.qtde}</td>

      <td className="px-2 py-1 align-middle text-right whitespace-nowrap text-muted-foreground">
        R$ {row.valorUn.toFixed(2)}<span className="text-[10px]">/un</span>
      </td>

      <td className="px-2 py-1 align-middle">
        <BoxCombobox
          boxes={boxes}
          value={boxId}
          onChange={setBoxId}
          className="h-7 min-w-[130px] px-2 text-xs"
        />
      </td>

      <td className="px-2 py-1 align-middle">
        <Input
          type="number"
          step="0.01"
          min="0"
          aria-label="Valor CEASA unitário"
          className="h-7 w-[88px] px-2 text-right text-xs"
          value={ceasaValue}
          onChange={e => setCeasaValue(e.target.value)}
        />
      </td>

      <td className="px-2 py-1 align-middle">
        <TruckCombobox
          trucks={trucks}
          value={caminhao}
          onChange={setCaminhao}
          className="h-7 min-w-[130px] px-2 text-xs"
        />
      </td>

      <td className="px-2 py-1 align-middle">
        <Input
          aria-label="Observação da operação"
          className="h-7 min-w-[140px] px-2 text-xs"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Opcional"
        />
      </td>

      <td className="px-2 py-1 align-middle">
        <div className="flex items-center justify-end gap-1">
          {operation ? (
            <Check
              className="w-3.5 h-3.5 shrink-0 text-green-600"
              aria-label="Operação salva"
              title="Operação salva"
            />
          ) : (
            <span
              className="w-2 h-2 shrink-0 rounded-full bg-amber-400"
              title="Sem operação salva"
            />
          )}

          <Button
            size="icon"
            className="h-7 w-7 shrink-0"
            title={operation ? 'Atualizar operação' : 'Salvar operação'}
            onClick={handleSave}
            disabled={saveMutation.isPending}
          >
            <Save className="w-3.5 h-3.5" />
          </Button>

          {onDeleteRow && operation && (
            <ReportRowDeleteButton
              onConfirm={() => onDeleteRow(row)}
              description="A operação CEASA deste item será removida. O pedido e seus itens permanecem intactos."
            />
          )}
        </div>
      </td>
    </tr>
  );
}