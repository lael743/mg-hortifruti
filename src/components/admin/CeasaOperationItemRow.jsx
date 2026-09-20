import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, Check } from 'lucide-react';
import ReportRowDeleteButton from '@/components/admin/ReportRowDeleteButton';

/**
 * Operação CEASA de um item de pedido.
 * Persiste um CeasaReportItem independente do pedido comercial, identificado por
 * order_id + item_key ("order_id:indice"). Nunca escreve no pedido.
 */
export default function CeasaOperationItemRow({ row, boxes = [], startDate, onDeleteRow }) {
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
  }, [operation?.id, operation?.updated_date, row.itemKey, row.valorCeasaBase]);

  // Boxes ativos; mantém o Box da operação mesmo se estiver inativo
  const boxOptions = useMemo(() => {
    const active = boxes.filter(b => b.active !== false);
    if (boxId && !active.some(b => b.id === boxId)) {
      const current = boxes.find(b => b.id === boxId);
      if (current) return [current, ...active];
    }
    return active;
  }, [boxes, boxId]);

  // Upsert: localiza a operação por order_id + item_key e atualiza em vez de duplicar
  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const existing = await base44.entities.CeasaReportItem.filter(
        { order_id: row.orderId, item_key: row.itemKey },
        '-created_date',
        1
      );
      if (existing.length > 0) {
        return base44.entities.CeasaReportItem.update(existing[0].id, data);
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
      item_key: row.itemKey,
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
    <div className="px-4 py-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">{row.produto}</p>
          <p className="text-xs text-muted-foreground">
            {row.qtde} un. • Pedido: R$ {row.valorUn.toFixed(2)}/un
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {operation ? (
            <Badge variant="outline" className="text-[10px] text-green-700 border-green-300 gap-1">
              <Check className="w-3 h-3" /> Operação salva
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-300">
              Sem operação
            </Badge>
          )}
          {onDeleteRow && operation && (
            <ReportRowDeleteButton
              onConfirm={() => onDeleteRow(row)}
              description="A operação CEASA deste item será removida. O pedido e seus itens permanecem intactos."
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
        <div>
          <Label className="text-[11px] text-muted-foreground">Box *</Label>
          <Select value={boxId} onValueChange={setBoxId}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="Selecionar Box" />
            </SelectTrigger>
            <SelectContent>
              {boxOptions.map(b => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Valor CEASA (un.)</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            className="h-8 text-sm"
            value={ceasaValue}
            onChange={e => setCeasaValue(e.target.value)}
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Caminhão</Label>
          <Input
            className="h-8 text-sm"
            value={caminhao}
            onChange={e => setCaminhao(e.target.value)}
            placeholder="Opcional"
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Observação</Label>
          <Input
            className="h-8 text-sm"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Opcional"
          />
        </div>
      </div>

      <div className="flex justify-end mt-2">
        <Button size="sm" className="gap-1 h-8" onClick={handleSave} disabled={saveMutation.isPending}>
          <Save className="w-3.5 h-3.5" />
          {operation ? 'Atualizar operação' : 'Salvar operação'}
        </Button>
      </div>
    </div>
  );
}