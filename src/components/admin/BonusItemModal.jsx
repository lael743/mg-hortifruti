import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Minus, Plus, Gift } from 'lucide-react';

export default function BonusItemModal({ onAdd, onClose }) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState({}); // { product_id: quantity }

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list(),
  });

  const activeProducts = products.filter(p => p.active);

  const filtered = search.length > 0
    ? activeProducts.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    : activeProducts;

  const setQty = (productId, delta) => {
    setSelected(prev => {
      const current = prev[productId] || 0;
      const next = Math.max(0, current + delta);
      if (next === 0) {
        const { [productId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [productId]: next };
    });
  };

  const setQtyDirect = (productId, value) => {
    const n = Math.max(0, parseInt(value) || 0);
    if (n === 0) {
      setSelected(prev => { const { [productId]: _, ...rest } = prev; return rest; });
    } else {
      setSelected(prev => ({ ...prev, [productId]: n }));
    }
  };

  const selectedCount = Object.values(selected).reduce((s, q) => s + q, 0);

  const handleConfirm = () => {
    const bonusItems = Object.entries(selected)
      .filter(([, qty]) => qty > 0)
      .map(([productId, quantity]) => {
        const p = activeProducts.find(x => x.id === productId);
        return {
          product_id: productId,
          product_name: p?.name || '',
          packaging_type: p?.packaging_type || '',
          weight: p?.weight || '',
          quantity,
        };
      });
    if (bonusItems.length > 0) {
      onAdd(bonusItems);
    }
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-green-700">
            <Gift className="w-5 h-5" />
            Adicionar Bonificação
          </DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground -mt-2">
          Itens bonificados são adicionados sem custo e não somam no total do pedido.
        </p>

        <Input
          placeholder="Buscar produto..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-9"
        />

        <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
          {filtered.map(p => {
            const qty = selected[p.id] || 0;
            return (
              <div key={p.id} className={`flex items-center justify-between rounded-lg px-3 py-2 border transition-colors ${qty > 0 ? 'bg-green-50 border-green-200' : 'hover:bg-muted/50 border-transparent'}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-tight truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.packaging_type}{p.weight ? ` • ${p.weight}` : ''}</p>
                </div>
                <div className="flex items-center gap-0.5 ml-3 shrink-0">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setQty(p.id, -1)} disabled={qty === 0}>
                    <Minus className="w-3 h-3" />
                  </Button>
                  <Input
                    type="number" min="0"
                    value={qty || ''}
                    placeholder="0"
                    onChange={e => setQtyDirect(p.id, e.target.value)}
                    className="h-7 w-12 text-center text-xs px-1"
                  />
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setQty(p.id, 1)}>
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={handleConfirm}
            disabled={selectedCount === 0}
            className="bg-green-700 hover:bg-green-800 text-white gap-1"
          >
            <Gift className="w-4 h-4" />
            Adicionar {selectedCount > 0 ? `${selectedCount} vol.` : 'bonificação'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}