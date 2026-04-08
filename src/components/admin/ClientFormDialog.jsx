import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

const STATES = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

export default function ClientFormDialog({ client, onClose, onSaved }) {
  const [form, setForm] = useState({
    company_name: client?.company_name || '',
    cnpj_cpf: client?.cnpj_cpf || '',
    whatsapp: client?.whatsapp || '',
    address: client?.address || '',
    city: client?.city || '',
    state: client?.state || '',
    notes: client?.notes || '',
    status: client?.status || 'approved',
  });
  const [saving, setSaving] = useState(false);

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    setSaving(true);
    await base44.entities.User.update(client.id, form);
    toast.success('Cliente atualizado');
    setSaving(false);
    onSaved();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Cliente</DialogTitle>
        </DialogHeader>

        <div className="space-y-1 bg-muted/50 rounded-xl p-3 mb-2">
          <p className="font-semibold text-sm">{client?.full_name || '—'}</p>
          <p className="text-xs text-muted-foreground">{client?.email}</p>
        </div>

        <div className="space-y-4">
          <div>
            <Label>Status de Aprovação</Label>
            <Select value={form.status} onValueChange={(v) => set('status', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">⏳ Pendente</SelectItem>
                <SelectItem value="approved">✅ Aprovado</SelectItem>
                <SelectItem value="rejected">❌ Rejeitado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Razão Social / Nome do Estabelecimento</Label>
            <Input value={form.company_name} onChange={(e) => set('company_name', e.target.value)} placeholder="Ex: Mercadinho do João" />
          </div>

          <div>
            <Label>CNPJ / CPF</Label>
            <Input value={form.cnpj_cpf} onChange={(e) => set('cnpj_cpf', e.target.value)} placeholder="00.000.000/0001-00" />
          </div>

          <div>
            <Label>WhatsApp</Label>
            <Input value={form.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} placeholder="(00) 90000-0000" />
          </div>

          <div>
            <Label>Endereço (Rua, Nº, Bairro)</Label>
            <Input value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="Rua das Flores, 123 - Centro" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Label>Cidade</Label>
              <Input value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="Ex: São Paulo" />
            </div>
            <div>
              <Label>Estado</Label>
              <Select value={form.state} onValueChange={(v) => set('state', v)}>
                <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                <SelectContent>
                  {STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Observações internas</Label>
            <Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Notas internas sobre o cliente..." rows={3} />
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button className="flex-1 bg-primary text-primary-foreground" onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}