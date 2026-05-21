import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Trash2, Plus, Edit2 } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminSalespersons() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ name: '', whatsapp: '' });
  const queryClient = useQueryClient();

  const { data: salespersons = [], isLoading } = useQuery({
    queryKey: ['salespersons'],
    queryFn: () => base44.entities.Salesperson.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Salesperson.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salespersons'] });
      toast.success('Vendedor criado!');
      setFormData({ name: '', whatsapp: '' });
      setIsDialogOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Salesperson.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salespersons'] });
      toast.success('Vendedor atualizado!');
      setFormData({ name: '', whatsapp: '' });
      setEditingId(null);
      setIsDialogOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Salesperson.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salespersons'] });
      toast.success('Vendedor removido!');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (salesperson) => {
    setEditingId(salesperson.id);
    setFormData({ name: salesperson.name, whatsapp: salesperson.whatsapp || '' });
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingId(null);
    setFormData({ name: '', whatsapp: '' });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Vendedores</h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Novo Vendedor
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? 'Editar Vendedor' : 'Novo Vendedor'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nome *</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Celso"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">WhatsApp</label>
                <Input
                  value={formData.whatsapp}
                  onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                  placeholder="Ex: (65) 99999-9999"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingId ? 'Atualizar' : 'Criar'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
        </div>
      ) : salespersons.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Nenhum vendedor cadastrado ainda.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {salespersons.map((sp) => (
            <Card key={sp.id}>
              <CardHeader className="flex flex-row items-start justify-between pb-3">
                <div>
                  <CardTitle className="text-lg">{sp.name}</CardTitle>
                  {sp.whatsapp && <p className="text-sm text-muted-foreground mt-1">{sp.whatsapp}</p>}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(sp)}
                    className="gap-1"
                  >
                    <Edit2 className="w-4 h-4" />
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => deleteMutation.mutate(sp.id)}
                    className="text-destructive hover:text-destructive gap-1"
                  >
                    <Trash2 className="w-4 h-4" />
                    Remover
                  </Button>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}