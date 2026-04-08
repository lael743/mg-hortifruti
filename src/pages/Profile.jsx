import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User, Building2, Phone, MapPin, FileText, Save, Check } from 'lucide-react';
import { toast } from 'sonner';

const STATES = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

export default function Profile() {
  const { user } = useOutletContext();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [form, setForm] = useState({
    full_name: '',
    company_name: '',
    cnpj_cpf: '',
    whatsapp: '',
    phone: '',
    address: '',
    city: '',
    state: '',
  });

  useEffect(() => {
    if (user) {
      setForm({
        full_name: user.full_name || '',
        company_name: user.company_name || '',
        cnpj_cpf: user.cnpj_cpf || '',
        whatsapp: user.whatsapp || '',
        phone: user.phone || '',
        address: user.address || '',
        city: user.city || '',
        state: user.state || '',
      });
    }
  }, [user]);

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  const handleSave = async () => {
    setSaving(true);
    await base44.auth.updateMe(form);
    setSaving(false);
    setSaved(true);
    toast.success('Perfil atualizado com sucesso!');
    setTimeout(() => setSaved(false), 3000);
  };

  if (!user) return null;

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
          <User className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Meu Perfil</h1>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
      </div>

      <div className="space-y-5">
        {/* Dados pessoais */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <User className="w-4 h-4 text-primary" /> Dados Pessoais
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs mb-1 block">Nome completo</Label>
              <Input value={user.full_name || ''} readOnly className="bg-muted cursor-not-allowed opacity-70" />
              <p className="text-xs text-muted-foreground mt-1">O nome é gerenciado pelo sistema de login e não pode ser alterado aqui.</p>
            </div>
          </CardContent>
        </Card>

        {/* Dados da empresa */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" /> Dados da Empresa
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs mb-1 block">Nome da empresa</Label>
              <Input value={form.company_name} onChange={set('company_name')} placeholder="Razão social ou nome fantasia" />
            </div>
            <div>
              <Label className="text-xs mb-1 block">CNPJ / CPF</Label>
              <Input value={form.cnpj_cpf} onChange={set('cnpj_cpf')} placeholder="00.000.000/0000-00" />
            </div>
          </CardContent>
        </Card>

        {/* Contato */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Phone className="w-4 h-4 text-primary" /> Contato
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs mb-1 block">WhatsApp</Label>
              <Input value={form.whatsapp} onChange={set('whatsapp')} placeholder="(00) 90000-0000" />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Telefone fixo</Label>
              <Input value={form.phone} onChange={set('phone')} placeholder="(00) 0000-0000" />
            </div>
          </CardContent>
        </Card>

        {/* Endereço */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" /> Endereço
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs mb-1 block">Endereço</Label>
              <Input value={form.address} onChange={set('address')} placeholder="Rua, número, bairro" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1 block">Cidade</Label>
                <Input value={form.city} onChange={set('city')} placeholder="Cidade" />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Estado</Label>
                <Select value={form.state} onValueChange={(v) => setForm(f => ({ ...f, state: v }))}>
                  <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                  <SelectContent>
                    {STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Button
          className="w-full bg-primary text-primary-foreground"
          onClick={handleSave}
          disabled={saving}
        >
          {saved ? <><Check className="w-4 h-4 mr-2" />Salvo!</> : saving ? 'Salvando...' : <><Save className="w-4 h-4 mr-2" />Salvar alterações</>}
        </Button>
      </div>
    </main>
  );
}