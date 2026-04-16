import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Pencil, Trash2, CheckCircle2, Clock } from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import TransactionForm from '@/components/financial/TransactionForm';

const typeLabel = {
  entrada: 'Entrada', saida: 'Saída', pagamento_fornecedor: 'Pagto. Fornecedor',
  despesa: 'Despesa', boleto: 'Boleto', cheque: 'Cheque',
};
const typeColors = {
  entrada: 'bg-green-100 text-green-800 border-green-200',
  saida: 'bg-red-100 text-red-800 border-red-200',
  pagamento_fornecedor: 'bg-orange-100 text-orange-800 border-orange-200',
  despesa: 'bg-red-100 text-red-800 border-red-200',
  boleto: 'bg-blue-100 text-blue-800 border-blue-200',
  cheque: 'bg-purple-100 text-purple-800 border-purple-200',
};
const statusColors = {
  pendente: 'bg-yellow-100 text-yellow-800',
  pago: 'bg-green-100 text-green-800',
  compensado: 'bg-blue-100 text-blue-800',
  vencido: 'bg-red-100 text-red-800',
  cancelado: 'bg-gray-100 text-gray-600',
};
const isIncome = (type) => type === 'entrada';

export default function Transactions() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const MONTHS = Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: format(new Date(2024, i, 1), 'MMM', { locale: ptBR }) }));
  const YEARS = [2023, 2024, 2025, 2026];

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['transactions'],
    queryFn: () => base44.entities.Transaction.list('-date'),
  });
  const { data: categories = [] } = useQuery({
    queryKey: ['financial-categories'],
    queryFn: () => base44.entities.FinancialCategory.list('name'),
  });
  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => base44.entities.Supplier.list('name'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Transaction.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['transactions'] }); toast.success('Lançamento excluído.'); },
  });

  const markReceivedMutation = useMutation({
    mutationFn: (id) => base44.entities.Transaction.update(id, { status: 'pago' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['transactions'] }); toast.success('Marcado como recebido!'); },
  });

  const filtered = useMemo(() => {
    const start = startOfMonth(new Date(year, month - 1, 1));
    const end = endOfMonth(new Date(year, month - 1, 1));
    let r = transactions.filter(t => {
      const d = parseISO(t.date);
      return d >= start && d <= end;
    });
    if (typeFilter !== 'all') r = r.filter(t => t.type === typeFilter);
    if (statusFilter !== 'all') r = r.filter(t => t.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter(t => t.description?.toLowerCase().includes(q) || t.supplier_name?.toLowerCase().includes(q) || t.category_name?.toLowerCase().includes(q));
    }
    return r;
  }, [transactions, typeFilter, statusFilter, search, month, year]);

  const totals = useMemo(() => {
    const entRecebidas = filtered.filter(t => isIncome(t.type) && t.status === 'pago').reduce((s, t) => s + t.amount, 0);
    const entAReceber = filtered.filter(t => isIncome(t.type) && t.status === 'pendente').reduce((s, t) => s + t.amount, 0);
    const ent = filtered.filter(t => isIncome(t.type)).reduce((s, t) => s + t.amount, 0);
    const sai = filtered.filter(t => !isIncome(t.type)).reduce((s, t) => s + t.amount, 0);
    return { ent, entRecebidas, entAReceber, sai, saldo: entRecebidas - sai };
  }, [filtered]);

  // Vendas pendentes de recebimento (qualquer mês, para ação rápida)
  const vendasPendentes = useMemo(() =>
    transactions.filter(t => isIncome(t.type) && t.status === 'pendente')
      .sort((a, b) => (a.due_date || a.date) > (b.due_date || b.date) ? 1 : -1),
  [transactions]);

  const handleEdit = (t) => { setEditing(t); setShowForm(true); };
  const handleNew = () => { setEditing(null); setShowForm(true); };
  const handleClose = () => { setShowForm(false); setEditing(null); };

  return (
    <div className="p-6 space-y-5 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Lançamentos</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} registro(s)</p>
        </div>
        <Button onClick={handleNew} className="gap-2">
          <Plus className="w-4 h-4" />Novo lançamento
        </Button>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
          <p className="text-xs text-green-700 font-medium">Recebido</p>
          <p className="text-base font-extrabold text-green-700">R$ {totals.entRecebidas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-center">
          <p className="text-xs text-yellow-700 font-medium">A Receber</p>
          <p className="text-base font-extrabold text-yellow-700">R$ {totals.entAReceber.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
          <p className="text-xs text-red-700 font-medium">Saídas</p>
          <p className="text-base font-extrabold text-red-700">R$ {totals.sai.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className={`rounded-xl p-3 text-center border ${totals.saldo >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <p className="text-xs font-medium text-muted-foreground">Resultado Líquido</p>
          <p className={`text-base font-extrabold ${totals.saldo >= 0 ? 'text-green-700' : 'text-red-600'}`}>R$ {totals.saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
        </div>
      </div>

      {/* Painel A Receber — vendas pendentes */}
      {vendasPendentes.length > 0 && (
        <div className="border border-yellow-200 bg-yellow-50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-yellow-600" />
            <h2 className="font-semibold text-sm text-yellow-800">Vendas a Receber ({vendasPendentes.length})</h2>
          </div>
          <div className="space-y-2">
            {vendasPendentes.map(t => (
              <div key={t.id} className="flex items-center gap-3 bg-white rounded-lg border border-yellow-100 px-3 py-2 flex-wrap">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{t.description}</p>
                  <div className="flex gap-3 text-xs text-muted-foreground">
                    <span>Emissão: {format(parseISO(t.date), 'dd/MM/yyyy')}</span>
                    {t.due_date && <span className="text-orange-600 font-medium">Venc: {format(parseISO(t.due_date), 'dd/MM/yyyy')}</span>}
                    {t.payment_method && <span>{t.payment_method.replace('_', ' ')}</span>}
                  </div>
                </div>
                <span className="text-base font-bold text-yellow-700">R$ {t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                <Button size="sm" variant="outline" className="gap-1.5 border-green-300 text-green-700 hover:bg-green-50" onClick={() => handleEdit(t)}>
                  <Pencil className="w-3.5 h-3.5" />Editar
                </Button>
                <Button size="sm" className="gap-1.5 bg-green-600 hover:bg-green-700 text-white" onClick={() => markReceivedMutation.mutate(t.id)}>
                  <CheckCircle2 className="w-3.5 h-3.5" />Recebido
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9 h-9" placeholder="Buscar descrição, fornecedor..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select value={month} onChange={e => setMonth(Number(e.target.value))} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none cursor-pointer capitalize">
          {MONTHS.map(m => <option key={m.value} value={m.value} className="capitalize">{m.label}</option>)}
        </select>
        <select value={year} onChange={e => setYear(Number(e.target.value))} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none cursor-pointer">
          {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none cursor-pointer">
          <option value="all">Todos os tipos</option>
          {Object.entries(typeLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none cursor-pointer">
          <option value="all">Todos os status</option>
          <option value="pendente">Pendente</option>
          <option value="pago">Pago</option>
          <option value="compensado">Compensado</option>
          <option value="vencido">Vencido</option>
          <option value="cancelado">Cancelado</option>
        </select>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">{Array(5).fill(0).map((_, i) => <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">Nenhum lançamento encontrado.</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(t => (
            <Card key={t.id} className="p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-semibold text-sm">{t.description}</span>
                    <Badge className={`${typeColors[t.type]} border text-[10px] px-1.5 py-0.5`}>{typeLabel[t.type]}</Badge>
                    {t.status && <Badge className={`${statusColors[t.status]} text-[10px] px-1.5 py-0.5 border-0`}>{t.status}</Badge>}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                    <span>{format(parseISO(t.date), "dd/MM/yyyy", { locale: ptBR })}</span>
                    {t.category_name && <span>📁 {t.category_name}</span>}
                    {t.supplier_name && <span>🏢 {t.supplier_name}</span>}
                    {t.document_number && <span>Doc: {t.document_number}</span>}
                    {t.due_date && <span>Venc: {format(parseISO(t.due_date), "dd/MM/yyyy")}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-lg font-extrabold ${isIncome(t.type) ? 'text-green-600' : 'text-red-500'}`}>
                    {isIncome(t.type) ? '+' : '-'} R$ {t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(t)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-red-50" onClick={() => deleteMutation.mutate(t.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showForm && (
        <TransactionForm
          transaction={editing}
          categories={categories}
          suppliers={suppliers}
          onClose={handleClose}
          onSaved={() => { qc.invalidateQueries({ queryKey: ['transactions'] }); handleClose(); }}
        />
      )}
    </div>
  );
}