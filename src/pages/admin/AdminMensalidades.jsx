import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useOutletContext } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Pencil, Trash2, FileDown, Link2, QrCode, Repeat, CheckCircle2, Clock } from 'lucide-react';
import { toast } from 'sonner';
import MensalidadeFormDialog from '@/components/admin/MensalidadeFormDialog';
import PixQrDialog from '@/components/admin/PixQrDialog';

const OWNER_EMAIL = 'centralgpsf@gmail.com';

function todayStr() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Porto_Velho' });
}

export default function AdminMensalidades() {
  const { user } = useOutletContext();
  const isOwner = user?.email === OWNER_EMAIL;
  const queryClient = useQueryClient();
  const [editingItem, setEditingItem] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [qrMensalidade, setQrMensalidade] = useState(null);

  const { data: mensalidades = [], isLoading } = useQuery({
    queryKey: ['mensalidades'],
    queryFn: async () => {
      const res = await base44.functions.invoke('manageMensalidade', { action: 'list' });
      return res.data?.items || [];
    },
  });

  const marcarPagaMutation = useMutation({
    mutationFn: (id) => base44.functions.invoke('manageMensalidade', { action: 'markPaid', id }),
    onSuccess: (resp) => {
      queryClient.invalidateQueries({ queryKey: ['mensalidades'] });
      const proximaData = resp?.data?.proximaData;
      if (proximaData) {
        const d = new Date(proximaData + 'T12:00:00').toLocaleDateString('pt-BR');
        toast.success(`Paga! Próximo vencimento criado: ${d}`);
      } else {
        toast.success('Mensalidade marcada como paga!');
      }
    },
    onError: () => toast.error('Erro ao marcar como paga.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.functions.invoke('manageMensalidade', { action: 'delete', id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mensalidades'] });
      setConfirmDelete(null);
      toast.success('Mensalidade excluída.');
    },
    onError: () => toast.error('Erro ao excluir.'),
  });

  const hoje = todayStr();
  const pendentes = mensalidades.filter(m => m.status !== 'paga');
  const pagas = mensalidades.filter(m => m.status === 'paga');

  function statusBadge(m) {
    if (m.status === 'paga') return <Badge className="bg-green-100 text-green-800 border-green-200 border">Paga</Badge>;
    if (m.data_vencimento < hoje) return <Badge className="bg-red-100 text-red-800 border-red-200 border">Vencida</Badge>;
    return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 border">Pendente</Badge>;
  }

  function renderCard(m) {
    return (
      <Card key={m.id} className="p-4 border border-slate-200 shadow-sm bg-white space-y-3">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm">{m.descricao}</span>
              {statusBadge(m)}
              {m.recorrente && (
                <Badge className="bg-blue-100 text-blue-800 border-blue-200 border gap-1">
                  <Repeat className="w-3 h-3" /> Recorrente
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Vencimento: <strong>{m.data_vencimento ? new Date(m.data_vencimento + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}</strong>
              &nbsp;•&nbsp;
              <span className="text-primary font-bold">R$ {m.valor?.toFixed(2)}</span>
            </p>
          </div>
          <div className="flex gap-1 shrink-0 flex-wrap">
            {(m.tipo_cobranca || []).includes('boleto') && m.boleto_url && (
              <a href={m.boleto_url} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="outline" className="gap-1 text-xs"><FileDown className="w-3.5 h-3.5" />PDF</Button>
              </a>
            )}
            {(m.tipo_cobranca || []).includes('boleto') && m.boleto_link && (
              <a href={m.boleto_link} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="outline" className="gap-1 text-xs"><Link2 className="w-3.5 h-3.5" />Boleto</Button>
              </a>
            )}
            {(m.tipo_cobranca || []).includes('link') && m.link_pagamento && (
              <a href={m.link_pagamento} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="outline" className="gap-1 text-xs"><Link2 className="w-3.5 h-3.5" />Link</Button>
              </a>
            )}
            {(m.tipo_cobranca || []).includes('pix') && m.pix_chave && (
              <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => setQrMensalidade(m)}>
                <QrCode className="w-3.5 h-3.5" />PIX QR
              </Button>
            )}
            {isOwner && m.status !== 'paga' && (
              <Button
                size="sm" variant="outline"
                className="gap-1 text-xs border-green-300 text-green-700 hover:bg-green-50"
                onClick={() => marcarPagaMutation.mutate(m.id)}
                disabled={marcarPagaMutation.isPending}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />Pago
              </Button>
            )}
            {isOwner && (
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditingItem(m); setShowForm(true); }}>
                <Pencil className="w-4 h-4" />
              </Button>
            )}
            {isOwner && (
              confirmDelete === m.id ? (
                <div className="flex gap-1">
                  <Button size="icon" variant="destructive" className="h-8 w-8" onClick={() => deleteMutation.mutate(m.id)}>✓</Button>
                  <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setConfirmDelete(null)}>✕</Button>
                </div>
              ) : (
                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => setConfirmDelete(m.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              )
            )}
          </div>
        </div>
        {m.notas && <p className="text-xs text-muted-foreground bg-muted rounded px-2 py-1">{m.notas}</p>}
        {(m.tipo_cobranca || []).includes('pix') && m.pix_chave && (
          <div className="text-xs bg-blue-50 border border-blue-200 rounded px-2 py-1 text-blue-800">
            <strong>PIX:</strong> {m.pix_chave} &nbsp;•&nbsp; <strong>R$ {m.valor?.toFixed(2)}</strong>
          </div>
        )}
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Mensalidades</h2>
          <p className="text-sm text-muted-foreground">
            {isOwner ? 'Gerencie as mensalidades do sistema.' : 'Visualização das mensalidades.'}
          </p>
        </div>
        {isOwner && (
          <Button onClick={() => { setEditingItem(null); setShowForm(true); }}>
            <Plus className="w-4 h-4 mr-1.5" />Nova Mensalidade
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      ) : mensalidades.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">Nenhuma mensalidade cadastrada.</div>
      ) : (
        <>
          {pendentes.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-yellow-600" />
                <h3 className="font-semibold text-sm text-yellow-700">Pendentes / Vencidas ({pendentes.length})</h3>
              </div>
              {pendentes.map(renderCard)}
            </div>
          )}
          {pagas.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <h3 className="font-semibold text-sm text-green-700">Pagas ({pagas.length})</h3>
              </div>
              {pagas.map(renderCard)}
            </div>
          )}
        </>
      )}

      {showForm && (
        <MensalidadeFormDialog
          mensalidade={editingItem}
          onClose={() => { setShowForm(false); setEditingItem(null); }}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ['mensalidades'] });
            setShowForm(false);
            setEditingItem(null);
          }}
        />
      )}

      {qrMensalidade && (
        <PixQrDialog mensalidade={qrMensalidade} onClose={() => setQrMensalidade(null)} />
      )}
    </div>
  );
}