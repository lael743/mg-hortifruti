import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Clock, AlertTriangle, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { format, startOfMonth, endOfMonth, isAfter, isBefore, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const entradas = ['entrada'];
const saidas = ['saida', 'pagamento_fornecedor', 'despesa'];

export default function FinancialDashboard() {
  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions'],
    queryFn: () => base44.entities.Transaction.list('-date'),
  });

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const stats = useMemo(() => {
    const thisMonth = transactions.filter(t => {
      const d = parseISO(t.date);
      return d >= monthStart && d <= monthEnd;
    });

    const totalEntradas = thisMonth.filter(t => entradas.includes(t.type)).reduce((s, t) => s + t.amount, 0);
    const totalSaidas = thisMonth.filter(t => saidas.includes(t.type)).reduce((s, t) => s + t.amount, 0);
    const saldo = totalEntradas - totalSaidas;

    const boletosVencidos = transactions.filter(t => t.type === 'boleto' && t.status === 'pendente' && t.due_date && isBefore(parseISO(t.due_date), now));
    const boletosProximos = transactions.filter(t => t.type === 'boleto' && t.status === 'pendente' && t.due_date && !isBefore(parseISO(t.due_date), now));
    const chequesCompensando = transactions.filter(t => t.type === 'cheque' && t.status === 'pendente');

    return { totalEntradas, totalSaidas, saldo, boletosVencidos: boletosVencidos.length, boletosProximos: boletosProximos.length, chequesCompensando: chequesCompensando.length };
  }, [transactions]);

  // Last 6 months chart data
  const chartData = useMemo(() => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = startOfMonth(d);
      const end = endOfMonth(d);
      const month = transactions.filter(t => { const td = parseISO(t.date); return td >= start && td <= end; });
      months.push({
        name: format(d, 'MMM', { locale: ptBR }),
        entradas: month.filter(t => entradas.includes(t.type)).reduce((s, t) => s + t.amount, 0),
        saidas: month.filter(t => saidas.includes(t.type)).reduce((s, t) => s + t.amount, 0),
      });
    }
    return months;
  }, [transactions]);

  const recent = transactions.slice(0, 8);

  const typeLabel = {
    entrada: 'Entrada', saida: 'Saída', pagamento_fornecedor: 'Fornecedor',
    despesa: 'Despesa', boleto: 'Boleto', cheque: 'Cheque',
  };
  const typeColor = {
    entrada: 'text-green-600', saida: 'text-red-500', pagamento_fornecedor: 'text-orange-500',
    despesa: 'text-red-500', boleto: 'text-blue-600', cheque: 'text-purple-600',
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Dashboard Financeiro</h1>
        <p className="text-muted-foreground text-sm">{format(now, "MMMM 'de' yyyy", { locale: ptBR })}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-green-600 mb-2">
            <TrendingUp className="w-4 h-4" />
            <span className="text-xs font-medium uppercase">Entradas (mês)</span>
          </div>
          <p className="text-2xl font-extrabold text-green-600">R$ {stats.totalEntradas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-red-500 mb-2">
            <TrendingDown className="w-4 h-4" />
            <span className="text-xs font-medium uppercase">Saídas (mês)</span>
          </div>
          <p className="text-2xl font-extrabold text-red-500">R$ {stats.totalSaidas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
        </Card>
        <Card className={`p-4 col-span-2 lg:col-span-1 ${stats.saldo >= 0 ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium uppercase text-muted-foreground">Saldo do mês</span>
          </div>
          <p className={`text-2xl font-extrabold ${stats.saldo >= 0 ? 'text-green-700' : 'text-red-600'}`}>
            R$ {stats.saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </Card>
      </div>

      {/* Alerts */}
      {(stats.boletosVencidos > 0 || stats.chequesCompensando > 0) && (
        <div className="flex flex-wrap gap-3">
          {stats.boletosVencidos > 0 && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700">
              <AlertTriangle className="w-4 h-4" />
              <strong>{stats.boletosVencidos}</strong> boleto(s) vencido(s)
            </div>
          )}
          {stats.boletosProximos > 0 && (
            <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2 text-sm text-yellow-700">
              <Clock className="w-4 h-4" />
              <strong>{stats.boletosProximos}</strong> boleto(s) a vencer
            </div>
          )}
          {stats.chequesCompensando > 0 && (
            <div className="flex items-center gap-2 bg-purple-50 border border-purple-200 rounded-lg px-4 py-2 text-sm text-purple-700">
              <Clock className="w-4 h-4" />
              <strong>{stats.chequesCompensando}</strong> cheque(s) pendente(s)
            </div>
          )}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Chart */}
        <Card className="p-4 lg:col-span-2">
          <h2 className="font-semibold text-sm mb-4">Últimos 6 meses</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} barGap={4}>
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
              <Bar dataKey="entradas" name="Entradas" fill="#22c55e" radius={[4,4,0,0]} />
              <Bar dataKey="saidas" name="Saídas" fill="#ef4444" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Recent */}
        <Card className="p-4">
          <h2 className="font-semibold text-sm mb-3">Últimos lançamentos</h2>
          <div className="space-y-2">
            {recent.length === 0 && <p className="text-xs text-muted-foreground">Nenhum lançamento ainda.</p>}
            {recent.map(t => (
              <div key={t.id} className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{t.description}</p>
                  <p className={`text-[11px] ${typeColor[t.type]}`}>{typeLabel[t.type]}</p>
                </div>
                <div className="flex items-center gap-1">
                  {entradas.includes(t.type) ? <ArrowUpRight className="w-3 h-3 text-green-600" /> : <ArrowDownRight className="w-3 h-3 text-red-500" />}
                  <span className={`text-xs font-bold ${entradas.includes(t.type) ? 'text-green-600' : 'text-red-500'}`}>
                    R$ {t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}