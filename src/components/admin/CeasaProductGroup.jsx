import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight, Layers } from 'lucide-react';
import BoxCombobox from '@/components/admin/BoxCombobox';

/**
 * Produto agrupado na aba "Itens Agrupado" — aplicação de Box em massa.
 *
 * Define o Box das operações CEASA de TODOS os itens deste produto na consulta
 * atual. Nunca escreve no pedido comercial. Operações já existentes são
 * atualizadas preservando os demais campos (valor CEASA, caminhão, observação);
 * operações inexistentes são criadas com o Box informado.
 */
export default function CeasaProductGroup({ produto, rows = [], boxes = [] }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [boxId, setBoxId] = useState('');

  const totalQty = rows.reduce((s, r) => s + r.qtde, 0);
  const totalClientes = new Set(rows.map(r => r.cnpj || r.cliente)).size;
  const selectedBox = boxes.find(b => b.id === boxId) || null;

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
        toCreate.push({
          order_id: r.orderId,
          item_key: r.itemKey,
          product_id: r.productId || '',
          box_id: box.id,
          box_name: box.name,
          product_name: r.produto,
          quantity: r.qtde,
          client_name: r.cliente || '',
          date: r.orderDate,
          ceasa_value: r.valorCeasaBase,
          caminhao: '',
          nfe_company_name: r.nfeCompanyName || '',
          nfe_cnpj: r.cnpj || '',
          notes: '',
        });
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
    <Card className="overflow-hidden">
      <div
        className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-primary/8 hover:bg-primary/12 cursor-pointer transition-colors text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className="min-w-0">
          <p className="font-bold text-primary truncate">{produto}</p>
          <p className="text-xs text-muted-foreground">
            {totalClientes} cliente(s) • {rows.length} item(ns) • {totalQty} un.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="secondary">{totalQty} un.</Badge>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
          >
            {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {open && (
        <div className="border-t">
          {/* Itens encontrados na consulta atual */}
          <div className="divide-y">
            {rows.map((r, i) => (
              <div key={i} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{r.cliente || '—'}</p>
                  <p className="text-xs text-muted-foreground">
                    Pedido {r.orderNumber ?? '—'} • {r.cnpj || 'sem CNPJ'}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {r.box ? (
                    <Badge variant="outline" className="text-[10px]">{r.box.name}</Badge>
                  ) : (
                    <span className="text-[10px] font-medium text-amber-600">Sem Box</span>
                  )}
                  <span className="font-bold text-primary">{r.qtde} un.</span>
                </div>
              </div>
            ))}
          </div>

          {/* Aplicação em massa */}
          <div className="border-t bg-muted/30 px-4 py-3 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-end gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium mb-1">Box a aplicar em todos os itens deste produto</p>
                <BoxCombobox boxes={boxes} value={boxId} onChange={setBoxId} />
              </div>
              <Button
                className="gap-1 shrink-0"
                onClick={() => applyMutation.mutate()}
                disabled={!boxId || applyMutation.isPending}
              >
                <Layers className="w-4 h-4" /> Aplicar Box aos itens
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {selectedBox
                ? `${rows.length} item(ns) serão vinculados ao Box "${selectedBox.name}". Valor CEASA, caminhão e observação das operações existentes são preservados.`
                : `${rows.length} item(ns) neste produto. Selecione um Box para aplicar em massa.`}
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}