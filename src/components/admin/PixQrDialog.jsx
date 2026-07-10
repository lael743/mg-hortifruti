import React, { useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Copy, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { generatePixBrCode } from '@/lib/pixBrCode';

export default function PixQrDialog({ mensalidade, onClose }) {
  const [showCode, setShowCode] = useState(false);

  const brCode = useMemo(() => generatePixBrCode({
    chave: mensalidade.pix_chave,
    valor: mensalidade.valor,
    nome: mensalidade.pix_nome_beneficiario,
    cidade: mensalidade.pix_cidade,
  }), [mensalidade]);

  const venc = mensalidade.data_vencimento
    ? new Date(mensalidade.data_vencimento + 'T12:00:00').toLocaleDateString('pt-BR')
    : '—';

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>QR Code PIX</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3 py-2">
          <div className="bg-white p-4 rounded-xl border">
            <QRCodeSVG value={brCode} size={220} level="M" />
          </div>
          <div className="text-center w-full space-y-0.5">
            <p className="font-semibold text-sm">{mensalidade.descricao}</p>
            <p className="text-2xl font-bold text-primary">R$ {mensalidade.valor?.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">Vencimento: {venc}</p>
          </div>

          <div className="text-xs bg-muted rounded px-2 py-1.5 w-full text-center break-all">
            <strong>Chave ({mensalidade.pix_tipo?.toUpperCase()}):</strong> {mensalidade.pix_chave}
          </div>
          <div className="flex gap-2 w-full">
            <Button
              variant="outline"
              className="flex-1 gap-1"
              onClick={() => { navigator.clipboard.writeText(brCode); toast.success('Código PIX copiado!'); }}
            >
              <Copy className="w-3.5 h-3.5" />Copiar Código
            </Button>
            <Button
              variant="outline"
              className="flex-1 gap-1"
              onClick={() => { navigator.clipboard.writeText(mensalidade.pix_chave); toast.success('Chave copiada!'); }}
            >
              <Copy className="w-3.5 h-3.5" />Copiar Chave
            </Button>
          </div>

          <button
            onClick={() => setShowCode(!showCode)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            {showCode ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {showCode ? 'Ocultar' : 'Ver'} código BR
          </button>
          {showCode && (
            <div className="text-[10px] font-mono bg-muted rounded p-2 w-full break-all max-h-24 overflow-y-auto">
              {brCode}
            </div>
          )}

          <p className="text-[11px] text-muted-foreground text-center">
            Aponte a câmera do app do seu banco para o QR Code ou cole o código no campo "Pix Copia e Cola".
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}