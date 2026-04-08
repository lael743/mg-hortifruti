import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Upload, Leaf, Image, X } from 'lucide-react';

const STATES = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

export default function CompanySettingsDialog({ onClose }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    company_name: '', cnpj: '', address: '', city: '', state: '',
    whatsapp: '', whatsapp2: '', email: '', logo_url: '',
    banner_url: '', banner_title: '', banner_subtitle: '', report_footer: '',
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
          banner_url: s.banner_url || '',
          banner_title: s.banner_title || '',
          banner_subtitle: s.banner_subtitle || '',
          report_footer: s.report_footer || '',
        });
      }
    });
  }, []);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleFileUpload = async (e, field) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    set(field, file_url);
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
    queryClient.invalidateQueries({ queryKey: ['company-settings'] });
    onClose();
  };

  const BannerPreview = () => (
    <div
      className="relative rounded-xl overflow-hidden h-40 w-full flex items-center"
      style={form.banner_url
        ? { backgroundImage: `url(${form.banner_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
        : {}}
    >
      <div className={`absolute inset-0 rounded-xl ${form.banner_url ? 'bg-black/45' : 'bg-gradient-to-br from-primary/15 via-primary/5 to-transparent border border-border'}`} />
      <div className="relative z-10 px-6">
        <div className={`flex items-center gap-2 mb-1 ${form.banner_url ? 'text-white/80' : 'text-primary'}`}>
          <Leaf className="w-4 h-4" />
          <span className="text-xs font-semibold tracking-wide uppercase">{form.company_name || 'Nome da Empresa'}</span>
        </div>
        <p className={`text-lg font-extrabold leading-tight ${form.banner_url ? 'text-white' : 'text-foreground'}`}>
          {form.banner_title || <span className="opacity-40">Título do banner</span>}
        </p>
        {form.banner_subtitle && (
          <p className={`text-sm mt-1 ${form.banner_url ? 'text-white/85' : 'text-muted-foreground'}`}>{form.banner_subtitle}</p>
        )}
      </div>
    </div>
  );

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurações da Empresa</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="empresa">
          <TabsList className="w-full">
            <TabsTrigger value="empresa" className="flex-1">Empresa</TabsTrigger>
            <TabsTrigger value="banner" className="flex-1">Banner do Catálogo</TabsTrigger>
            <TabsTrigger value="outros" className="flex-1">Outros</TabsTrigger>
          </TabsList>

          {/* ABA EMPRESA */}
          <TabsContent value="empresa" className="space-y-4 pt-4">
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
                  <input type="file" accept="image/*" className="hidden" onChange={e => handleFileUpload(e, 'logo_url')} />
                  <Button variant="outline" size="icon" asChild disabled={uploading}>
                    <span><Upload className="w-4 h-4" /></span>
                  </Button>
                </label>
              </div>
              {form.logo_url && <img src={form.logo_url} alt="Logo" className="h-12 mt-2 object-contain" />}
            </div>
          </TabsContent>

          {/* ABA BANNER */}
          <TabsContent value="banner" className="space-y-4 pt-4">
            <p className="text-xs text-muted-foreground">Configure a aparência do banner exibido no topo do catálogo para seus clientes.</p>
            
            <BannerPreview />

            <div>
              <Label>Título do Banner</Label>
              <Input
                value={form.banner_title}
                onChange={e => set('banner_title', e.target.value)}
                placeholder="Ex: Produtos frescos direto do CEASA"
              />
            </div>
            <div>
              <Label>Subtítulo do Banner</Label>
              <Input
                value={form.banner_subtitle}
                onChange={e => set('banner_subtitle', e.target.value)}
                placeholder="Ex: Atacado direto para sua loja"
              />
            </div>
            <div>
              <Label>Imagem de Fundo</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={form.banner_url}
                  onChange={e => set('banner_url', e.target.value)}
                  placeholder="URL da imagem do banner"
                  className="flex-1"
                />
                <label className="cursor-pointer">
                  <input type="file" accept="image/*" className="hidden" onChange={e => handleFileUpload(e, 'banner_url')} />
                  <Button variant="outline" size="icon" asChild disabled={uploading}>
                    <span><Upload className="w-4 h-4" /></span>
                  </Button>
                </label>
                {form.banner_url && (
                  <Button variant="outline" size="icon" onClick={() => set('banner_url', '')}>
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Deixe em branco para usar o fundo padrão com gradiente verde.</p>
            </div>
          </TabsContent>

          {/* ABA OUTROS */}
          <TabsContent value="outros" className="space-y-4 pt-4">
            <div>
              <Label>Rodapé dos Relatórios</Label>
              <Textarea value={form.report_footer} onChange={e => set('report_footer', e.target.value)} placeholder="Ex: Sujeito a alterações de preço sem aviso prévio." rows={3} />
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex gap-3 pt-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button className="flex-1 bg-primary text-primary-foreground" onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}