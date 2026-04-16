import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, CheckSquare, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { format, parseISO, isBefore, differenceInDays } from 'date-fns';
import { toast } from 'sonner';
import TransactionForm from '@/components/financial/TransactionForm';

export default function Checks() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions'],
    queryFn: () => base44.entities.Transaction.list('-date'),
  });
  const { data: categories = [] } = useQuery({ queryKey: ['financial-categories'], queryFn: () => base44.entities.FinancialCategory.list() });
  const { data: suppliers = [] } = useQuery({ queryKey: ['suppliers'], queryFn: () => base44.entities.Supplier.list() });

  const checks = transactions.filter(t => t.type === 'cheque');

  const { pending, compensated, cancelled } = useMemo(() => ({
    pending: checks.filter(c => c.status === 'pendente'),
    compensated: checks.filter(c => c.status === 'compensado'),
    cancelled: checks.filter(c => c.status === 'cancelado'),
  }), [checks]);

  const updateStatus = async (check, status) => {
    await base44.entities.Transaction.update(check.id, { status });
    qc.invalidateQueries({ queryKey: ['transactions'] });
    toast.success(`Cheque ${status === 'compensado' ? 'compensado' : 'cancelado'}!`);
  };

  const CheckCard = ({ check }) => {
    const now = new Date();
    const daysLeft = check.due_date ? differenceInDays(parseISO(check.due_date), now) : null;

    return (
      <Card className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <CheckSquare className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="font-semibold text-sm">{check.description}</span>
                {check.status === 'compensado' && <Badge className="bg-green-100 text-green-800 border-0 text-[10px]">Compensado</Badge>}
                {check.status === 'cancelado' && <Badge className="bg-gray-100 text-gray-600 border-0 text-[10px]">Cancelado</Badge>}
                {check.status === 'pendente' && <Badge className="bg-purple-100 text-purple-800 border-0 text-[10px]">Pendente</Badge>}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                {check.supplier_name && <span>🏢 {check.supplier_name}</span>}
                {check.document_number && <span>Cheque nº {check.document_number}</span>}
                {check.bank && <span>🏦 {check.bank}</span>}
                {check.due_date && (
                  <span className={daysLeft !== null && daysLeft <= 3 && check.status === 'pendente' ? 'text-orange-600 font-medium' : ''}>
                    Bom para: {format(parseISO(check.due_date), 'dd/MM/yyyy')}
                    {daysLeft !== null && check.status === 'pendente' && ` (${daysLeft > 0 ? `${daysLeft} dias` : 'hoje'})`}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="font-extrabold text-lg text-primary">R$ {check.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            {check.status === 'pendente' && (
              <>
                <Button size="sm" variant="outline" className="gap-1 text-green-700 border-green-300 hover:bg-green-50" onClick={() => updateStatus(check, 'compensado')}>
                  <CheckCircle2 className="w-4 h-4" />Compensar
                </Button>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => updateStatus(check, 'cancelado')}>
                  <XCircle className="w-4 h-4" />
                </Button>
              </>
            )}
            <Button size="sm" variant="ghost" onClick={() => { setEditing(check); setShowForm(true); }}>Editar</Button>
          </div>
        </div>
      </Card>
    );
  };

  const totalPending = pending.reduce((s, c) => s + c.amount, 0);

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Cheques</h1>
        <Button onClick={() => { setEditing(null); setShowForm(true); }} className="gap-2">
          <Plus className="w-4 h-4" />Novo cheque
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-purple-700">{pending.length}</p>
          <p className="text-xs text-purple-700">Pendentes</p>
          {pending.length > 0 && <p className="text-xs text-purple-600 mt-1 font-medium">R$ {totalPending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>}
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-green-700">{compensated.length}</p>
          <p className="text-xs text-green-700">Compensados</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-gray-600">{cancelled.length}</p>
          <p className="text-xs text-gray-600">Cancelados</p>
        </div>
      </div>

      {pending.length > 0 && (
        <div>
          <h2 className="font-semibold text-purple-700 flex items-center gap-2 mb-3"><Clock className="w-4 h-4" />Pendentes</h2>
          <div className="space-y-2">{pending.map(c => <CheckCard key={c.id} check={c} />)}</div>
        </div>
      )}
      {compensated.length > 0 && (
        <div>
          <h2 className="font-semibold text-green-700 flex items-center gap-2 mb-3"><CheckCircle2 className="w-4 h-4" />Compensados</h2>
          <div className="space-y-2">{compensated.map(c => <CheckCard key={c.id} check={c} />)}</div>
        </div>
      )}
      {cancelled.length > 0 && (
        <div>
          <h2 className="font-semibold text-muted-foreground flex items-center gap-2 mb-3">Cancelados</h2>
          <div className="space-y-2">{cancelled.map(c => <CheckCard key={c.id} check={c} />)}</div>
        </div>
      )}
      {checks.length === 0 && <div className="text-center py-12 text-muted-foreground">Nenhum cheque cadastrado.</div>}

      {showForm && (
        <TransactionForm
          transaction={editing ? editing : { type: 'cheque' }}
          categories={categories}
          suppliers={suppliers}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={() => { qc.invalidateQueries({ queryKey: ['transactions'] }); setShowForm(false); setEditing(null); }}
        />
      )}
    </div>
  );
}