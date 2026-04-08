import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Upload } from 'lucide-react';

const STATES = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

export default function CompanySettingsDialog({ onClose }) {
  const [form, setForm] = useState({
    company_name: '', cnpj: '', address: '', city: '', state: '',
    whatsapp: '', whatsapp2: '', email: '', logo_url: '', report_footer: '',
  });
  const [existingId, setExistingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    base44.entities.CompanySettings.list().then(list => {
      if (list.length > 0) {
        const s = list[0];
        setExistingId(s.id);
        setForm({
          company_name: s.company_name || '',
          cnpj: s.cnpj || '',
          address: s.address || '',
          city: s.city || '',
          state: s.state || '',
          whatsapp: s.whatsapp || '',
          whatsapp2: s.whatsapp2 || '',
          email: s.email || '',
          logo_url: s.logo_url || '',
          report_footer: s.report_footer || '',
        });
      }
    });
  }, []);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    set('logo_url', file_url);
    setUploading(false);
  };

  const handleSave = async () => {
    if (!form.company_name) { toast.error('Informe o nome da empresa'); return; }
    setSaving(true);
    if (existingId) {
      await base44.entities.CompanySettings.update(existingId, form);
    } else {
      await base44.entities.CompanySettings.create(form);
    }
    toast.success('Configurações salvas!');
    setSaving(false);
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Dados da Empresa</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nome da Empresa *</Label>
            <Input value={form.company_name} onChange={e => set('company_name', e.target.value)} placeholder="Ex: Distribuidora Fruta Boa Ltda" />
          </div>
          <div>
            <Label>CNPJ</Label>
            <Input value={form.cnpj} onChange={e => set('cnpj', e.target.value)} placeholder="00.000.000/0001-00" />
          </div>
          <div>
            <Label>Endereço</Label>
            <Input value={form.address} onChange={e => set('address', e.target.value)} placeholder="Rua, número, bairro" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Label>Cidade</Label>
              <Input value={form.city} onChange={e => set('city', e.target.value)} />
            </div>
            <div>
              <Label>Estado</Label>
              <Select value={form.state} onValueChange={v => set('state', v)}>
                <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                <SelectContent>
                  {STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>WhatsApp Principal</Label>
              <Input value={form.whatsapp} onChange={e => set('whatsapp', e.target.value)} placeholder="(00) 90000-0000" />
            </div>
            <div>
              <Label>WhatsApp Secundário</Label>
              <Input value={form.whatsapp2} onChange={e => set('whatsapp2', e.target.value)} placeholder="(00) 90000-0000" />
            </div>
          </div>
          <div>
            <Label>E-mail</Label>
            <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="contato@empresa.com.br" />
          </div>
          <div>
            <Label>Logo da Empresa</Label>
            <div className="flex gap-2 mt-1">
              <Input value={form.logo_url} onChange={e => set('logo_url', e.target.value)} placeholder="URL do logo" className="flex-1" />
              <label className="cursor-pointer">
                <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                <Button variant="outline" size="icon" asChild disabled={uploading}>
                  <span><Upload className="w-4 h-4" /></span>
                </Button>
              </label>
            </div>
            {form.logo_url && <img src={form.logo_url} alt="Logo" className="h-12 mt-2 object-contain" />}
          </div>
          <div>
            <Label>Rodapé dos Relatórios</Label>
            <Textarea value={form.report_footer} onChange={e => set('report_footer', e.target.value)} placeholder="Ex: Sujeito a alterações de preço sem aviso prévio." rows={2} />
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button className="flex-1 bg-primary text-primary-foreground" onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}