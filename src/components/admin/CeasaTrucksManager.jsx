import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Trash2, Pencil, Truck } from 'lucide-react';

const EMPTY = { name: '', plate: '', active: true };

/**
 * Cadastro de caminhões do Ceasa. Caminhões são globais da empresa
 * e não possuem vínculo com Box.
 */
export default function CeasaTrucksManager() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const { data: trucks = [], isLoading } = useQuery({
    queryKey: ['ceasa-trucks'],
    queryFn: () => base44.entities.CeasaTruck.list('-created_date', 200),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['ceasa-trucks'] });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.CeasaTruck.create(data),
    onSuccess: () => { invalidate(); toast.success('Caminhão cadastrado!'); setShowForm(false); },
    onError: () => toast.error('Erro ao cadastrar caminhão.'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.CeasaTruck.update(id, data),
    onSuccess: () => { invalidate(); toast.success('Caminhão atualizado!'); setShowForm(false); },
    onError: () => toast.error('Erro ao atualizar caminhão.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.CeasaTruck.delete(id),
    onSuccess: () => { invalidate(); toast.success('Caminhão excluído.'); },
    onError: () => toast.error('Erro ao excluir caminhão.'),
  });

  const openNew = () => { setForm(EMPTY); setEditing(null); setShowForm(true); };
  const openEdit = (truck) => { setForm({ ...EMPTY, ...truck }); setEditing(truck); setShowForm(true); };

  const handleSave = () => {
    if (!form.name.trim()) { toast.error('Informe o nome/identificação do caminhão.'); return; }
    const data = {
      name: form.name.trim(),
      plate: (form.plate || '').trim(),
      active: form.active !== false,
    };
    if (editing) updateMutation.mutate({ id: editing.id, data });
    else createMutation.mutate(data);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-semibold">Logística / Caminhões</h3>
          <p className="text-sm text-muted-foreground">
            Caminhões globais da empresa. Não há vínculo entre caminhão e Box.
          </p>
        </div>
        <Button onClick={openNew} className="gap-1" size="sm">
          <Plus className="w-4 h-4" /> Novo caminhão
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-10 text-muted-foreground">Carregando...</div>
      ) : trucks.length === 0 ? (
        <Card className="p-8 text-center">
          <Truck className="w-10 h-10 mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-muted-foreground">Nenhum caminhão cadastrado ainda.</p>
          <Button onClick={openNew} variant="outline" className="mt-3 gap-1">
            <Plus className="w-4 h-4" /> Cadastrar primeiro caminhão
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {trucks.map(truck => (
            <Card key={truck.id} className={`p-4 space-y-2 ${!truck.active ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-muted-foreground shrink-0" />
                    <p className="font-semibold truncate">{truck.name}</p>
                    {!truck.active && <Badge variant="secondary" className="text-xs">Inativo</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Placa: {truck.plate || '—'}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(truck)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive"
                    onClick={() => deleteMutation.mutate(truck.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showForm && (
        <Dialog open onOpenChange={() => setShowForm(false)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editing ? 'Editar caminhão' : 'Novo caminhão'}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label>Nome / Identificação *</Label>
                <Input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: Caminhão 1 - João"
                />
              </div>
              <div>
                <Label>Placa</Label>
                <Input
                  value={form.plate}
                  onChange={e => setForm(f => ({ ...f, plate: e.target.value }))}
                  placeholder="ABC-1D23"
                />
              </div>
              <div className="flex items-center justify-between border rounded-lg px-3 py-2">
                <Label className="text-sm">Caminhão ativo</Label>
                <Switch checked={form.active} onCheckedChange={v => setForm(f => ({ ...f, active: v }))} />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
                {editing ? 'Salvar' : 'Cadastrar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}