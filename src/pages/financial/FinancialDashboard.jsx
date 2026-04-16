import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import {
  TrendingUp, TrendingDown, Clock, AlertTriangle,
  ArrowUpRight, ArrowDownRight, ShoppingBag, Package,
  Wrench, DollarSign
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, isBefore, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const fmt = (v) => `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

export default function FinancialDashboard() {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions'],
    queryFn: () => base44.entities.Transaction.list('-date'),
  });

  const { data: orders = [] } = useQuery({
    queryKey: ['orders'],
    queryFn: () => base44.entities.Order.list('-created_date'),
  });

  // ---------- KPIs do mês ----------
  const stats = useMemo(() => {
    const thisMonth = transactions.filter(t => {
      const d = parseISO(t.date);
      return d >= monthStart && d <= monthEnd;
    });

    // Receita recebida (entrada paga) — base do resultado líquido
    const receitaFinanceira = thisMonth
      .filter(t => t.type === 'entrada' && t.status === 'pago')
      .reduce((s, t) => s + t.amount, 0);

    // Receita a receber (entrada pendente)
    const receitaAReceber = thisMonth
      .filter(t => t.type === 'entrada' && t.status === 'pendente')
      .reduce((s, t) => s + t.amount, 0);

    // Custo de mercadorias (pagamento_fornecedor)
    const custoMercadorias = thisMonth
      .filter(t => t.type === 'pagamento_fornecedor')
      .reduce((s, t) => s + t.amount, 0);

    // Custos operacionais (saida + despesa + boleto + cheque)
    const custosOperacionais = thisMonth
      .filter(t => ['saida', 'despesa', 'boleto', 'cheque'].includes(t.type))
      .reduce((s, t) => s + t.amount, 0);

    const totalCustos = custoMercadorias + custosOperacionais;
    const resultadoLiquido = receitaFinanceira - totalCustos;

    // Pedidos do catálogo no mês (receita bruta de vendas)
    const ordersThisMonth = orders.filter(o => {
      const d = o.created_date ? new Date(o.created_date) : null;
      return d && d >= monthStart && d <= monthEnd && o.status !== 'Cancelado';
    });
    const receitaBrutaVendas = ordersThisMonth.reduce((s, o) => s + (o.total || 0), 0);

    // Alertas
    const boletosVencidos = transactions.filter(t => t.type === 'boleto' && t.status === 'pendente' && t.due_date && isBefore(parseISO(t.due_date), now)).length;
    const boletosProximos = transactions.filter(t => t.type === 'boleto' && t.status === 'pendente' && t.due_date && !isBefore(parseISO(t.due_date), now)).length;
    const chequesPendentes = transactions.filter(t => t.type === 'cheque' && t.status === 'pendente').length;

    // Por categoria de despesa
    const categoriasSaida = {};
    thisMonth.filter(t => !['entrada'].includes(t.type)).forEach(t => {
      const key = t.category_name || 'Sem categoria';
      categoriasSaida[key] = (categoriasSaida[key] || 0) + t.amount;
    });

    return {
      receitaBrutaVendas,
      receitaFinanceira,
      receitaAReceber,
      custoMercadorias,
      custosOperacionais,
      totalCustos,
      resultadoLiquido,
      boletosVencidos,
      boletosProximos,
      chequesPendentes,
      categoriasSaida: Object.entries(categoriasSaida)
        .map(([name, v]) => ({ name, value: v }))
        .sort((a, b) => b.value - a.value),
    };
  }, [transactions, orders]);

  // ---------- Histórico 6 meses ----------
  const chartData = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const start = startOfMonth(d);
      const end = endOfMonth(d);
      const slice = transactions.filter(t => { const td = parseISO(t.date); return td >= start && td <= end; });
      const receita = slice.filter(t => t.type === 'entrada').reduce((s, t) => s + t.amount, 0);
      const custos = slice.filter(t => t.type !== 'entrada').reduce((s, t) => s + t.amount, 0);

      const ordSlice = orders.filter(o => {
        const od = o.created_date ? new Date(o.created_date) : null;
        return od && od >= start && od <= end && o.status !== 'Cancelado';
      });
      const vendas = ordSlice.reduce((s, o) => s + (o.total || 0), 0);

      return { name: format(d, 'MMM', { locale: ptBR }), 'Venda Bruta': vendas, 'Receita Fin.': receita, Custos: custos };
    });
  }, [transactions, orders]);

  const recent = transactions.slice(0, 6);

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Dashboard Financeiro</h1>
        <p className="text-muted-foreground text-sm capitalize">{format(now, "MMMM 'de' yyyy", { locale: ptBR })}</p>
      </div>

      {/* ===== BLOCO PRINCIPAL: DRE Simplificado ===== */}
      <Card className="p-5 border-2 border-border">
        <h2 className="font-bold text-base mb-4 flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-primary" /> Resultado do Mês
        </h2>
        <div className="space-y-0 divide-y divide-border">

          {/* Receita Bruta de Vendas (catálogo) */}
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                <ShoppingBag className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-semibold">Receita Bruta de Vendas</p>
                <p className="text-xs text-muted-foreground">Valor total dos pedidos do catálogo (não é lucro)</p>
              </div>
            </div>
            <p className="text-lg font-bold text-blue-600">{fmt(stats.receitaBrutaVendas)}</p>
          </div>

          {/* Custo de Mercadorias */}
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
                <Package className="w-4 h-4 text-orange-600" />
              </div>
              <div>
                <p className="text-sm font-semibold">(-) Custo de Mercadorias</p>
                <p className="text-xs text-muted-foreground">Pagamentos a fornecedores lançados no financeiro</p>
              </div>
            </div>
            <p className="text-lg font-bold text-orange-600">- {fmt(stats.custoMercadorias)}</p>
          </div>

          {/* Custos Operacionais */}
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                <Wrench className="w-4 h-4 text-red-600" />
              </div>
              <div>
                <p className="text-sm font-semibold">(-) Custos Operacionais</p>
                <p className="text-xs text-muted-foreground">Frete, impostos, mão de obra, despesas gerais</p>
              </div>
            </div>
            <p className="text-lg font-bold text-red-500">- {fmt(stats.custosOperacionais)}</p>
          </div>

          {/* Receita Recebida */}
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-semibold">(+) Receitas Recebidas</p>
                <p className="text-xs text-muted-foreground">Entradas com status "pago" — efetivamente recebidas</p>
              </div>
            </div>
            <p className="text-lg font-bold text-green-600">+ {fmt(stats.receitaFinanceira)}</p>
          </div>

          {/* A Receber */}
          {stats.receitaAReceber > 0 && (
            <div className="flex items-center justify-between py-3 opacity-70">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-yellow-100 flex items-center justify-center">
                  <Clock className="w-4 h-4 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-yellow-700">Receitas a Receber (pendente)</p>
                  <p className="text-xs text-muted-foreground">Boletos/cheques ainda não recebidos — não entra no resultado</p>
                </div>
              </div>
              <p className="text-lg font-bold text-yellow-600">{fmt(stats.receitaAReceber)}</p>
            </div>
          )}

          {/* Resultado Líquido */}
          <div className={`flex items-center justify-between py-4 px-4 rounded-xl mt-2 ${stats.resultadoLiquido >= 0 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <div>
              <p className={`text-base font-extrabold ${stats.resultadoLiquido >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                Resultado Líquido
              </p>
              <p className="text-xs text-muted-foreground">Entradas − Custo Mercadorias − Custos Operacionais</p>
            </div>
            <p className={`text-2xl font-extrabold ${stats.resultadoLiquido >= 0 ? 'text-green-700' : 'text-red-600'}`}>
              {fmt(stats.resultadoLiquido)}
            </p>
          </div>
        </div>
      </Card>

      {/* Alertas */}
      {(stats.boletosVencidos > 0 || stats.boletosProximos > 0 || stats.chequesPendentes > 0) && (
        <div className="flex flex-wrap gap-3">
          {stats.boletosVencidos > 0 && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700">
              <AlertTriangle className="w-4 h-4" /><strong>{stats.boletosVencidos}</strong> boleto(s) vencido(s)
            </div>
          )}
          {stats.boletosProximos > 0 && (
            <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2 text-sm text-yellow-700">
              <Clock className="w-4 h-4" /><strong>{stats.boletosProximos}</strong> boleto(s) a vencer
            </div>
          )}
          {stats.chequesPendentes > 0 && (
            <div className="flex items-center gap-2 bg-purple-50 border border-purple-200 rounded-lg px-4 py-2 text-sm text-purple-700">
              <Clock className="w-4 h-4" /><strong>{stats.chequesPendentes}</strong> cheque(s) pendente(s)
            </div>
          )}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Gráfico histórico */}
        <Card className="p-4 lg:col-span-2">
          <h2 className="font-semibold text-sm mb-4">Histórico — últimos 6 meses</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} barGap={2}>
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={v => fmt(v)} />
              <Bar dataKey="Venda Bruta" fill="#3b82f6" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Receita Fin." fill="#22c55e" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Custos" fill="#ef4444" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-2 justify-center flex-wrap">
            {[['Venda Bruta', '#3b82f6'], ['Receita Fin.', '#22c55e'], ['Custos', '#ef4444']].map(([l, c]) => (
              <div key={l} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: c }} />{l}
              </div>
            ))}
          </div>
        </Card>

        {/* Últimos lançamentos */}
        <Card className="p-4">
          <h2 className="font-semibold text-sm mb-3">Últimos lançamentos</h2>
          <div className="space-y-2">
            {recent.length === 0 && <p className="text-xs text-muted-foreground">Nenhum lançamento ainda.</p>}
            {recent.map(t => (
              <div key={t.id} className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{t.description}</p>
                  <p className="text-[11px] text-muted-foreground">{t.type}</p>
                </div>
                <div className="flex items-center gap-1">
                  {t.type === 'entrada'
                    ? <ArrowUpRight className="w-3 h-3 text-green-600" />
                    : <ArrowDownRight className="w-3 h-3 text-red-500" />}
                  <span className={`text-xs font-bold ${t.type === 'entrada' ? 'text-green-600' : 'text-red-500'}`}>
                    R$ {t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Custos por categoria */}
      {stats.categoriasSaida.length > 0 && (
        <Card className="p-4">
          <h2 className="font-semibold text-sm mb-4">Custos por categoria (mês)</h2>
          <div className="space-y-2">
            {stats.categoriasSaida.map((c, i) => {
              const pct = stats.totalCustos > 0 ? (c.value / stats.totalCustos) * 100 : 0;
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-sm w-44 truncate text-muted-foreground">{c.name}</span>
                  <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                    <div className="h-full bg-red-400 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-sm font-semibold w-36 text-right">{fmt(c.value)}</span>
                  <span className="text-xs text-muted-foreground w-10 text-right">{pct.toFixed(0)}%</span>
                </div>
              );
            })}
            <div className="flex items-center justify-between pt-2 border-t mt-1">
              <span className="text-sm font-bold">Total de Custos</span>
              <span className="text-sm font-bold text-red-600">{fmt(stats.totalCustos)}</span>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}