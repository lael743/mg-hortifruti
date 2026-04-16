import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { format, addDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { X, Plus, Trash2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

const PAYMENT_METHODS = [
  { value: 'boleto', label: 'Boleto' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'pix', label: 'Pix' },
  { value: 'cartao_credito', label: 'Cartão de Crédito' },
  { value: 'cartao_debito', label: 'Cartão de Débito' },
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'transferencia', label: 'Transferência' },
];

function generateInstallments(totalAmount, count, firstDueDate, intervalDays, method) {
  if (!firstDueDate || count < 1) return [];
  const baseAmount = Math.floor((totalAmount / count) * 100) / 100;
  const diff = Math.round((totalAmount - baseAmount * count) * 100) / 100;
  const first = parseISO(firstDueDate);
  return Array.from({ length: count }, (_, i) => ({
    installment_number: i + 1,
    amount: i === 0 ? baseAmount + diff : baseAmount,
    due_date: format(addDays(first, i * intervalDays), 'yyyy-MM-dd'),
    paid_date: null,
    status: 'pendente',
    payment_method: method || '',
    notes: '',
  }));
}

export default function ReceivableSetupModal({ receivable, onClose, onSaved }) {
  const [paymentMethod, setPaymentMethod] = useState(receivable.payment_method || '');
  const [installmentsCount, setInstallmentsCount] = useState(receivable.installments_count || 1);
  const [intervalDays, setIntervalDays] = useState(receivable.installment_interval_days || 30);
  const [firstDueDate, setFirstDueDate] = useState(receivable.first_due_date || format(new Date(), 'yyyy-MM-dd'));
  const [installments, setInstallments] = useState(receivable.installments || []);
  const [saving, setSaving] = useState(false);

  // Regenera parcelas quando os parâmetros mudam (apenas se ainda não foram salvas)
  useEffect(() => {
    if (receivable.status === 'pendente_definicao' || !receivable.installments?.length) {
      setInstallments(generateInstallments(receivable.total_amount, installmentsCount, firstDueDate, intervalDays, paymentMethod));
    }
  }, [installmentsCount, firstDueDate, intervalDays, paymentMethod]);

  const handleInstallmentChange = (idx, field, value) => {
    setInstallments(prev => prev.map((inst, i) => i === idx ? { ...inst, [field]: value } : inst));
  };

  const handleSave = async () => {
    if (!paymentMethod) { toast.error('Selecione o método de pagamento.'); return; }
    if (!firstDueDate) { toast.error('Defina a data do primeiro vencimento.'); return; }
    setSaving(true);
    await base44.entities.ContasAReceber.update(receivable.id, {
      payment_method: paymentMethod,
      installments_count: installmentsCount,
      installment_interval_days: intervalDays,
      first_due_date: firstDueDate,
      installments,
      status: 'aberta',
    });
    toast.success('Cobrança configurada com sucesso!');
    setSaving(false);
    onSaved();
  };

  const totalInstallments = installments.reduce((s, i) => s + Number(i.amount || 0), 0);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b">
          <div>
            <h2 className="font-bold text-lg">Configurar Cobrança</h2>
            <p className="text-sm text-muted-foreground">
              {receivable.customer_name} — Pedido #{receivable.order_number} —{' '}
              <span className="font-semibold text-foreground">
                R$ {receivable.total_amount?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        <div className="p-5 space-y-5">
          {/* Configurações gerais */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Método de Pagamento *</label>
              <select
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none"
              >
                <option value="">Selecione...</option>
                {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">1º Vencimento *</label>
              <Input type="date" value={firstDueDate} onChange={e => setFirstDueDate(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Nº de Parcelas</label>
              <Input
                type="number" min="1" max="60"
                value={installmentsCount}
                onChange={e => setInstallmentsCount(Math.max(1, Number(e.target.value)))}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Intervalo entre parcelas (dias)</label>
              <Input
                type="number" min="1"
                value={intervalDays}
                onChange={e => setIntervalDays(Math.max(1, Number(e.target.value)))}
              />
            </div>
          </div>

          {/* Tabela de parcelas */}
          {installments.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2">Parcelas</h3>
              <div className="rounded-xl border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted text-muted-foreground">
                    <tr>
                      <th className="text-left px-3 py-2 w-12">#</th>
                      <th className="text-left px-3 py-2">Vencimento</th>
                      <th className="text-left px-3 py-2">Valor (R$)</th>
                      <th className="text-left px-3 py-2">Observação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {installments.map((inst, idx) => (
                      <tr key={idx} className="bg-card hover:bg-muted/30 transition-colors">
                        <td className="px-3 py-2 text-muted-foreground font-medium">{inst.installment_number}</td>
                        <td className="px-3 py-2">
                          <Input
                            type="date"
                            value={inst.due_date}
                            onChange={e => handleInstallmentChange(idx, 'due_date', e.target.value)}
                            className="h-7 text-xs"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            type="number" step="0.01"
                            value={inst.amount}
                            onChange={e => handleInstallmentChange(idx, 'amount', Number(e.target.value))}
                            className="h-7 text-xs w-28"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            value={inst.notes || ''}
                            onChange={e => handleInstallmentChange(idx, 'notes', e.target.value)}
                            className="h-7 text-xs"
                            placeholder="Obs..."
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-muted/50">
                    <tr>
                      <td colSpan={2} className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Total:</td>
                      <td className="px-3 py-2 font-bold text-sm">
                        R$ {totalInstallments.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
              {Math.abs(totalInstallments - receivable.total_amount) > 0.05 && (
                <p className="text-xs text-orange-600 mt-1">⚠️ O total das parcelas difere do valor original.</p>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 p-5 border-t">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : 'Confirmar Cobrança'}
          </Button>
        </div>
      </div>
    </div>
  );
}