import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { X, CheckCircle2 } from 'lucide-react';
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

export default function ReceivablePayModal({ receivable, installmentIdx, onClose, onSaved }) {
  const inst = receivable.installments[installmentIdx];
  const [paidDate, setPaidDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [paymentMethod, setPaymentMethod] = useState(inst.payment_method || receivable.payment_method || '');
  const [notes, setNotes] = useState(inst.notes || '');
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    if (!paymentMethod) { toast.error('Selecione o método de pagamento.'); return; }
    setSaving(true);

    const updatedInstallments = receivable.installments.map((i, idx) =>
      idx === installmentIdx
        ? { ...i, status: 'paga', paid_date: paidDate, payment_method: paymentMethod, notes }
        : i
    );

    const allPaid = updatedInstallments.every(i => i.status === 'paga');
    const anyPaid = updatedInstallments.some(i => i.status === 'paga');
    const newStatus = allPaid ? 'quitada' : anyPaid ? 'parcialmente_paga' : 'aberta';

    await base44.entities.ContasAReceber.update(receivable.id, {
      installments: updatedInstallments,
      status: newStatus,
    });

    // Lança entrada no financeiro
    await base44.entities.Transaction.create({
      type: 'entrada',
      amount: inst.amount,
      date: paidDate,
      description: `Recebimento Pedido #${receivable.order_number} - Parcela ${inst.installment_number}/${receivable.installments_count}`,
      customer_name: receivable.customer_name,
      customer_email: receivable.customer_email,
      payment_method: paymentMethod,
      status: 'pago',
      notes,
    });

    toast.success('Parcela baixada e lançamento registrado!');
    setSaving(false);
    onSaved();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b">
          <div>
            <h2 className="font-bold text-lg">Baixar Parcela</h2>
            <p className="text-sm text-muted-foreground">
              Parcela {inst.installment_number}/{receivable.installments_count} —{' '}
              <span className="font-semibold text-foreground">
                R$ {inst.amount?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Data de Recebimento *</label>
            <Input type="date" value={paidDate} onChange={e => setPaidDate(e.target.value)} />
          </div>
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
            <label className="text-sm font-medium mb-1 block">Observação</label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Opcional..." />
          </div>
        </div>

        <div className="flex justify-end gap-3 p-5 border-t">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={saving} className="gap-2 bg-green-600 hover:bg-green-700 text-white">
            <CheckCircle2 className="w-4 h-4" />
            {saving ? 'Registrando...' : 'Confirmar Recebimento'}
          </Button>
        </div>
      </div>
    </div>
  );
}