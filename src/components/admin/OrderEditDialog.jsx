import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pencil, Check, X } from 'lucide-react';

export default function OrderEditDialog({ order, onSave, onClose }) {
  const [items, setItems] = useState(
    (order.items || []).map(item => ({
      ...item,
      // final_unit_price: preço final efetivo (editado pelo admin); fallback para unit_price
      final_unit_price: item.final_unit_price ?? item.unit_price,
    }))
  );
  const [editingIndex, setEditingIndex] = useState(null);
  const [editValue, setEditValue] = useState('');

  const startEdit = (idx) => {
    setEditingIndex(idx);
    setEditValue(String(items[idx].final_unit_price));
  };

  const confirmEdit = (idx) => {
    const val = parseFloat(editValue);
    if (!isNaN(val) && val >= 0) {
      setItems(prev => prev.map((item, i) => i === idx ? { ...item, final_unit_price: val } : item));
    }
    setEditingIndex(null);
  };

  const cancelEdit = () => setEditingIndex(null);

  const newTotal = items.reduce((sum, item) => sum + (item.final_unit_price * item.quantity), 0);
  const originalTotal = items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
  const hasChanges = items.some(item => item.final_unit_price !== item.unit_price);

  const handleSave = () => {
    onSave({
      items: items,
      total: newTotal,
    });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Pedido #{order.order_number} — {order.customer_name || order.customer_email}</DialogTitle>
        </DialogHeader>

        <div className="space-y-1">
          <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-3 gap-y-1 items-center text-xs font-semibold text-muted-foreground px-2 pb-1 border-b">
            <span>Produto</span>
            <span className="text-right w-10">Qtd</span>
            <span className="text-right w-24">Preço orig.</span>
            <span className="text-right w-24">Preço final</span>
            <span className="w-16"></span>
          </div>

          {items.map((item, idx) => {
            const isEditing = editingIndex === idx;
            const isModified = item.final_unit_price !== item.unit_price;
            const subtotal = item.final_unit_price * item.quantity;

            return (
              <div key={idx} className={`grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-3 gap-y-0 items-center px-2 py-2 rounded-lg ${isModified ? 'bg-amber-50 border border-amber-200' : 'hover:bg-muted/50'}`}>
                <div>
                  <p className="text-sm font-medium leading-tight">{item.product_name}</p>
                  <p className="text-xs text-muted-foreground">{item.packaging_type}{item.weight ? ` • ${item.weight}` : ''}</p>
                </div>

                <span className="text-sm text-right w-10 font-medium">{item.quantity}</span>

                <span className="text-sm text-right w-24 text-muted-foreground">
                  R$ {item.unit_price?.toFixed(2)}
                </span>

                <div className="w-24 text-right">
                  {isEditing ? (
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
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

                <div className="flex gap-1 w-16 justify-end">
                  {isEditing ? (
                    <>
                      <Button size="icon" variant="ghost" className="h-6 w-6 text-green-600" onClick={() => confirmEdit(idx)}>
                        <Check className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6 text-red-500" onClick={cancelEdit}>
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </>
                  ) : (
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={() => startEdit(idx)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Totals summary */}
        <div className="mt-2 pt-3 border-t space-y-1 text-sm">
          {hasChanges && (
            <div className="flex justify-between text-muted-foreground">
              <span>Total original:</span>
              <span className="line-through">R$ {originalTotal.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-base">
            <span>Total do pedido:</span>
            <span className={hasChanges ? 'text-amber-700' : ''}>R$ {newTotal.toFixed(2)}</span>
          </div>
          {hasChanges && (
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
    </Dialog>
  );
}