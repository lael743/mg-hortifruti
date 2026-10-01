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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2, Pencil, Package, Truck } from 'lucide-react';
import CeasaTrucksManager from '@/components/admin/CeasaTrucksManager';
import BoxDeleteDialog from '@/components/admin/BoxDeleteDialog';

const EMPTY = { name: '', cnpj: '', active: true };

export default function AdminCeasaBoxes() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [tab, setTab] = useState('boxes');
  const [deleting, setDeleting] = useState(null);

  const { data: boxes = [], isLoading } = useQuery({
    queryKey: ['ceasa-boxes'],
    queryFn: () => base44.entities.CeasaBox.list('-created_date', 200),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.CeasaBox.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['ceasa-boxes'] }); toast.success('Box criado!'); setShowForm(false); },
    onError: () => toast.error('Erro ao criar Box.'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.CeasaBox.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['ceasa-boxes'] }); toast.success('Box atualizado!'); setShowForm(false); },
    onError: () => toast.error('Erro ao atualizar Box.'),
  });

  const openNew = () => { setForm(EMPTY); setEditing(null); setShowForm(true); };
  // Somente os campos do catálogo. O legado product_ids não é lido nem reenviado.
  const openEdit = (box) => { setForm({ name: box.name || '', cnpj: box.cnpj || '', active: box.active !== false }); setEditing(box); setShowForm(true); };

  const handleSave = () => {
    if (!form.name.trim()) { toast.error('Informe o nome do Box.'); return; }
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold">Cadastro do Ceasa</h2>
          <p className="text-sm text-muted-foreground">Configure os Boxes e a logística (caminhões) usados na Gestão Ceasa.</p>
        </div>
        {tab === 'boxes' && (
          <Button onClick={openNew} className="gap-1">
            <Plus className="w-4 h-4" /> Novo Box
          </Button>
        )}
      </div>

      <TabsList>
        <TabsTrigger value="boxes" className="gap-1">
          <Package className="w-3.5 h-3.5" /> Boxes
        </TabsTrigger>
        <TabsTrigger value="trucks" className="gap-1">
          <Truck className="w-3.5 h-3.5" /> Logística / Caminhões
        </TabsTrigger>
      </TabsList>

      <TabsContent value="boxes" className="space-y-4">

      {isLoading ? (
        <div className="text-center py-10 text-muted-foreground">Carregando...</div>
      ) : boxes.length === 0 ? (
        <Card className="p-8 text-center">
          <Package className="w-10 h-10 mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-muted-foreground">Nenhum Box cadastrado ainda.</p>
          <Button onClick={openNew} variant="outline" className="mt-3 gap-1">
            <Plus className="w-4 h-4" /> Criar primeiro Box
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {boxes.map(box => (
            <Card key={box.id} className={`p-4 space-y-2 ${!box.active ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold truncate">{box.name}</p>
                    {!box.active && <Badge variant="secondary" className="text-xs">Inativo</Badge>}
                  </div>
                  {box.cnpj && <p className="text-xs text-muted-foreground">CNPJ: {box.cnpj}</p>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(box)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeleting(box)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      </TabsContent>

      <TabsContent value="trucks">
        <CeasaTrucksManager />
      </TabsContent>
      </Tabs>

      {deleting && (
        <BoxDeleteDialog box={deleting} onClose={() => setDeleting(null)} onDone={() => setDeleting(null)} />
      )}

      {/* Formulário */}
      {showForm && (
        <Dialog open onOpenChange={() => setShowForm(false)}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? 'Editar Box' : 'Novo Box Ceasa'}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Nome do Box *</Label>
                  <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Box 03 Irmãos" />
                </div>
                <div>
                  <Label>CNPJ</Label>
                  <Input value={form.cnpj} onChange={e => setForm(f => ({ ...f, cnpj: e.target.value }))} placeholder="00.000.000/0001-00" />
                </div>
              </div>

              <div className="flex items-center justify-between border rounded-lg px-3 py-2">
                <Label className="text-sm">Box ativo</Label>
                <Switch checked={form.active} onCheckedChange={v => setForm(f => ({ ...f, active: v }))} />
              </div>

            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
                {editing ? 'Salvar' : 'Criar Box'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}