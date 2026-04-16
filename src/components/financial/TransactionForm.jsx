import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X } from 'lucide-react';
import { toast } from 'sonner';

const TYPES = [
  { value: 'entrada', label: 'Entrada / Receita' },
  { value: 'saida', label: 'Saída' },
  { value: 'pagamento_fornecedor', label: 'Pagamento Fornecedor' },
  { value: 'despesa', label: 'Despesa' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'cheque', label: 'Cheque' },
];
const METHODS = ['dinheiro', 'pix', 'cartao_credito', 'cartao_debito', 'cheque', 'boleto', 'transferencia'];
const STATUSES = ['pendente', 'pago', 'compensado', 'vencido', 'cancelado'];

const defaultForm = {
  type: 'saida', amount: '', date: new Date().toISOString().split('T')[0],
  due_date: '', description: '', category_id: '', category_name: '',
  supplier_name: '', customer_email: '', customer_name: '',
  payment_method: 'pix', status: 'pendente', document_number: '', bank: '', notes: '',
};

export default function TransactionForm({ transaction, categories, suppliers, onClose, onSaved }) {
  const [form, setForm] = useState(transaction ? {
    ...defaultForm, ...transaction,
    amount: transaction.amount?.toString() || '',
  } : defaultForm);
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleCategoryChange = (id) => {
    const cat = categories.find(c => c.id === id);
    set('category_id', id);
    set('category_name', cat?.name || '');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.amount || !form.date || !form.description) {
      toast.error('Preencha os campos obrigatórios.');
      return;
    }
    setSaving(true);
    const data = { ...form, amount: parseFloat(form.amount) };
    if (transaction?.id) {
      await base44.entities.Transaction.update(transaction.id, data);
    } else {
      await base44.entities.Transaction.create(data);
    }
    setSaving(false);
    toast.success(transaction ? 'Lançamento atualizado!' : 'Lançamento criado!');
    onSaved();
  };

  const needsSupplier = ['pagamento_fornecedor'].includes(form.type);
  const needsCustomer = form.type === 'entrada';
  const needsDueDate = ['boleto', 'cheque'].includes(form.type);
  const needsDoc = ['boleto', 'cheque'].includes(form.type);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-bold text-lg">{transaction ? 'Editar lançamento' : 'Novo lançamento'}</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Type */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Tipo *</label>
            <div className="grid grid-cols-2 gap-2">
              {TYPES.map(t => (
                <button type="button" key={t.value}
                  onClick={() => set('type', t.value)}
                  className={`text-sm rounded-lg border px-3 py-2 text-left transition-colors ${form.type === t.value ? 'border-primary bg-primary/10 text-primary font-semibold' : 'border-border hover:bg-muted'}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Amount + Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Valor (R$) *</label>
              <Input type="number" step="0.01" min="0" placeholder="0,00" value={form.amount} onChange={e => set('amount', e.target.value)} required />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Data *</label>
              <Input type="date" value={form.date} onChange={e => set('date', e.target.value)} required />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Descrição *</label>
            <Input placeholder="Descrição do lançamento" value={form.description} onChange={e => set('description', e.target.value)} required />
          </div>

          {/* Category */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Categoria</label>
            <select value={form.category_id} onChange={e => handleCategoryChange(e.target.value)} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none">
              <option value="">Sem categoria</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name} ({c.type})</option>)}
            </select>
          </div>

          {/* Supplier */}
          {needsSupplier && (
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Fornecedor</label>
              <select value={form.supplier_name} onChange={e => set('supplier_name', e.target.value)} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none">
                <option value="">Selecionar fornecedor</option>
                {suppliers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            </div>
          )}

          {/* Customer */}
          {needsCustomer && (
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Cliente</label>
              <Input placeholder="Nome do cliente (opcional)" value={form.customer_name} onChange={e => set('customer_name', e.target.value)} />
            </div>
          )}

          {/* Due date + doc */}
          {(needsDueDate || needsDoc) && (
            <div className="grid grid-cols-2 gap-3">
              {needsDueDate && (
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Vencimento</label>
                  <Input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} />
                </div>
              )}
              {needsDoc && (
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Nº Documento</label>
                  <Input placeholder="Ex: 001234" value={form.document_number} onChange={e => set('document_number', e.target.value)} />
                </div>
              )}
            </div>
          )}

          {/* Payment method + Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Pagamento</label>
              <select value={form.payment_method} onChange={e => set('payment_method', e.target.value)} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none">
                {METHODS.map(m => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value)} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none">
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* Bank */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Banco / Conta</label>
            <Input placeholder="Ex: Bradesco, Caixa Geral..." value={form.bank} onChange={e => set('bank', e.target.value)} />
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Observações</label>
            <Input placeholder="Observações adicionais" value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button type="submit" className="flex-1" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}