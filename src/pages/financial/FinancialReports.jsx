import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, TrendingUp, TrendingDown, DollarSign, Filter } from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const typeLabel = {
  entrada: 'Entrada', saida: 'Saída', pagamento_fornecedor: 'Pagto. Fornecedor',
  despesa: 'Despesa', boleto: 'Boleto', cheque: 'Cheque',
};
const isIncome = (type) => type === 'entrada';

const MONTHS = Array.from({ length: 12 }, (_, i) => {
  const d = new Date(new Date().getFullYear(), i, 1);
  return { value: i + 1, label: format(d, 'MMMM', { locale: ptBR }) };
});
const YEARS = [2023, 2024, 2025, 2026];

export default function FinancialReports() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['transactions'],
    queryFn: () => base44.entities.Transaction.list('-date'),
  });

  const filtered = useMemo(() => {
    const start = startOfMonth(new Date(year, month - 1, 1));
    const end = endOfMonth(new Date(year, month - 1, 1));
    return transactions.filter(t => {
      const d = parseISO(t.date);
      return d >= start && d <= end;
    });
  }, [transactions, month, year]);

  const totals = useMemo(() => {
    const entradas = filtered.filter(t => isIncome(t.type)).reduce((s, t) => s + t.amount, 0);
    const saidas = filtered.filter(t => !isIncome(t.type)).reduce((s, t) => s + t.amount, 0);
    return { entradas, saidas, saldo: entradas - saidas };
  }, [filtered]);

  // Grouped by type
  const byType = useMemo(() => {
    const map = {};
    filtered.forEach(t => {
      if (!map[t.type]) map[t.type] = 0;
      map[t.type] += t.amount;
    });
    return Object.entries(map).map(([type, amount]) => ({ name: typeLabel[type] || type, amount, type }));
  }, [filtered]);

  // Grouped by category
  const byCategory = useMemo(() => {
    const map = {};
    filtered.forEach(t => {
      const key = t.category_name || 'Sem categoria';
      if (!map[key]) map[key] = 0;
      map[key] += t.amount;
    });
    return Object.entries(map).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount);
  }, [filtered]);

  // Last 6 months bar chart
  const monthlyChart = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const d = subMonths(new Date(year, month - 1, 1), 5 - i);
      const start = startOfMonth(d);
      const end = endOfMonth(d);
      const slice = transactions.filter(t => {
        const td = parseISO(t.date);
        return td >= start && td <= end;
      });
      return {
        name: format(d, 'MMM/yy', { locale: ptBR }),
        entradas: slice.filter(t => isIncome(t.type)).reduce((s, t) => s + t.amount, 0),
        saidas: slice.filter(t => !isIncome(t.type)).reduce((s, t) => s + t.amount, 0),
      };
    });
  }, [transactions, month, year]);

  const PIE_COLORS = ['#22c55e', '#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

  const exportCSV = () => {
    const header = ['Data', 'Descrição', 'Tipo', 'Categoria', 'Fornecedor', 'Método Pagamento', 'Status', 'Valor'];
    const rows = filtered.map(t => [
      t.date, t.description, typeLabel[t.type] || t.type,
      t.category_name || '', t.supplier_name || '',
      t.payment_method || '', t.status || '',
      (isIncome(t.type) ? '' : '-') + t.amount.toFixed(2).replace('.', ','),
    ]);
    const csv = [header, ...rows].map(r => r.map(v => `"${v}"`).join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `financeiro_${year}_${String(month).padStart(2, '0')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const monthName = format(new Date(year, month - 1, 1), 'MMMM/yyyy', { locale: ptBR });

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Relatório Financeiro</h1>
          <p className="text-sm text-muted-foreground capitalize">{monthName}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 bg-muted rounded-lg px-3 h-9 border">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <select value={month} onChange={e => setMonth(Number(e.target.value))} className="bg-transparent text-sm outline-none cursor-pointer capitalize">
              {MONTHS.map(m => <option key={m.value} value={m.value} className="capitalize">{m.label}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2 bg-muted rounded-lg px-3 h-9 border">
            <select value={year} onChange={e => setYear(Number(e.target.value))} className="bg-transparent text-sm outline-none cursor-pointer">
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <Button onClick={exportCSV} variant="outline" className="gap-2" disabled={filtered.length === 0}>
            <Download className="w-4 h-4" />Exportar CSV
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-green-600 mb-2">
            <TrendingUp className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase">Total Entradas</span>
          </div>
          <p className="text-2xl font-extrabold text-green-600">
            R$ {totals.entradas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{filtered.filter(t => isIncome(t.type)).length} lançamento(s)</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-red-500 mb-2">
            <TrendingDown className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase">Total Saídas</span>
          </div>
          <p className="text-2xl font-extrabold text-red-500">
            R$ {totals.saidas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{filtered.filter(t => !isIncome(t.type)).length} lançamento(s)</p>
        </Card>
        <Card className={`p-4 ${totals.saldo >= 0 ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className={`w-4 h-4 ${totals.saldo >= 0 ? 'text-green-700' : 'text-red-600'}`} />
            <span className="text-xs font-semibold uppercase text-muted-foreground">Saldo do Mês</span>
          </div>
          <p className={`text-2xl font-extrabold ${totals.saldo >= 0 ? 'text-green-700' : 'text-red-600'}`}>
            R$ {totals.saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{filtered.length} lançamento(s) no total</p>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Bar chart 6 months */}
        <Card className="p-4">
          <h2 className="font-semibold text-sm mb-4">Histórico — últimos 6 meses</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyChart} barGap={4}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={v => `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
              <Bar dataKey="entradas" name="Entradas" fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="saidas" name="Saídas" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Pie by type */}
        <Card className="p-4">
          <h2 className="font-semibold text-sm mb-4">Distribuição por tipo</h2>
          {byType.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">Sem dados para o período.</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={byType} dataKey="amount" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                  {byType.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={v => `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* By Category */}
      {byCategory.length > 0 && (
        <Card className="p-4">
          <h2 className="font-semibold text-sm mb-4">Por categoria</h2>
          <div className="space-y-2">
            {byCategory.map((c, i) => {
              const total = byCategory.reduce((s, x) => s + x.amount, 0);
              const pct = total > 0 ? (c.amount / total) * 100 : 0;
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-sm w-40 truncate text-muted-foreground">{c.name}</span>
                  <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-sm font-semibold w-32 text-right">R$ {c.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Transactions table */}
      <Card className="p-4">
        <h2 className="font-semibold text-sm mb-4">Lançamentos do período ({filtered.length})</h2>
        {isLoading ? (
          <div className="space-y-2">{Array(5).fill(0).map((_, i) => <div key={i} className="h-10 bg-muted animate-pulse rounded" />)}</div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhum lançamento neste período.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="text-left py-2 pr-3">Data</th>
                  <th className="text-left py-2 pr-3">Descrição</th>
                  <th className="text-left py-2 pr-3">Tipo</th>
                  <th className="text-left py-2 pr-3">Categoria</th>
                  <th className="text-left py-2 pr-3">Status</th>
                  <th className="text-right py-2">Valor</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(t => (
                  <tr key={t.id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">{format(parseISO(t.date), 'dd/MM/yyyy')}</td>
                    <td className="py-2 pr-3 font-medium max-w-[200px] truncate">{t.description}</td>
                    <td className="py-2 pr-3">
                      <Badge className={`text-[10px] border ${isIncome(t.type) ? 'bg-green-100 text-green-800 border-green-200' : 'bg-red-100 text-red-800 border-red-200'}`}>
                        {typeLabel[t.type] || t.type}
                      </Badge>
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground text-xs">{t.category_name || '—'}</td>
                    <td className="py-2 pr-3 text-xs capitalize text-muted-foreground">{t.status || '—'}</td>
                    <td className={`py-2 text-right font-bold whitespace-nowrap ${isIncome(t.type) ? 'text-green-600' : 'text-red-500'}`}>
                      {isIncome(t.type) ? '+' : '-'} R$ {t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}