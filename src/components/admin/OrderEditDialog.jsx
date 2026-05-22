import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pencil, Check, X, Trash2, ArrowLeftRight, PackagePlus, Minus, Plus, Gift, Tag } from 'lucide-react';
import AddOrderItemModal from './AddOrderItemModal';
import BonusItemModal from './BonusItemModal';

export default function OrderEditDialog({ order, onSave, onClose }) {
  const [items, setItems] = useState(
    (order.items || []).map(item => ({
      ...item,
      final_unit_price: item.final_unit_price ?? item.unit_price,
    }))
  );
  const [editingIndex, setEditingIndex] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [replacingIndex, setReplacingIndex] = useState(null);
  const [replaceSearch, setReplaceSearch] = useState('');
  const [showAddItems, setShowAddItems] = useState(false);
  const [showBonusModal, setShowBonusModal] = useState(false);
  const [discountType, setDiscountType] = useState(order.discount_type || 'percent');
  const [discountInput, setDiscountInput] = useState(
    order.discount_value != null && order.discount_value > 0 ? String(order.discount_value) : ''
  );

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list(),
  });

  const activeProducts = products.filter(p => p.active);

  const filteredReplace = replaceSearch.length > 1
    ? activeProducts.filter(p =>
        p.name.toLowerCase().includes(replaceSearch.toLowerCase()) &&
        !items.some((it, idx) => it.product_id === p.id && idx !== replacingIndex)
      )
    : [];

  // --- Price editing ---
  const startEdit = (idx) => {
    setEditingIndex(idx);
    setEditValue(String(items[idx].final_unit_price));
    setReplacingIndex(null);
    setReplaceSearch('');
  };

  const confirmEdit = (idx) => {
    const val = parseFloat(editValue);
    if (!isNaN(val) && val >= 0) {
      setItems(prev => prev.map((item, i) => i === idx ? { ...item, final_unit_price: val } : item));
    }
    setEditingIndex(null);
  };

  const cancelEdit = () => setEditingIndex(null);

  // --- Remove item ---
  const removeItem = (idx) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
    if (editingIndex === idx) setEditingIndex(null);
    if (replacingIndex === idx) { setReplacingIndex(null); setReplaceSearch(''); }
  };

  // --- Replace product ---
  const startReplace = (idx) => {
    setReplacingIndex(idx);
    setReplaceSearch('');
    setEditingIndex(null);
  };

  const cancelReplace = () => {
    setReplacingIndex(null);
    setReplaceSearch('');
  };

  const confirmReplace = (product) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== replacingIndex) return item;
      return {
        ...item,
        product_id: product.id,
        product_name: product.name,
        packaging_type: product.packaging_type,
        weight: product.weight,
        unit_price: product.price,
        final_unit_price: product.promo_active && product.promo_price ? product.promo_price : product.price,
      };
    }));
    setReplacingIndex(null);
    setReplaceSearch('');
  };

  // --- Totals --- (bonus items are excluded from total)
  const itemsSubtotal = items.reduce((sum, item) => item.is_bonus ? sum : sum + (item.final_unit_price * item.quantity), 0);
  const discountInputNum = parseFloat(discountInput) || 0;
  const discountAmount = discountInput && discountInputNum > 0
    ? (discountType === 'percent' ? itemsSubtotal * (discountInputNum / 100) : Math.min(discountInputNum, itemsSubtotal))
    : 0;
  const newTotal = Math.max(0, itemsSubtotal - discountAmount);
  const originalItems = order.items || [];
  const originalTotal = order.total ?? originalItems.reduce((sum, item) => sum + ((item.unit_price ?? 0) * item.quantity), 0);

  const changeQty = (idx, delta) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const newQty = Math.max(1, item.quantity + delta);
      return { ...item, quantity: newQty };
    }));
  };

  const setQtyDirect = (idx, value) => {
    const n = Math.max(1, parseInt(value) || 1);
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, quantity: n } : item));
  };

  const hasChanges = (() => {
    if (items.length !== originalItems.length) return true;
    const discountChanged = discountAmount !== (order.discount_amount ?? 0);
    if (discountChanged) return true;
    return items.some((item, i) => {
      const orig = originalItems[i];
      return !orig || item.quantity !== orig.quantity || item.final_unit_price !== (orig.final_unit_price ?? orig.unit_price) || item.product_id !== orig.product_id;
    });
  })();

  const handleSave = () => {
    onSave({
      items,
      subtotal: itemsSubtotal,
      discount_type: discountAmount > 0 ? discountType : null,
      discount_value: discountAmount > 0 ? discountInputNum : 0,
      discount_amount: discountAmount,
      total: newTotal,
    });
  };

  const handleAddItems = (newItems) => {
    setItems(prev => [...prev, ...newItems]);
  };

  const handleAddBonus = (bonusItems) => {
    setItems(prev => [...prev, ...bonusItems.map(it => ({ ...it, is_bonus: true, final_unit_price: 0, unit_price: 0 }))]);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between pr-8">
            <DialogTitle>Editar Pedido #{order.order_number} — {order.customer_name || order.customer_email}</DialogTitle>
            <div className="flex gap-1.5">
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => setShowAddItems(true)}>
                <PackagePlus className="w-3.5 h-3.5" />
                Adicionar Itens
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1 text-green-700 border-green-300 hover:bg-green-50" onClick={() => setShowBonusModal(true)}>
                <Gift className="w-3.5 h-3.5" />
                Bonificação
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-1">
          <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-3 gap-y-1 items-center text-xs font-semibold text-muted-foreground px-2 pb-1 border-b">
            <span>Produto</span>
            <span className="text-center">Qtd</span>
            <span className="text-right w-24">Preço orig.</span>
            <span className="text-right w-24">Preço final</span>
            <span className="w-20"></span>
          </div>

          {items.length === 0 && (
            <p className="text-center text-muted-foreground py-6 text-sm">Nenhum item no pedido.</p>
          )}

          {items.map((item, idx) => {
            const isEditing = editingIndex === idx;
            const isReplacing = replacingIndex === idx;
            const isBonus = !!item.is_bonus;
            const isModified = !isBonus && item.final_unit_price !== (originalItems[idx]?.unit_price ?? item.unit_price);
            const isProductChanged = item.product_id !== (originalItems[idx]?.product_id);
            const subtotal = isBonus ? 0 : item.final_unit_price * item.quantity;

            return (
              <div key={idx} className={`rounded-lg px-2 py-2 ${isBonus ? 'bg-green-50 border border-green-200' : isReplacing ? 'bg-blue-50 border border-blue-200' : isProductChanged ? 'bg-violet-50 border border-violet-200' : isModified ? 'bg-amber-50 border border-amber-200' : 'hover:bg-muted/50'}`}>
                {/* Replace search row */}
                {isReplacing ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-blue-700 font-medium">Substituindo: {item.product_name}</span>
                      <Button size="icon" variant="ghost" className="h-6 w-6 ml-auto text-muted-foreground" onClick={cancelReplace}>
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    <div className="relative">
                      <Input
                        autoFocus
                        placeholder="Buscar produto substituto..."
                        value={replaceSearch}
                        onChange={e => setReplaceSearch(e.target.value)}
                        className="h-8 text-sm"
                      />
                      {filteredReplace.length > 0 && (
                        <div className="absolute z-50 top-full left-0 right-0 border rounded-md mt-1 max-h-44 overflow-y-auto bg-background shadow-lg">
                          {filteredReplace.map(p => (
                            <div key={p.id}
                              className="px-3 py-2 hover:bg-muted cursor-pointer border-b last:border-b-0 flex justify-between items-center"
                              onClick={() => confirmReplace(p)}>
                              <div>
                                <p className="text-sm font-medium">{p.name}</p>
                                <p className="text-xs text-muted-foreground">{p.packaging_type}{p.weight ? ` • ${p.weight}` : ''}</p>
                              </div>
                              <span className="text-sm font-semibold">R$ {(p.promo_active && p.promo_price ? p.promo_price : p.price).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-3 items-center">
                    <div>
                      <p className="text-sm font-medium leading-tight">
                        {item.product_name}
                        {isBonus && <span className="ml-1.5 text-[10px] bg-green-100 text-green-700 rounded px-1 py-0.5 font-bold">🎁 Bonificação</span>}
                        {isProductChanged && <span className="ml-1.5 text-[10px] bg-violet-100 text-violet-700 rounded px-1 py-0.5">Substituído</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">{item.packaging_type}{item.weight ? ` • ${item.weight}` : ''}</p>
                    </div>

                    <div className="flex items-center gap-0.5 w-auto">
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => changeQty(idx, -1)} disabled={item.quantity <= 1}>
                        <Minus className="w-3 h-3" />
                      </Button>
                      <Input
                        type="number" min="1"
                        value={item.quantity}
                        onChange={e => setQtyDirect(idx, e.target.value)}
                        className="h-6 w-10 text-center text-xs px-1"
                      />
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => changeQty(idx, 1)}>
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>

                    <span className="text-sm text-right w-24 text-muted-foreground">
                      R$ {item.unit_price?.toFixed(2)}
                    </span>

                    <div className="w-24 text-right">
                      {isBonus ? (
                        <span className="text-sm font-semibold text-green-700">GRÁTIS</span>
                      ) : isEditing ? (
                        <Input
                          type="number" min="0" step="0.01"
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          className="h-7 text-sm text-right w-24 px-2"
                          autoFocus
                          onKeyDown={e => {
                            if (e.key === 'Enter') confirmEdit(idx);
                            if (e.key === 'Escape') cancelEdit();
                          }}
                        />
                      ) : (
                        <span className={`text-sm font-semibold ${isModified ? 'text-amber-700' : ''}`}>
                          R$ {item.final_unit_price?.toFixed(2)}
                        </span>
                      )}
                      <p className="text-[11px] text-muted-foreground">= R$ {subtotal.toFixed(2)}</p>
                    </div>

                    <div className="flex gap-0.5 w-20 justify-end">
                      {isBonus ? (
                        <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:text-destructive" title="Remover bonificação" onClick={() => removeItem(idx)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      ) : isEditing ? (
                        <>
                          <Button size="icon" variant="ghost" className="h-6 w-6 text-green-600" onClick={() => confirmEdit(idx)}>
                            <Check className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6 text-red-500" onClick={cancelEdit}>
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-foreground" title="Editar preço" onClick={() => startEdit(idx)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6 text-blue-500 hover:text-blue-700" title="Substituir produto" onClick={() => startReplace(idx)}>
                            <ArrowLeftRight className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:text-destructive" title="Remover item" onClick={() => removeItem(idx)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Discount section */}
        <div className="mt-3 pt-3 border-t">
          <div className="flex items-center gap-2 mb-2">
            <Tag className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold">Desconto no pedido</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-md border overflow-hidden shrink-0">
              <button
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${discountType === 'percent' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}
                onClick={() => setDiscountType('percent')}
              >% Porcentagem</button>
              <button
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${discountType === 'value' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}
                onClick={() => setDiscountType('value')}
              >R$ Valor fixo</button>
            </div>
            <div className="relative flex-1 max-w-[140px]">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                {discountType === 'percent' ? '%' : 'R$'}
              </span>
              <Input
                type="number" min="0" step="0.01"
                value={discountInput}
                onChange={e => setDiscountInput(e.target.value)}
                className="pl-7 h-8 text-sm"
                placeholder="0"
              />
            </div>
            {discountInput && parseFloat(discountInput) > 0 && (
              <button onClick={() => setDiscountInput('')} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            )}
            {discountAmount > 0 && (
              <span className="text-sm font-semibold text-green-700">
                − R$ {discountAmount.toFixed(2)}
              </span>
            )}
          </div>
        </div>

        {/* Totals summary */}
        <div className="mt-3 pt-3 border-t space-y-1 text-sm">
          {discountAmount > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal dos itens:</span>
              <span>R$ {itemsSubtotal.toFixed(2)}</span>
            </div>
          )}
          {discountAmount > 0 && (
            <div className="flex justify-between text-green-700 font-medium">
              <span>Desconto ({discountType === 'percent' ? `${discountInputNum}%` : 'valor fixo'}):</span>
              <span>− R$ {discountAmount.toFixed(2)}</span>
            </div>
          )}
          {hasChanges && !discountAmount && (
            <div className="flex justify-between text-muted-foreground">
              <span>Total original:</span>
              <span className="line-through">R$ {originalTotal.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-base">
            <span>Total do pedido:</span>
            <span className={hasChanges ? (discountAmount > 0 ? 'text-green-700' : 'text-amber-700') : ''}>R$ {newTotal.toFixed(2)}</span>
          </div>
          {hasChanges && !discountAmount && (
            <div className="flex justify-between text-xs text-amber-600">
              <span>Diferença:</span>
              <span>{newTotal < originalTotal ? '-' : '+'}R$ {Math.abs(newTotal - originalTotal).toFixed(2)}</span>
            </div>
          )}
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!hasChanges}>
            Salvar alterações
          </Button>
        </DialogFooter>
      </DialogContent>

      {showAddItems && (
        <AddOrderItemModal
          order={order}
          existingItems={items}
          onAdd={handleAddItems}
          onClose={() => setShowAddItems(false)}
        />
      )}

      {showBonusModal && (
        <BonusItemModal
          onAdd={handleAddBonus}
          onClose={() => setShowBonusModal(false)}
        />
      )}
    </Dialog>
  );
}