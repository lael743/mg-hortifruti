import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Plus, Pencil, Trash2, Tag, Percent } from 'lucide-react';
import { toast } from 'sonner';

function PriceGroupForm({ group, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: group?.name || '',
    description: group?.description || '',
    discount_percent: group?.discount_percent ?? 0,
    active: group?.active !== false,
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.name) { toast.error('Informe o nome da tabela'); return; }
    setSaving(true);
    const data = { ...form, discount_percent: Number(form.discount_percent) };
    if (group) {
      await base44.entities.PriceGroup.update(group.id, data);
      toast.success('Tabela atualizada');
    } else {
      await base44.entities.PriceGroup.create(data);
      toast.success('Tabela criada');
    }
    setSaving(false);
    onSaved();
  };

  const discountVal = Number(form.discount_percent);
  const previewPrice = 100 * (1 - discountVal / 100);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{group ? 'Editar Tabela' : 'Nova Tabela de Preços'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nome da Tabela *</Label>
            <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ex: Atacado, Varejo, VIP..." />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea value={form.description} onChange={e => set('description', e.target.value)} placeholder="Descrição opcional" rows={2} />
          </div>
          <div>
            <Label>Desconto sobre preço base (%)</Label>
            <p className="text-xs text-muted-foreground mb-1">Use valor negativo para acréscimo. Ex: -10 = 10% mais caro</p>
            <Input type="number" step="0.1" value={form.discount_percent} onChange={e => set('discount_percent', e.target.value)} placeholder="0" />
            <p className="text-xs mt-1">
              Exemplo: produto R$ 100,00 →{' '}
              <strong className="text-primary">R$ {previewPrice.toFixed(2)}</strong>
              {discountVal > 0 && <span className="text-green-600"> ({discountVal}% desconto)</span>}
              {discountVal < 0 && <span className="text-red-500"> ({Math.abs(discountVal)}% acréscimo)</span>}
            </p>
          </div>
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <Label>Tabela ativa</Label>
            <Switch checked={form.active} onCheckedChange={v => set('active', v)} />
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button className="flex-1 bg-primary text-primary-foreground" onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : (group ? 'Atualizar' : 'Criar Tabela')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminPriceGroups() {
  const queryClient = useQueryClient();
  const [editGroup, setEditGroup] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ['price-groups'],
    queryFn: () => base44.entities.PriceGroup.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: id => base44.entities.PriceGroup.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['price-groups'] }); toast.success('Tabela excluída'); },
  });

  const handleSaved = () => {
    setShowForm(false);
    setEditGroup(null);
    queryClient.invalidateQueries({ queryKey: ['price-groups'] });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-sm text-muted-foreground">Crie tabelas de preços e atribua a clientes específicos.</p>
        </div>
        <Button className="bg-primary text-primary-foreground" onClick={() => { setEditGroup(null); setShowForm(true); }}>
          <Plus className="w-4 h-4 mr-1" />Nova Tabela
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
      ) : groups.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Tag className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p>Nenhuma tabela criada.</p>
          <p className="text-xs mt-1">Crie tabelas como "Atacado" (15% desc.) e "Varejo" (0%) e atribua a clientes.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map(g => (
            <Card key={g.id} className="p-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Percent className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{g.name}</h3>
                    {!g.active && <Badge variant="secondary" className="text-[10px]">Inativa</Badge>}
                  </div>
                  {g.description && <p className="text-xs text-muted-foreground">{g.description}</p>}
                  <p className="text-sm mt-1">
                    {g.discount_percent > 0
                      ? <span className="text-green-600 font-semibold">{g.discount_percent}% de desconto sobre preço base</span>
                      : g.discount_percent < 0
                      ? <span className="text-red-500 font-semibold">{Math.abs(g.discount_percent)}% de acréscimo sobre preço base</span>
                      : <span className="text-muted-foreground">Preço base (sem ajuste)</span>
                    }
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditGroup(g); setShowForm(true); }}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteMutation.mutate(g.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showForm && (
        <PriceGroupForm group={editGroup} onClose={() => { setShowForm(false); setEditGroup(null); }} onSaved={handleSaved} />
      )}
    </div>
  );
}