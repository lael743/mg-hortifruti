import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Loader2, Upload, Repeat } from 'lucide-react';

const TIPOS = [
  { id: 'boleto', label: 'Boleto' },
  { id: 'pix', label: 'PIX' },
  { id: 'link', label: 'Link de pagamento' },
];

const EMPTY = {
  descricao: '',
  valor: '',
  data_vencimento: '',
  tipo_cobranca: [],
  boleto_url: '',
  boleto_link: '',
  pix_chave: '',
  pix_nome_beneficiario: '',
  pix_cidade: '',
  link_pagamento: '',
  recorrente: false,
  intervalo_dias: '30',
  notas: '',
};

export default function MensalidadeFormDialog({ mensalidade, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [uploadingBoleto, setUploadingBoleto] = useState(false);

  useEffect(() => {
    if (mensalidade) {
      setForm({ ...EMPTY, ...mensalidade, valor: mensalidade.valor?.toString() || '' });
    } else {
      setForm(EMPTY);
    }
  }, [mensalidade]);

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }));

  const toggleTipo = (tipo) => {
    setForm(f => ({
      ...f,
      tipo_cobranca: f.tipo_cobranca.includes(tipo)
        ? f.tipo_cobranca.filter(t => t !== tipo)
        : [...f.tipo_cobranca, tipo],
    }));
  };

  const handleUploadBoleto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') { toast.error('Apenas PDF.'); return; }
    setUploadingBoleto(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      set('boleto_url', file_url);
      toast.success('PDF enviado!');
    } catch {
      toast.error('Erro ao enviar PDF.');
    } finally {
      setUploadingBoleto(false);
    }
  };

  const handleSave = async () => {
    if (!form.descricao.trim()) { toast.error('Informe a descrição.'); return; }
    if (!form.valor || isNaN(parseFloat(form.valor))) { toast.error('Informe o valor.'); return; }
    if (!form.data_vencimento) { toast.error('Informe o vencimento.'); return; }
    if (form.tipo_cobranca.length === 0) { toast.error('Selecione ao menos uma forma de cobrança.'); return; }

    setSaving(true);
    const payload = {
      ...form,
      valor: parseFloat(form.valor),
      intervalo_dias: parseInt(form.intervalo_dias, 10) || 30,
    };
    ['boleto_url', 'boleto_link', 'pix_chave', 'link_pagamento'].forEach(k => {
      if (!payload[k]) delete payload[k];
    });

    try {
      if (mensalidade?.id) {
        await base44.functions.invoke('manageMensalidade', { action: 'update', id: mensalidade.id, data: payload });
        toast.success('Mensalidade atualizada!');
      } else {
        await base44.functions.invoke('manageMensalidade', { action: 'create', data: payload });
        toast.success('Mensalidade criada!');
      }
      onSaved();
    } catch {
      toast.error('Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  const hasBoleto = form.tipo_cobranca.includes('boleto');
  const hasPix = form.tipo_cobranca.includes('pix');
  const hasLink = form.tipo_cobranca.includes('link');

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mensalidade ? 'Editar Mensalidade' : 'Nova Mensalidade'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Descrição *</Label>
            <Input value={form.descricao} onChange={e => set('descricao', e.target.value)} placeholder="Ex: Plano Pro - Agosto/2026" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Valor (R$) *</Label>
              <Input type="number" step="0.01" value={form.valor} onChange={e => set('valor', e.target.value)} placeholder="0,00" />
            </div>
            <div>
              <Label>Vencimento *</Label>
              <Input type="date" value={form.data_vencimento} onChange={e => set('data_vencimento', e.target.value)} />
            </div>
          </div>

          <div>
            <Label className="mb-2 block">Formas de cobrança *</Label>
            <div className="flex gap-4 flex-wrap">
              {TIPOS.map(t => (
                <label key={t.id} className="flex items-center gap-2 cursor-pointer text-sm">
                  <Checkbox checked={form.tipo_cobranca.includes(t.id)} onCheckedChange={() => toggleTipo(t.id)} />
                  {t.label}
                </label>
              ))}
            </div>
          </div>

          {hasBoleto && (
            <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Boleto</p>
              <div>
                <Label className="text-xs">Upload PDF do Boleto</Label>
                <div className="flex items-center gap-2 mt-1">
                  <label className="cursor-pointer">
                    <input type="file" accept="application/pdf" className="hidden" onChange={handleUploadBoleto} />
                    <Button type="button" size="sm" variant="outline" disabled={uploadingBoleto} asChild>
                      <span>
                        {uploadingBoleto ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Upload className="w-3.5 h-3.5 mr-1" />}
                        {form.boleto_url ? 'Substituir PDF' : 'Enviar PDF'}
                      </span>
                    </Button>
                  </label>
                  {form.boleto_url && <span className="text-xs text-green-700">✓ PDF carregado</span>}
                </div>
              </div>
              <div>
                <Label className="text-xs">Link externo do boleto</Label>
                <Input value={form.boleto_link} onChange={e => set('boleto_link', e.target.value)} placeholder="https://..." className="mt-1" />
              </div>
            </div>
          )}

          {hasPix && (
            <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">PIX</p>
              <div>
                <Label className="text-xs">Chave PIX</Label>
                <Input value={form.pix_chave} onChange={e => set('pix_chave', e.target.value)} placeholder="CPF, CNPJ, email, telefone ou chave aleatória" className="mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Nome do beneficiário</Label>
                  <Input value={form.pix_nome_beneficiario} onChange={e => set('pix_nome_beneficiario', e.target.value)} placeholder="Nome (max 25)" className="mt-1" maxLength={25} />
                </div>
                <div>
                  <Label className="text-xs">Cidade</Label>
                  <Input value={form.pix_cidade} onChange={e => set('pix_cidade', e.target.value)} placeholder="Cidade (max 15)" className="mt-1" maxLength={15} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Valor R$ {parseFloat(form.valor || 0).toFixed(2)} será incluído no QR Code.</p>
            </div>
          )}

          {hasLink && (
            <div className="space-y-2 border rounded-lg p-3 bg-muted/30">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Link de Pagamento</p>
              <Input value={form.link_pagamento} onChange={e => set('link_pagamento', e.target.value)} placeholder="https://..." />
            </div>
          )}

          <div className="space-y-3 border rounded-lg p-3 bg-blue-50/40">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Repeat className="w-4 h-4 text-blue-600" />
                <div>
                  <p className="text-sm font-medium">Recorrência automática</p>
                  <p className="text-xs text-muted-foreground">Gera o próximo vencimento ao marcar como paga.</p>
                </div>
              </div>
              <Switch checked={form.recorrente} onCheckedChange={v => set('recorrente', v)} />
            </div>
            {form.recorrente && (
              <div>
                <Label className="text-xs">Intervalo (dias)</Label>
                <Input type="number" min="1" value={form.intervalo_dias} onChange={e => set('intervalo_dias', e.target.value)} className="mt-1 w-32" />
              </div>
            )}
          </div>

          <div>
            <Label>Observações</Label>
            <Textarea value={form.notas} onChange={e => set('notas', e.target.value)} placeholder="Notas internas..." rows={2} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              Salvar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}