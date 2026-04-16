import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, AlertTriangle, Clock, CheckCircle2, FileText } from 'lucide-react';
import { format, parseISO, isBefore, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import TransactionForm from '@/components/financial/TransactionForm';

export default function Bills() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions'],
    queryFn: () => base44.entities.Transaction.list('-due_date'),
  });
  const { data: categories = [] } = useQuery({ queryKey: ['financial-categories'], queryFn: () => base44.entities.FinancialCategory.list() });
  const { data: suppliers = [] } = useQuery({ queryKey: ['suppliers'], queryFn: () => base44.entities.Supplier.list() });

  const bills = transactions.filter(t => t.type === 'boleto');

  const { overdue, upcoming, paid } = useMemo(() => {
    const now = new Date();
    return {
      overdue: bills.filter(b => b.status === 'pendente' && b.due_date && isBefore(parseISO(b.due_date), now)),
      upcoming: bills.filter(b => b.status === 'pendente' && b.due_date && !isBefore(parseISO(b.due_date), now)),
      paid: bills.filter(b => b.status === 'pago' || b.status === 'cancelado'),
    };
  }, [bills]);

  const markAsPaid = async (bill) => {
    await base44.entities.Transaction.update(bill.id, { status: 'pago' });
    qc.invalidateQueries({ queryKey: ['transactions'] });
    toast.success('Boleto marcado como pago!');
  };

  const BillCard = ({ bill }) => {
    const now = new Date();
    const daysLeft = bill.due_date ? differenceInDays(parseISO(bill.due_date), now) : null;
    const isOverdue = bill.status === 'pendente' && daysLeft !== null && daysLeft < 0;

    return (
      <Card className={`p-4 ${isOverdue ? 'border-red-200 bg-red-50/30' : ''}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <FileText className={`w-4 h-4 ${isOverdue ? 'text-red-500' : 'text-blue-500'}`} />
              <span className="font-semibold text-sm">{bill.description}</span>
              {bill.status === 'pago' && <Badge className="bg-green-100 text-green-800 border-0 text-[10px]">Pago</Badge>}
              {bill.status === 'cancelado' && <Badge className="bg-gray-100 text-gray-600 border-0 text-[10px]">Cancelado</Badge>}
              {isOverdue && <Badge className="bg-red-100 text-red-800 border-0 text-[10px]">Vencido</Badge>}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
              {bill.supplier_name && <span>🏢 {bill.supplier_name}</span>}
              {bill.document_number && <span>Doc: {bill.document_number}</span>}
              {bill.due_date && (
                <span className={isOverdue ? 'text-red-600 font-medium' : daysLeft !== null && daysLeft <= 5 ? 'text-yellow-600 font-medium' : ''}>
                  Venc: {format(parseISO(bill.due_date), 'dd/MM/yyyy')}
                  {daysLeft !== null && bill.status === 'pendente' && (
                    isOverdue ? ` (${Math.abs(daysLeft)} dias em atraso)` : ` (${daysLeft} dias)`
                  )}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="font-extrabold text-lg text-primary">R$ {bill.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            {bill.status === 'pendente' && (
              <Button size="sm" variant="outline" className="gap-1 text-green-700 border-green-300 hover:bg-green-50" onClick={() => markAsPaid(bill)}>
                <CheckCircle2 className="w-4 h-4" />Pagar
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => { setEditing(bill); setShowForm(true); }}>Editar</Button>
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Boletos</h1>
        <Button onClick={() => { setEditing(null); setShowForm(true); }} className="gap-2">
          <Plus className="w-4 h-4" />Novo boleto
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-red-600">{overdue.length}</p>
          <p className="text-xs text-red-700">Vencidos</p>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-yellow-700">{upcoming.length}</p>
          <p className="text-xs text-yellow-700">A vencer</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-green-700">{paid.length}</p>
          <p className="text-xs text-green-700">Pagos</p>
        </div>
      </div>

      {overdue.length > 0 && (
        <div>
          <h2 className="font-semibold text-red-600 flex items-center gap-2 mb-3"><AlertTriangle className="w-4 h-4" />Vencidos</h2>
          <div className="space-y-2">{overdue.map(b => <BillCard key={b.id} bill={b} />)}</div>
        </div>
      )}
      {upcoming.length > 0 && (
        <div>
          <h2 className="font-semibold text-yellow-700 flex items-center gap-2 mb-3"><Clock className="w-4 h-4" />A vencer</h2>
          <div className="space-y-2">{upcoming.map(b => <BillCard key={b.id} bill={b} />)}</div>
        </div>
      )}
      {paid.length > 0 && (
        <div>
          <h2 className="font-semibold text-muted-foreground flex items-center gap-2 mb-3"><CheckCircle2 className="w-4 h-4" />Pagos / Cancelados</h2>
          <div className="space-y-2">{paid.map(b => <BillCard key={b.id} bill={b} />)}</div>
        </div>
      )}
      {bills.length === 0 && <div className="text-center py-12 text-muted-foreground">Nenhum boleto cadastrado.</div>}

      {showForm && (
        <TransactionForm
          transaction={editing ? editing : { type: 'boleto' }}
          categories={categories}
          suppliers={suppliers}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={() => { qc.invalidateQueries({ queryKey: ['transactions'] }); setShowForm(false); setEditing(null); }}
        />
      )}
    </div>
  );
}