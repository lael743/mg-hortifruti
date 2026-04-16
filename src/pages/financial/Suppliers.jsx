import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Phone, Mail, FileText, X, Check } from 'lucide-react';
import { toast } from 'sonner';

const empty = { name: '', cnpj_cpf: '', contact_name: '', phone: '', email: '', notes: '', active: true };

export default function Suppliers() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => base44.entities.Supplier.list('name'),
  });

  const saveMutation = useMutation({
    mutationFn: (data) => editing
      ? base44.entities.Supplier.update(editing.id, data)
      : base44.entities.Supplier.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['suppliers'] });
      setShowForm(false); setEditing(null); setForm(empty);
      toast.success(editing ? 'Fornecedor atualizado!' : 'Fornecedor criado!');
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Supplier.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['suppliers'] }); toast.success('Fornecedor excluído.'); },
  });

  const handleEdit = (s) => { setEditing(s); setForm({ ...s }); setShowForm(true); };
  const handleNew = () => { setEditing(null); setForm(empty); setShowForm(true); };
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="p-6 space-y-5 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Fornecedores</h1>
        <Button onClick={handleNew} className="gap-2"><Plus className="w-4 h-4" />Novo fornecedor</Button>
      </div>

      {showForm && (
        <Card className="p-5 border-primary/20 bg-primary/5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">{editing ? 'Editar fornecedor' : 'Novo fornecedor'}</h2>
            <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Nome *</label>
              <Input placeholder="Nome do fornecedor" value={form.name} onChange={e => set('name', e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">CNPJ / CPF</label>
              <Input placeholder="00.000.000/0000-00" value={form.cnpj_cpf} onChange={e => set('cnpj_cpf', e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Contato</label>
              <Input placeholder="Nome do contato" value={form.contact_name} onChange={e => set('contact_name', e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Telefone / WhatsApp</label>
              <Input placeholder="(00) 00000-0000" value={form.phone} onChange={e => set('phone', e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Email</label>
              <Input type="email" placeholder="email@fornecedor.com" value={form.email} onChange={e => set('email', e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Observações</label>
              <Input placeholder="Observações" value={form.notes} onChange={e => set('notes', e.target.value)} />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <Button variant="outline" onClick={() => setShowForm(false)} className="flex-1">Cancelar</Button>
            <Button className="flex-1" disabled={!form.name} onClick={() => saveMutation.mutate(form)}>Salvar</Button>
          </div>
        </Card>
      )}

      <div className="grid gap-3">
        {suppliers.length === 0 && <div className="text-center py-12 text-muted-foreground">Nenhum fornecedor cadastrado.</div>}
        {suppliers.map(s => (
          <Card key={s.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold">{s.name}</h3>
                  {!s.active && <Badge variant="secondary">Inativo</Badge>}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                  {s.cnpj_cpf && <span className="text-xs text-muted-foreground flex items-center gap-1"><FileText className="w-3 h-3" />{s.cnpj_cpf}</span>}
                  {s.phone && <span className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" />{s.phone}</span>}
                  {s.email && <span className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="w-3 h-3" />{s.email}</span>}
                  {s.contact_name && <span className="text-xs text-muted-foreground">Contato: {s.contact_name}</span>}
                </div>
                {s.notes && <p className="text-xs text-muted-foreground italic mt-1">{s.notes}</p>}
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(s)}><Pencil className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteMutation.mutate(s.id)}><Trash2 className="w-4 h-4" /></Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}