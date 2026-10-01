import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Package, Plus, Minus, ShoppingCart } from 'lucide-react';
import { withLineIds } from '@/lib/orderLines';

// Calcula o preço efetivo do produto para o cliente com base no seu grupo de preços
function calcEffectivePrice(product, priceGroup, customPrices) {
  if (!priceGroup) return product.promo_active && product.promo_price ? product.promo_price : product.price;

  if (priceGroup.type === 'custom') {
    const cp = customPrices.find(c => c.product_id === product.id);
    if (cp && cp.custom_price != null) return cp.custom_price;
    return product.promo_active && product.promo_price ? product.promo_price : product.price;
  }

  // percentage
  const base = product.promo_active && product.promo_price ? product.promo_price : product.price;
  const discount = priceGroup.discount_percent || 0;
  return Math.max(0, base * (1 - discount / 100));
}

export default function AddOrderItemModal({ order, existingItems, onAdd, onClose }) {
  const [search, setSearch] = useState('');
  const [quantities, setQuantities] = useState({});

  // Determina o price_group_id do cliente
  const isWalkIn = !!order.walk_in_client_id;

  const { data: walkInClients = [] } = useQuery({
    queryKey: ['walk-in-clients'],
    queryFn: () => base44.entities.WalkInClient.list(),
    enabled: isWalkIn,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['admin-clients'],
    queryFn: () => base44.entities.User.list(),
    enabled: !isWalkIn,
  });

  const { data: priceGroups = [] } = useQuery({
    queryKey: ['price-groups'],
    queryFn: () => base44.entities.PriceGroup.list(),
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list(),
  });

  // Determina o PriceGroup do cliente
  const priceGroupId = useMemo(() => {
    if (isWalkIn) {
      const wc = walkInClients.find(c => c.id === order.walk_in_client_id);
      return wc?.price_group_id || null;
    }
    const u = users.find(u => u.email === order.customer_email);
    return u?.price_group_id || null;
  }, [isWalkIn, walkInClients, users, order]);

  const priceGroup = useMemo(() =>
    priceGroups.find(g => g.id === priceGroupId) || null,
    [priceGroups, priceGroupId]
  );

  const { data: customPrices = [] } = useQuery({
    queryKey: ['custom-prices', priceGroupId],
    queryFn: () => base44.entities.CustomPrice.filter({ price_group_id: priceGroupId }),
    enabled: !!priceGroupId && priceGroup?.type === 'custom',
  });

  const existingProductIds = new Set(existingItems.map(i => i.product_id));

  const filteredProducts = useMemo(() =>
    products
      .filter(p => p.active !== false)
      .filter(p => !existingProductIds.has(p.id))
      .filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [products, search, existingProductIds]
  );

  const setQty = (productId, value) => {
    const n = Math.max(0, parseInt(value) || 0);
    setQuantities(prev => ({ ...prev, [productId]: n }));
  };

  const selectedItems = filteredProducts
    .filter(p => quantities[p.id] > 0)
    .map(p => {
      const price = calcEffectivePrice(p, priceGroup, customPrices);
      return {
        product_id: p.id,
        product_name: p.name,
        packaging_type: p.packaging_type,
        weight: p.weight,
        unit_price: price,
        final_unit_price: price,
        quantity: quantities[p.id],
      };
    });

  const handleConfirm = () => {
    if (selectedItems.length === 0) return;
    onAdd(withLineIds(selectedItems));
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-primary" />
            Adicionar Itens ao Pedido
          </DialogTitle>
          {priceGroup && (
            <p className="text-xs text-muted-foreground">
              Tabela: <strong className="text-foreground">{priceGroup.name}</strong>
              {priceGroup.type === 'percentage' && priceGroup.discount_percent !== 0 && (
                <span className="ml-1 text-green-600">({priceGroup.discount_percent}% desconto)</span>
              )}
            </p>
          )}
          {!priceGroup && (
            <p className="text-xs text-amber-600">Cliente sem tabela de preços — preço base será usado.</p>
          )}
        </DialogHeader>

        <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar produto..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="overflow-y-auto flex-1 space-y-1.5 pr-1">
          {filteredProducts.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">Nenhum produto disponível.</p>
          ) : filteredProducts.map(product => {
            const qty = quantities[product.id] || 0;
            const price = calcEffectivePrice(product, priceGroup, customPrices);
            const hasCustom = price !== product.price;

            return (
              <div
                key={product.id}
                className={`flex items-center gap-3 p-2.5 rounded-xl border transition-colors ${qty > 0 ? 'border-primary/40 bg-primary/5' : 'border-border bg-card'}`}
              >
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {product.image_url
                    ? <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                    : <Package className="w-3.5 h-3.5 text-muted-foreground" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{product.name}</p>
                  <p className="text-xs text-muted-foreground">{product.packaging_type}{product.weight ? ` · ${product.weight}` : ''}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`text-sm font-semibold ${hasCustom ? 'text-primary' : ''}`}>R$ {price.toFixed(2)}</p>
                  {hasCustom && <p className="text-[10px] text-muted-foreground line-through">R$ {product.price.toFixed(2)}</p>}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    size="icon" variant="outline" className="h-7 w-7"
                    onClick={() => setQty(product.id, qty - 1)}
                    disabled={qty === 0}
                  >
                    <Minus className="w-3 h-3" />
                  </Button>
                  <Input
                    type="number" min="0"
                    value={qty || ''}
                    placeholder="0"
                    onChange={e => setQty(product.id, e.target.value)}
                    className="h-7 w-12 text-center text-sm px-1"
                  />
                  <Button
                    size="icon" variant="outline" className="h-7 w-7"
                    onClick={() => setQty(product.id, qty + 1)}
                  >
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {selectedItems.length > 0 && (
          <div className="border-t pt-3 mt-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{selectedItems.length} produto(s) selecionado(s)</span>
            {' — '}subtotal: <span className="font-bold text-primary">
              R$ {selectedItems.reduce((s, i) => s + i.unit_price * i.quantity, 0).toFixed(2)}
            </span>
          </div>
        )}

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={selectedItems.length === 0}>
            <Plus className="w-4 h-4 mr-1" />
            Adicionar {selectedItems.length > 0 ? `(${selectedItems.length})` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}