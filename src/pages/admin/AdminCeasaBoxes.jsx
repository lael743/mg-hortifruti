import React, { useState, useMemo } from 'react';
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
import { Plus, Trash2, Pencil, Package, X, Search } from 'lucide-react';

const EMPTY = { name: '', cnpj: '', product_ids: [], active: true };

export default function AdminCeasaBoxes() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [productSearch, setProductSearch] = useState('');

  const { data: boxes = [], isLoading } = useQuery({
    queryKey: ['ceasa-boxes'],
    queryFn: () => base44.entities.CeasaBox.list('-created_date', 200),
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list(),
  });

  const activeProducts = products.filter(p => p.active);

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

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.CeasaBox.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['ceasa-boxes'] }); toast.success('Box excluído.'); },
    onError: () => toast.error('Erro ao excluir Box.'),
  });

  const openNew = () => { setForm(EMPTY); setEditing(null); setShowForm(true); setProductSearch(''); };
  const openEdit = (box) => { setForm({ ...EMPTY, ...box }); setEditing(box); setShowForm(true); setProductSearch(''); };

  const handleSave = () => {
    if (!form.name.trim()) { toast.error('Informe o nome do Box.'); return; }
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const toggleProduct = (pid) => {
    setForm(f => {
      if (f.product_ids.includes(pid)) {
        return { ...f, product_ids: f.product_ids.filter(p => p !== pid) };
      }
      // Bloqueia associação duplicada: produto já vinculado a outro Box
      if (otherBoxOwner[pid]) {
        toast.error(`"${getProductName(pid)}" já está associado ao ${otherBoxOwner[pid]}.`);
        return f;
      }
      return { ...f, product_ids: [...f.product_ids, pid] };
    });
  };

  // Mapa produto -> nome do Box que já o possui (ignora o próprio box em edição)
  const otherBoxOwner = useMemo(() => {
    const map = {};
    boxes.forEach(b => {
      if (editing && b.id === editing.id) return;
      (b.product_ids || []).forEach(pid => { map[pid] = b.name; });
    });
    return map;
  }, [boxes, editing]);

  const norm = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const filteredProducts = activeProducts
    .filter(p => productSearch.length === 0 || norm(p.name).includes(norm(productSearch)))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));

  const getProductName = (pid) => products.find(p => p.id === pid)?.name || '—';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold">Boxes do Ceasa</h2>
          <p className="text-sm text-muted-foreground">Cadastre os Boxes e associe os produtos que cada um fornece.</p>
        </div>
        <Button onClick={openNew} className="gap-1">
          <Plus className="w-4 h-4" /> Novo Box
        </Button>
      </div>

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
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(box.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  Produtos ({(box.product_ids || []).length})
                </p>
                {(box.product_ids || []).length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {(box.product_ids || []).slice(0, 8).map(pid => (
                      <Badge key={pid} variant="outline" className="text-[10px] font-normal">
                        {getProductName(pid)}
                      </Badge>
                    ))}
                    {(box.product_ids || []).length > 8 && (
                      <Badge variant="outline" className="text-[10px] font-normal">
                        +{(box.product_ids || []).length - 8}
                      </Badge>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">Nenhum produto associado</p>
                )}
              </div>
            </Card>
          ))}
        </div>
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

              {/* Associação de produtos */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Produtos fornecidos por este Box</Label>
                  <Badge variant="secondary" className="text-xs">{(form.product_ids || []).length} selecionados</Badge>
                </div>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={productSearch}
                    onChange={e => setProductSearch(e.target.value)}
                    placeholder="Filtrar produtos..."
                    className="pl-8"
                  />
                </div>
                <div className="border rounded-lg max-h-56 overflow-y-auto divide-y">
                  {filteredProducts.map(p => {
                    const checked = (form.product_ids || []).includes(p.id);
                    const ownedBy = otherBoxOwner[p.id];
                    const blocked = !checked && !!ownedBy;
                    return (
                      <label
                        key={p.id}
                        className={`flex items-center gap-2 px-3 py-2 ${blocked ? 'opacity-60 cursor-not-allowed' : 'hover:bg-muted/50 cursor-pointer'}`}
                        onClick={blocked ? (e) => { e.preventDefault(); toggleProduct(p.id); } : undefined}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={blocked}
                          onChange={() => toggleProduct(p.id)}
                          className="w-4 h-4 accent-primary"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{p.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {p.category} • {p.packaging_type}
                            {ownedBy && <span className="text-amber-600 font-medium"> • já em {ownedBy}</span>}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                  {filteredProducts.length === 0 && (
                    <p className="text-center text-xs text-muted-foreground py-4">Nenhum produto encontrado.</p>
                  )}
                </div>
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