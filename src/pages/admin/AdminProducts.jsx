import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Pencil, Trash2, Search, Package, Eye, EyeOff, Check, X, ArrowUpAZ, ArrowDownAZ } from 'lucide-react';
import ProductFormDialog from '../../components/admin/ProductFormDialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

export default function AdminProducts() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [editProduct, setEditProduct] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  // inline price edit state: { id, value }
  const [priceEdit, setPriceEdit] = useState(null);
  const [sortAZ, setSortAZ] = useState(true); // true = A-Z, false = Z-A, null = default

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['admin-products'],
    queryFn: () => base44.entities.Product.list(),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Product.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Product.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      toast.success('Produto excluído');
      setDeleteTarget(null);
    },
  });

  const toggleActive = (product) => {
    updateMutation.mutate(
      { id: product.id, data: { active: !product.active } },
      { onSuccess: () => toast.success(product.active ? 'Produto inativado' : 'Produto ativado') }
    );
  };

  const startPriceEdit = (product) => {
    setPriceEdit({ id: product.id, value: String(product.price ?? '') });
  };

  const confirmPriceEdit = (product) => {
    const parsed = parseFloat(priceEdit.value.replace(',', '.'));
    if (isNaN(parsed) || parsed < 0) { toast.error('Valor inválido'); return; }
    updateMutation.mutate(
      { id: product.id, data: { price: parsed } },
      { onSuccess: () => { toast.success('Preço atualizado'); setPriceEdit(null); } }
    );
  };

  const filtered = products
    .filter(p => !search || p.name?.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortAZ === null) return a.name?.localeCompare(b.name, 'pt-BR');
      return sortAZ ? a.name?.localeCompare(b.name) : b.name?.localeCompare(a.name);
    });

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar produto..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Button
          variant="outline"
          size="icon"
          title={sortAZ === null ? 'Ordenar A-Z' : sortAZ ? 'Ordenar Z-A' : 'Remover ordenação'}
          onClick={() => setSortAZ(prev => prev === null ? true : prev === true ? false : null)}
        >
          {sortAZ === false ? <ArrowDownAZ className="w-4 h-4" /> : <ArrowUpAZ className="w-4 h-4" />}
        </Button>
        <Button className="bg-primary text-primary-foreground" onClick={() => { setEditProduct(null); setShowForm(true); }}>
          <Plus className="w-4 h-4 mr-1" />Novo Produto
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">Nenhum produto encontrado.</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(product => {
            const isEditingPrice = priceEdit?.id === product.id;
            return (
              <Card key={product.id} className={`p-4 transition-opacity ${!product.active ? 'opacity-60' : ''}`}>
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><Package className="w-5 h-5 text-muted-foreground/30" /></div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-sm truncate">{product.name}</h3>
                      {!product.active && <Badge variant="secondary" className="text-[10px]">Inativo</Badge>}
                      {product.promo_active && <Badge className="bg-accent text-accent-foreground text-[10px]">Promo</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">{product.category} • {product.packaging_type}{product.weight && ` • ${product.weight}`}</p>

                    {/* Inline price editor */}
                    <div className="flex items-center gap-1 mt-1">
                      {isEditingPrice ? (
                        <>
                          <span className="text-sm font-bold text-primary">R$</span>
                          <Input
                            autoFocus
                            className="h-6 w-24 text-sm px-1 py-0"
                            value={priceEdit.value}
                            onChange={(e) => setPriceEdit(p => ({ ...p, value: e.target.value }))}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') confirmPriceEdit(product);
                              if (e.key === 'Escape') setPriceEdit(null);
                            }}
                          />
                          <button onClick={() => confirmPriceEdit(product)} className="text-green-600 hover:text-green-700 p-0.5">
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setPriceEdit(null)} className="text-muted-foreground hover:text-foreground p-0.5">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => startPriceEdit(product)}
                          className="font-bold text-sm text-primary hover:underline hover:text-primary/80 cursor-pointer"
                          title="Clique para editar o preço"
                        >
                          R$ {product.price?.toFixed(2)}
                        </button>
                      )}
                      {product.promo_active && product.promo_price && (
                        <span className="text-xs text-accent font-semibold ml-1">Promo: R$ {product.promo_price.toFixed(2)}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-1 items-center flex-shrink-0">
                    {/* Toggle active/inactive */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`h-8 w-8 ${product.active ? 'text-green-600 hover:bg-green-50' : 'text-muted-foreground hover:bg-muted'}`}
                      title={product.active ? 'Inativar produto' : 'Ativar produto'}
                      onClick={() => toggleActive(product)}
                    >
                      {product.active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditProduct(product); setShowForm(true); }}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteTarget(product)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {showForm && (
        <ProductFormDialog
          product={editProduct}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            queryClient.invalidateQueries({ queryKey: ['admin-products'] });
          }}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir produto?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita. O produto "{deleteTarget?.name}" será excluído permanentemente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => deleteMutation.mutate(deleteTarget.id)}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}