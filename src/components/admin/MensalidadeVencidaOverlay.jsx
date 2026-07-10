import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { base44 } from '@/api/base44Client';
import { AlertTriangle, QrCode, FileDown, Link2, Copy, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { generatePixBrCode } from '@/lib/pixBrCode';

function todayStr() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Porto_Velho' });
}

export default function MensalidadeVencidaOverlay() {
  const [showQr, setShowQr] = useState(false);
  const [showCode, setShowCode] = useState(false);

  const { data: mensalidades = [], isLoading } = useQuery({
    queryKey: ['mensalidades'],
    queryFn: async () => {
      const res = await base44.functions.invoke('manageMensalidade', { action: 'list' });
      return res.data?.items || [];
    },
    refetchInterval: 5 * 60 * 1000,
  });

  if (isLoading) return null;

  const hoje = todayStr();
  const vencidas = mensalidades.filter(m => m.status === 'pendente' && m.data_vencimento && m.data_vencimento < hoje);

  if (vencidas.length === 0) return null;

  const principal = [...vencidas].sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento))[0];
  const hasBoleto = (principal.tipo_cobranca || []).includes('boleto');
  const hasPix = (principal.tipo_cobranca || []).includes('pix');
  const hasLink = (principal.tipo_cobranca || []).includes('link');

  const brCode = hasPix && principal.pix_chave
    ? generatePixBrCode({ chave: principal.pix_chave, valor: principal.valor, nome: principal.pix_nome_beneficiario, cidade: principal.pix_cidade })
    : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border-2 border-red-400 max-w-md w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center gap-3">
          <div className="bg-red-100 rounded-full p-3 shrink-0">
            <AlertTriangle className="w-7 h-7 text-red-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-red-700">Mensalidade Vencida</h2>
            <p className="text-sm text-muted-foreground">
              {vencidas.length} mensalidade{vencidas.length > 1 ? 's' : ''} pendente{vencidas.length > 1 ? 's' : ''}.
            </p>
          </div>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-1">
          <p className="font-semibold text-sm">{principal.descricao}</p>
          <p className="text-2xl font-bold text-red-700">R$ {principal.valor?.toFixed(2)}</p>
          <p className="text-xs text-muted-foreground">
            Venceu em: {new Date(principal.data_vencimento + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
          </p>
        </div>

        {principal.notas && (
          <p className="text-xs text-muted-foreground italic bg-muted rounded px-2 py-1">{principal.notas}</p>
        )}

        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Realizar pagamento:</p>

          {hasBoleto && principal.boleto_url && (
            <a href={principal.boleto_url} target="_blank" rel="noopener noreferrer" className="block">
              <Button className="w-full gap-2" variant="outline"><FileDown className="w-4 h-4" />Baixar Boleto PDF</Button>
            </a>
          )}
          {hasBoleto && principal.boleto_link && (
            <a href={principal.boleto_link} target="_blank" rel="noopener noreferrer" className="block">
              <Button className="w-full gap-2" variant="outline"><Link2 className="w-4 h-4" />Acessar Boleto Online</Button>
            </a>
          )}
          {hasLink && principal.link_pagamento && (
            <a href={principal.link_pagamento} target="_blank" rel="noopener noreferrer" className="block">
              <Button className="w-full gap-2" variant="outline"><Link2 className="w-4 h-4" />Link de Pagamento</Button>
            </a>
          )}
          {hasPix && principal.pix_chave && (
            <>
              <Button className="w-full gap-2" variant="outline"
                onClick={() => { navigator.clipboard.writeText(principal.pix_chave); toast.success('Chave PIX copiada!'); }}>
                <Copy className="w-4 h-4" />Copiar Chave PIX — R$ {principal.valor?.toFixed(2)}
              </Button>
              <Button className="w-full gap-2" variant="outline" onClick={() => setShowQr(!showQr)}>
                <QrCode className="w-4 h-4" />{showQr ? 'Ocultar QR Code' : 'Mostrar QR Code'}
              </Button>
              {showQr && (
                <div className="flex flex-col items-center gap-2 bg-muted rounded-xl p-4">
                  <div className="bg-white p-3 rounded-lg border">
                    <QRCodeSVG value={brCode || ' '} size={200} level="M" />
                  </div>
                  <div className="flex gap-2 w-full">
                    <Button variant="outline" size="sm" className="flex-1 gap-1"
                      onClick={() => { navigator.clipboard.writeText(brCode); toast.success('Código PIX copiado!'); }}>
                      <Copy className="w-3.5 h-3.5" />Copiar Código
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1 gap-1"
                      onClick={() => { navigator.clipboard.writeText(principal.pix_chave); toast.success('Chave copiada!'); }}>
                      <Copy className="w-3.5 h-3.5" />Copiar Chave
                    </Button>
                  </div>
                  <button onClick={() => setShowCode(!showCode)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                    {showCode ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    {showCode ? 'Ocultar' : 'Ver'} código BR
                  </button>
                  {showCode && (
                    <div className="text-[10px] font-mono bg-white border rounded p-2 w-full break-all max-h-24 overflow-y-auto">{brCode}</div>
                  )}
                </div>
              )}
              <div className="text-xs bg-blue-50 border border-blue-200 rounded px-3 py-2 text-blue-800 break-all">
                <strong>Chave PIX:</strong> {principal.pix_chave}
              </div>
            </>
          )}
        </div>

        <p className="text-xs text-center text-muted-foreground">
          Este aviso desaparece automaticamente após o pagamento ser confirmado.
        </p>
      </div>
    </div>
  );
}