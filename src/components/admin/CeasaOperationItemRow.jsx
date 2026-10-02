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
import { formatCeasaMoney, parseCeasaValueInput } from '@/lib/ceasaValue';
import { operationsForLine, pickOperation } from '@/lib/ceasaOperations';
import { fetchAllPages } from '@/lib/pagination';

/**
 * Linha da tabela operacional de um item de pedido (operação CEASA).
 * Persiste um CeasaReportItem independente do pedido comercial, identificado por
 * order_id + line_id (identidade estável da linha do pedido). Nunca escreve no pedido.
 */
export default function CeasaOperationItemRow({ row, boxes = [], trucks = [], startDate, onDeleteRow }) {
  const queryClient = useQueryClient();
  const operation = row.operation;

  const [boxId, setBoxId] = useState(operation?.box_id || '');
  // Sem operação salva o campo começa com o preço efetivo do item; item sem preço
  // comercial fica vazio ("valor não definido") — nunca grava 0 por ausência.
  const [ceasaValue, setCeasaValue] = useState(operation ? (operation.ceasa_value ?? '') : (row.valorCeasaBase ?? ''));
  const [caminhao, setCaminhao] = useState(operation?.caminhao || '');
  const [notes, setNotes] = useState(operation?.notes || '');

  // Recarrega os campos quando a operação vinculada muda
  useEffect(() => {
    setBoxId(operation?.box_id || '');
    setCeasaValue(operation ? (operation.ceasa_value ?? '') : (row.valorCeasaBase ?? ''));
    setCaminhao(operation?.caminhao || '');
    setNotes(operation?.notes || '');
  }, [operation?.id, operation?.updated_date, row.lineId, row.valorCeasaBase]);

  // Upsert: localiza a operação por order_id + line_id e atualiza em vez de duplicar
  const saveMutation = useMutation({
    mutationFn: async (data) => {
      // Todas as páginas da linha: com muitas operações o alvo da gravação
      // poderia ficar fora da primeira consulta.
      const { items: existing } = await fetchAllPages((cursor) => {
        const options = { sort: '-created_date', limit: 500 };
        if (cursor) options.cursor = cursor;
        return base44.entities.CeasaReportItem.filter({ order_id: row.orderId, line_id: row.lineId }, options);
      });
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
    // `ceasa_value` só entra no payload quando o operador informa um valor:
    // campo vazio mantém "valor não definido"; valor digitado (inclusive 0) é
    // preservado e nunca recalculado. Zero é valor definido — não há mínimo.
    const payload = {
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
      caminhao: caminhao || '',
      nfe_company_name: row.nfeCompanyName || '',
      nfe_cnpj: row.cnpj || '',
      notes: notes || '',
    };
    const valorDigitado = parseCeasaValueInput(ceasaValue);
    if (valorDigitado !== null) payload.ceasa_value = valorDigitado;
    saveMutation.mutate(payload);
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
        R$ {formatCeasaMoney(row.valorUn)}<span className="text-[10px]">/un</span>
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
        <div className="flex items-center justify-end gap-1">
          <Input
            type="text"
            inputMode="decimal"
            autoComplete="off"
            aria-label="Valor CEASA unitário"
            title={
              row.valorCeasaZero
                ? 'Valor CEASA definido como R$ 0,00'
                : row.valorCeasaDivergente
                  ? `Valor CEASA diferente do valor do pedido (R$ ${formatCeasaMoney(row.valorUn)})`
                  : undefined
            }
            className={`h-7 w-[88px] px-2 text-right text-xs ${row.valorCeasaZero ? 'border-amber-200 bg-amber-50/50' : ''}`}
            value={ceasaValue}
            onChange={e => setCeasaValue(e.target.value)}
          />
          {row.valorCeasaDivergente && (
            <span
              className="w-1.5 h-1.5 shrink-0 rounded-full bg-sky-500"
              title={`Valor CEASA diferente do valor do pedido (R$ ${formatCeasaMoney(row.valorUn)})`}
              aria-label="Valor CEASA divergente do valor do pedido"
            />
          )}
        </div>
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