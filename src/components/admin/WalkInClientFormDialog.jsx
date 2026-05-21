import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

const STATES = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

export default function WalkInClientFormDialog({ client, onClose, onSaved }) {
  const isNew = !client?.id;
  const [form, setForm] = useState({
    full_name: client?.full_name || '',
    company_name: client?.company_name || '',
    cnpj_cpf: client?.cnpj_cpf || '',
    whatsapp: client?.whatsapp || '',
    address: client?.address || '',
    city: client?.city || '',
    state: client?.state || '',
    price_group_id: client?.price_group_id || '',
    price_group_name: client?.price_group_name || '',
    salesperson_id: client?.salesperson_id || '',
    notes: client?.notes || '',
  });
  const [saving, setSaving] = useState(false);

  const { data: priceGroups = [] } = useQuery({
    queryKey: ['price-groups'],
    queryFn: () => base44.entities.PriceGroup.filter({ active: true }),
  });

  const { data: salespersons = [] } = useQuery({
    queryKey: ['salespersons'],
    queryFn: () => base44.entities.Salesperson.list(),
  });

  const set = (field, value) => setForm(p => ({ ...p, [field]: value }));

  const handleSave = async () => {
    if (!form.full_name.trim()) {
      toast.error('Informe o nome do cliente.');
      return;
    }
    setSaving(true);
    const pg = priceGroups.find(g => g.id === form.price_group_id);
    const data = { ...form, price_group_name: pg?.name || '' };
    if (isNew) {
      await base44.entities.WalkInClient.create(data);
      toast.success('Cliente avulso cadastrado!');
    } else {
      await base44.entities.WalkInClient.update(client.id, data);
      toast.success('Dados atualizados!');
    }
    setSaving(false);
    onSaved();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? 'Novo Cliente Avulso' : 'Editar Cliente Avulso'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <Label className="text-xs">Nome Completo *</Label>
              <Input value={form.full_name} onChange={e => set('full_name', e.target.value)} placeholder="Nome completo ou razão social" />
            </div>
            <div>
              <Label className="text-xs">Empresa / Estabelecimento</Label>
              <Input value={form.company_name} onChange={e => set('company_name', e.target.value)} placeholder="Nome fantasia" />
            </div>
            <div>
              <Label className="text-xs">CNPJ / CPF</Label>
              <Input value={form.cnpj_cpf} onChange={e => set('cnpj_cpf', e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">WhatsApp / Telefone</Label>
              <Input value={form.whatsapp} onChange={e => set('whatsapp', e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Tabela de Preços</Label>
              <Select value={form.price_group_id || '__none__'} onValueChange={v => set('price_group_id', v === '__none__' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Preço padrão" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Preço padrão (sem tabela)</SelectItem>
                  {priceGroups.map(g => (
                    <SelectItem key={g.id} value={g.id}>{g.name}{g.discount_percent ? ` (${g.discount_percent}%)` : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Vendedor / Responsável</Label>
              <Select value={form.salesperson_id || '__none__'} onValueChange={v => set('salesperson_id', v === '__none__' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Sem vendedor" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Sem vendedor</SelectItem>
                  {salespersons.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}{s.whatsapp ? ` (${s.whatsapp})` : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Endereço</Label>
              <Input value={form.address} onChange={e => set('address', e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Cidade</Label>
              <Input value={form.city} onChange={e => set('city', e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Estado</Label>
              <Select value={form.state || '__none__'} onValueChange={v => set('state', v === '__none__' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">—</SelectItem>
                  {STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Observações</Label>
              <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} placeholder="Observações internas sobre o cliente..." />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : isNew ? 'Cadastrar' : 'Salvar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}