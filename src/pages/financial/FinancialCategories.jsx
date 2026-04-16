import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import { toast } from 'sonner';

const COLORS = ['#22c55e','#ef4444','#3b82f6','#f59e0b','#8b5cf6','#ec4899','#06b6d4','#f97316'];

export default function FinancialCategories() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(null);
  const [newForm, setNewForm] = useState({ name: '', type: 'despesa', color: COLORS[0] });
  const [showNew, setShowNew] = useState(false);

  const { data: categories = [] } = useQuery({
    queryKey: ['financial-categories'],
    queryFn: () => base44.entities.FinancialCategory.list('name'),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.FinancialCategory.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['financial-categories'] }); setShowNew(false); setNewForm({ name: '', type: 'despesa', color: COLORS[0] }); toast.success('Categoria criada!'); },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.FinancialCategory.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['financial-categories'] }); setEditing(null); toast.success('Categoria atualizada!'); },
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.FinancialCategory.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['financial-categories'] }); toast.success('Categoria excluída.'); },
  });

  const receitas = categories.filter(c => c.type === 'receita');
  const despesas = categories.filter(c => c.type === 'despesa');

  const CategoryRow = ({ cat }) => {
    const isEdit = editing?.id === cat.id;
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg border">
        {isEdit ? (
          <>
            <input type="color" value={editing.color || '#22c55e'} onChange={e => setEditing(p => ({ ...p, color: e.target.value }))} className="w-8 h-8 rounded cursor-pointer border-0" />
            <Input className="flex-1 h-8" value={editing.name} onChange={e => setEditing(p => ({ ...p, name: e.target.value }))} />
            <Button size="icon" className="h-8 w-8" onClick={() => updateMutation.mutate({ id: cat.id, data: { name: editing.name, color: editing.color, type: editing.type } })}>
              <Check className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditing(null)}>
              <X className="w-4 h-4" />
            </Button>
          </>
        ) : (
          <>
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color || '#94a3b8' }} />
            <span className="flex-1 text-sm font-medium">{cat.name}</span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditing({ ...cat })}>
              <Pencil className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteMutation.mutate(cat.id)}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Categorias</h1>
        <Button onClick={() => setShowNew(true)} className="gap-2">
          <Plus className="w-4 h-4" />Nova categoria
        </Button>
      </div>

      {showNew && (
        <Card className="p-4 border-primary/30 bg-primary/5">
          <h3 className="font-semibold text-sm mb-3">Nova Categoria</h3>
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Cor</label>
              <div className="flex gap-1.5 flex-wrap">
                {COLORS.map(c => (
                  <button key={c} type="button" onClick={() => setNewForm(p => ({ ...p, color: c }))}
                    className={`w-6 h-6 rounded-full border-2 transition-all ${newForm.color === c ? 'border-foreground scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
            <div className="flex-1 min-w-[140px]">
              <label className="text-xs text-muted-foreground block mb-1">Nome</label>
              <Input placeholder="Nome da categoria" value={newForm.name} onChange={e => setNewForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Tipo</label>
              <select value={newForm.type} onChange={e => setNewForm(p => ({ ...p, type: e.target.value }))} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none">
                <option value="despesa">Despesa</option>
                <option value="receita">Receita</option>
              </select>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => createMutation.mutate(newForm)} disabled={!newForm.name}>Salvar</Button>
              <Button size="sm" variant="outline" onClick={() => setShowNew(false)}>Cancelar</Button>
            </div>
          </div>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-4">
          <h2 className="font-semibold text-sm text-green-700 mb-3 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />Receitas ({receitas.length})
          </h2>
          <div className="space-y-2">
            {receitas.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma categoria de receita.</p>}
            {receitas.map(c => <CategoryRow key={c.id} cat={c} />)}
          </div>
        </Card>
        <Card className="p-4">
          <h2 className="font-semibold text-sm text-red-600 mb-3 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500" />Despesas ({despesas.length})
          </h2>
          <div className="space-y-2">
            {despesas.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma categoria de despesa.</p>}
            {despesas.map(c => <CategoryRow key={c.id} cat={c} />)}
          </div>
        </Card>
      </div>
    </div>
  );
}