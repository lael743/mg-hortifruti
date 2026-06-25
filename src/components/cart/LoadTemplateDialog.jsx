import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { saveCart } from '@/lib/cartStore';
import { Bookmark, Trash2, Package, AlertTriangle } from 'lucide-react';

export default function LoadTemplateDialog({ user, onClose, onLoaded }) {
  const queryClient = useQueryClient();
  const [confirmId, setConfirmId] = useState(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['order-templates', user.email],
    queryFn: () => base44.entities.OrderTemplate.filter({ user_email: user.email }, '-updated_date'),
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list(),
  });

  const { data: priceGroups = [] } = useQuery({
    queryKey: ['price-groups'],
    queryFn: () => base44.entities.PriceGroup.list(),
    enabled: !!user,
  });
  const userPriceGroup = user?.price_group_id
    ? priceGroups.find(g => g.id === user.price_group_id)
    : null;

  const { data: customPrices = [] } = useQuery({
    queryKey: ['custom-prices-template', userPriceGroup?.id],
    queryFn: () => base44.entities.CustomPrice.filter({ price_group_id: userPriceGroup.id }),
    enabled: !!userPriceGroup && userPriceGroup.type === 'custom',
  });
  const customPriceMap = userPriceGroup?.type === 'custom'
    ? Object.fromEntries(customPrices.map(cp => [cp.product_id, cp.custom_price]))
    : {};

  const getEffectivePrice = (product) => {
    const basePrice = product.promo_active && product.promo_price ? product.promo_price : product.price;
    if (!userPriceGroup) return basePrice;
    if (userPriceGroup.type === 'percentage') {
      return basePrice * (1 - (userPriceGroup.discount_percent || 0) / 100);
    }
    if (userPriceGroup.type === 'custom') {
      return customPriceMap[product.id] != null ? customPriceMap[product.id] : basePrice;
    }
    return basePrice;
  };

  const handleLoad = (template) => {
    const missing = [];
    const cartItems = [];

    template.items.forEach(item => {
      const product = products.find(p => p.id === item.product_id);
      if (!product || product.active === false) {
        missing.push(item.product_name);
        return;
      }
      const unit_price = getEffectivePrice(product);
      cartItems.push({
        product_id: product.id,
        product_name: product.name,
        unit_price,
        quantity: item.quantity,
        packaging_type: product.packaging_type,
        weight: product.weight,
        image_url: product.image_url,
      });
    });

    saveCart(cartItems);
    if (missing.length > 0) {
      toast.warning(`Modelo carregado. ${missing.length} produto(s) não disponível(is): ${missing.join(', ')}`);
    } else {
      toast.success('Modelo carregado no carrinho!');
    }
    queryClient.invalidateQueries({ queryKey: ['cart'] });
    onLoaded();
  };

  const handleDelete = async (template) => {
    try {
      await base44.entities.OrderTemplate.delete(template.id);
      toast.success('Modelo excluído.');
      queryClient.invalidateQueries({ queryKey: ['order-templates', user.email] });
    } catch (err) {
      toast.error('Erro ao excluir: ' + err.message);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bookmark className="w-5 h-5 text-primary" />
            Modelos de Pedido
          </DialogTitle>
          <DialogDescription>
            Carregue um modelo para preencher o carrinho com preços atualizados.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 pt-2">
          {isLoading ? (
            <p className="text-center text-sm text-muted-foreground py-8">Carregando modelos...</p>
          ) : templates.length === 0 ? (
            <div className="text-center py-8">
              <Package className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Você ainda não tem modelos salvos.</p>
            </div>
          ) : (
            templates.map(t => (
              <div key={t.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.items?.length || 0} item(ns)</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive shrink-0" onClick={() => handleDelete(t)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {t.items?.slice(0, 4).map((item, i) => (
                    <span key={i} className="text-[10px] bg-muted rounded px-1.5 py-0.5 truncate max-w-[120px]">
                      {item.quantity}x {item.product_name}
                    </span>
                  ))}
                  {t.items?.length > 4 && (
                    <span className="text-[10px] text-muted-foreground">+{t.items.length - 4}</span>
                  )}
                </div>
                {confirmId === t.id ? (
                  <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span className="text-xs text-amber-700 flex-1">Substituir itens do carrinho atual?</span>
                    <Button size="sm" className="h-6 text-xs" onClick={() => { handleLoad(t); setConfirmId(null); }}>Sim</Button>
                    <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setConfirmId(null)}>Não</Button>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" className="w-full" onClick={() => setConfirmId(t.id)}>
                    Carregar Modelo
                  </Button>
                )}
              </div>
            ))
          )}
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}