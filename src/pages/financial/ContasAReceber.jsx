import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { format, parseISO, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Search, Settings2, ChevronDown, ChevronUp, CheckCircle2, Clock, AlertTriangle, Ban, DollarSign } from 'lucide-react';
import ReceivableSetupModal from '@/components/financial/ReceivableSetupModal';
import ReceivablePayModal from '@/components/financial/ReceivablePayModal';

const statusConfig = {
  pendente_definicao: { label: 'Aguardando Definição', color: 'bg-orange-100 text-orange-800 border-orange-200' },
  aberta: { label: 'Em Aberto', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  parcialmente_paga: { label: 'Parcialmente Paga', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  quitada: { label: 'Quitada', color: 'bg-green-100 text-green-800 border-green-200' },
  cancelada: { label: 'Cancelada', color: 'bg-gray-100 text-gray-500 border-gray-200' },
};

const methodLabel = {
  boleto: 'Boleto', cheque: 'Cheque', pix: 'Pix', cartao_credito: 'Cartão Crédito',
  cartao_debito: 'Cartão Débito', dinheiro: 'Dinheiro', transferencia: 'Transferência',
};

const fmt = v => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

function InstallmentRow({ inst, onPay, canPay }) {
  const today = new Date();
  const due = parseISO(inst.due_date);
  const overdue = inst.status === 'pendente' && isBefore(due, today);

  return (
    <div className={`flex items-center gap-3 px-4 py-2 text-sm border-t flex-wrap ${overdue ? 'bg-red-50' : ''}`}>
      <span className="w-8 text-muted-foreground font-medium text-center">{inst.installment_number}</span>
      <span className={`w-28 ${overdue ? 'text-red-600 font-semibold' : 'text-foreground'}`}>
        {format(due, 'dd/MM/yyyy')}
      </span>
      <span className="w-32 font-semibold">{fmt(inst.amount)}</span>
      <div className="flex-1">
        {inst.status === 'paga' ? (
          <span className="text-xs text-green-700">✓ Recebido em {inst.paid_date ? format(parseISO(inst.paid_date), 'dd/MM/yyyy') : '-'} · {methodLabel[inst.payment_method] || inst.payment_method}</span>
        ) : overdue ? (
          <span className="text-xs text-red-600 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Vencida</span>
        ) : (
          <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />Pendente</span>
        )}
        {inst.notes && <span className="text-xs text-muted-foreground ml-2">· {inst.notes}</span>}
      </div>
      {inst.status !== 'paga' && canPay && (
        <Button size="sm" className="gap-1 bg-green-600 hover:bg-green-700 text-white h-7 text-xs" onClick={() => onPay()}>
          <CheckCircle2 className="w-3 h-3" />Baixar
        </Button>
      )}
    </div>
  );
}

function ReceivableCard({ receivable, onSetup, onPay, expanded, onToggle }) {
  const cfg = statusConfig[receivable.status] || statusConfig.aberta;
  const paidAmount = (receivable.installments || []).filter(i => i.status === 'paga').reduce((s, i) => s + i.amount, 0);
  const pendingAmount = receivable.total_amount - paidAmount;

  return (
    <Card className="overflow-hidden">
      <div
        className="flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/30 transition-colors flex-wrap"
        onClick={onToggle}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-bold text-sm">{receivable.customer_name || receivable.customer_email}</span>
            <Badge className={`${cfg.color} border text-[10px] px-1.5`}>{cfg.label}</Badge>
            {receivable.payment_method && (
              <Badge variant="outline" className="text-[10px] px-1.5">{methodLabel[receivable.payment_method]}</Badge>
            )}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
            <span>Pedido #{receivable.order_number}</span>
            <span>Entregue: {receivable.delivery_date ? format(parseISO(receivable.delivery_date), 'dd/MM/yyyy') : '-'}</span>
            {receivable.installments_count > 1 && <span>{receivable.installments_count}x</span>}
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-extrabold">{fmt(receivable.total_amount)}</p>
          {paidAmount > 0 && paidAmount < receivable.total_amount && (
            <p className="text-xs text-green-600">Recebido: {fmt(paidAmount)}</p>
          )}
          {pendingAmount > 0 && receivable.status !== 'pendente_definicao' && (
            <p className="text-xs text-orange-600">Pendente: {fmt(pendingAmount)}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {receivable.status === 'pendente_definicao' && (
            <Button size="sm" className="gap-1.5 h-8" onClick={e => { e.stopPropagation(); onSetup(); }}>
              <Settings2 className="w-3.5 h-3.5" />Configurar
            </Button>
          )}
          {expanded ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
        </div>
      </div>

      {expanded && receivable.installments?.length > 0 && (
        <div className="bg-muted/20">
          <div className="flex items-center gap-3 px-4 py-2 text-xs font-semibold text-muted-foreground border-t">
            <span className="w-8 text-center">#</span>
            <span className="w-28">Vencimento</span>
            <span className="w-32">Valor</span>
            <span className="flex-1">Status</span>
          </div>
          {receivable.installments.map((inst, idx) => (
            <InstallmentRow
              key={idx}
              inst={inst}
              canPay={receivable.status !== 'cancelada'}
              onPay={() => onPay(idx)}
            />
          ))}
        </div>
      )}

      {expanded && receivable.installments?.length === 0 && receivable.status !== 'pendente_definicao' && (
        <div className="px-4 py-3 text-sm text-muted-foreground border-t">Nenhuma parcela cadastrada.</div>
      )}
    </Card>
  );
}

export default function ContasAReceberPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [setupModal, setSetupModal] = useState(null);
  const [payModal, setPayModal] = useState(null); // { receivable, installmentIdx }

  const { data: receivables = [], isLoading } = useQuery({
    queryKey: ['contas-a-receber'],
    queryFn: () => base44.entities.ContasAReceber.list('-created_date'),
  });

  const filtered = useMemo(() => {
    let r = receivables;
    if (statusFilter !== 'all') r = r.filter(x => x.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter(x => x.customer_name?.toLowerCase().includes(q) || x.customer_email?.toLowerCase().includes(q) || String(x.order_number).includes(q));
    }
    return r;
  }, [receivables, statusFilter, search]);

  const stats = useMemo(() => {
    const pendDef = receivables.filter(x => x.status === 'pendente_definicao').length;
    const abertas = receivables.filter(x => ['aberta', 'parcialmente_paga'].includes(x.status));
    const totalAberto = abertas.reduce((s, x) => {
      const paid = (x.installments || []).filter(i => i.status === 'paga').reduce((a, i) => a + i.amount, 0);
      return s + (x.total_amount - paid);
    }, 0);
    const totalQuitado = receivables.filter(x => x.status === 'quitada').reduce((s, x) => s + x.total_amount, 0);
    return { pendDef, totalAberto, totalQuitado };
  }, [receivables]);

  const handleSaved = () => {
    qc.invalidateQueries({ queryKey: ['contas-a-receber'] });
    setSetupModal(null);
    setPayModal(null);
  };

  return (
    <div className="p-6 space-y-5 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Contas a Receber</h1>
        <p className="text-sm text-muted-foreground">Gestão de cobranças por cliente</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-center">
          <p className="text-xs text-orange-700 font-medium">Aguardando Definição</p>
          <p className="text-2xl font-extrabold text-orange-700">{stats.pendDef}</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
          <p className="text-xs text-blue-700 font-medium">Saldo em Aberto</p>
          <p className="text-lg font-extrabold text-blue-700">{fmt(stats.totalAberto)}</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
          <p className="text-xs text-green-700 font-medium">Total Quitado</p>
          <p className="text-lg font-extrabold text-green-700">{fmt(stats.totalQuitado)}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9 h-9" placeholder="Buscar cliente ou pedido..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none cursor-pointer"
        >
          <option value="all">Todos os status</option>
          {Object.entries(statusConfig).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
        </select>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="space-y-2">{Array(4).fill(0).map((_, i) => <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p>Nenhuma conta a receber encontrada.</p>
          <p className="text-xs mt-1">Pedidos entregues aparecerão aqui automaticamente.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => (
            <ReceivableCard
              key={r.id}
              receivable={r}
              expanded={expandedId === r.id}
              onToggle={() => setExpandedId(expandedId === r.id ? null : r.id)}
              onSetup={() => setSetupModal(r)}
              onPay={(idx) => setPayModal({ receivable: r, installmentIdx: idx })}
            />
          ))}
        </div>
      )}

      {setupModal && (
        <ReceivableSetupModal
          receivable={setupModal}
          onClose={() => setSetupModal(null)}
          onSaved={handleSaved}
        />
      )}
      {payModal && (
        <ReceivablePayModal
          receivable={payModal.receivable}
          installmentIdx={payModal.installmentIdx}
          onClose={() => setPayModal(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}