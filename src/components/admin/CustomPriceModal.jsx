import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Search, Package, Save, Tag } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Definição dos preços por produto de uma tabela (PriceGroup tipo "custom").
 * Cada linha representa a relação PriceGroup + Product: preço + flag de promoção.
 */
export default function CustomPriceModal({ priceGroup, onClose }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [prices, setPrices] = useState({});
  const [saving, setSaving] = useState(false);

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list(),
  });

  const { data: existingPrices = [], isLoading } = useQuery({
    queryKey: ['custom-prices', priceGroup.id],
    queryFn: () => base44.entities.CustomPrice.filter({ price_group_id: priceGroup.id }),
  });

  // initialize prices from existing when loaded (runs even when array is empty to reset state)
  useEffect(() => {
    if (isLoading) return;
    const map = {};
    existingPrices.forEach(cp => {
      map[cp.product_id] = {
        id: cp.id,
        value: String(cp.custom_price),
        is_promotion: cp.is_promotion === true,
      };
    });
    setPrices(map);
  }, [existingPrices, isLoading]);

  const activeProducts = useMemo(() =>
    products
      .filter(p => p.active !== false)
      .filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [products, search]
  );

  const handlePriceChange = (productId, value) => {
    setPrices(prev => ({
      ...prev,
      [productId]: { ...prev[productId], value },
    }));
  };

  const handlePromotionToggle = (productId, value) => {
    setPrices(prev => ({
      ...prev,
      [productId]: { ...prev[productId], is_promotion: value },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const activeProductsList = products.filter(p => p.active !== false);
      const pricesPayload = activeProductsList.map(product => {
        const entry = prices[product.id];
        const raw = entry?.value;
        const val = raw !== undefined && raw !== '' ? Number(raw) : null;
        const hasPrice = val !== null && !isNaN(val);
        return {
          product_id: product.id,
          custom_price: hasPrice ? val : null,
          // A promoção pertence à relação: sem preço definido não existe promoção
          is_promotion: hasPrice ? entry?.is_promotion === true : false,
        };
      });

      const res = await base44.functions.invoke('saveCustomPrices', {
        price_group_id: priceGroup.id,
        prices: pricesPayload,
      });

      if (res.data?.error) {
        toast.error('Erro ao salvar: ' + res.data.error);
        return;
      }

      queryClient.invalidateQueries({ queryKey: ['custom-prices', priceGroup.id] });
      queryClient.invalidateQueries({ queryKey: ['custom-prices'] });
      queryClient.invalidateQueries({ queryKey: ['custom-prices-catalog'] });
      queryClient.invalidateQueries({ queryKey: ['custom-prices-template'] });
      toast.success(`Preços salvos! (${res.data.created} criados, ${res.data.updated} atualizados, ${res.data.deleted} removidos)`);
      onClose();
    } catch (err) {
      toast.error('Erro ao salvar preços. Tente novamente.');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const customCount = Object.values(prices).filter(p => p?.value !== '' && p?.value !== undefined).length;
  const promotionCount = Object.values(prices).filter(p => p?.is_promotion && p?.value !== '' && p?.value !== undefined).length;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="w-[96vw] max-w-6xl h-[92vh] max-h-[92vh] flex flex-col p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Preços Customizados
            <Badge variant="secondary">{priceGroup.name}</Badge>
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Deixe em branco para o produto não participar desta tabela.{' '}
            {customCount > 0 && <strong>{customCount} produto(s) com preço definido.</strong>}{' '}
            {promotionCount > 0 && <strong className="text-accent">{promotionCount} em promoção.</strong>}
          </p>
        </DialogHeader>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar produto..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="overflow-y-auto flex-1 pr-1">
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8 text-sm">Carregando produtos...</p>
          ) : activeProducts.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">Nenhum produto encontrado.</p>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
              {activeProducts.map(product => {
                const entry = prices[product.id];
                const hasCustom = entry?.value !== '' && entry?.value !== undefined;
                const isPromotion = hasCustom && entry?.is_promotion === true;
                return (
                  <div
                    key={product.id}
                    className={`flex items-center gap-3 p-2.5 rounded-xl border transition-colors ${isPromotion ? 'border-accent/50 bg-accent/5' : hasCustom ? 'border-primary/30 bg-primary/5' : 'border-border bg-card'}`}
                  >
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {product.image_url
                        ? <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                        : <Package className="w-4 h-4 text-muted-foreground" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{product.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{product.packaging_type}{product.weight ? ` · ${product.weight}` : ''}</p>
                    </div>
                    <div className="text-right text-xs text-muted-foreground flex-shrink-0">
                      <p>Base</p>
                      <p className="font-semibold">R$ {(product.price || 0).toFixed(2)}</p>
                    </div>
                    <div className="w-32 flex-shrink-0">
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder={`${(product.price || 0).toFixed(2)}`}
                          value={entry?.value ?? ''}
                          onChange={e => handlePriceChange(product.id, e.target.value)}
                          className="pl-7 text-sm h-8"
                        />
                      </div>
                    </div>
                    <div className="w-16 flex-shrink-0 flex flex-col items-center gap-1">
                      <Switch
                        checked={isPromotion}
                        disabled={!hasCustom}
                        onCheckedChange={v => handlePromotionToggle(product.id, v)}
                      />
                      <span className={`text-[10px] font-semibold flex items-center gap-0.5 ${isPromotion ? 'text-accent' : 'text-muted-foreground'}`}>
                        <Tag className="w-3 h-3" />Promo
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-3 border-t mt-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button className="flex-1 bg-primary text-primary-foreground" onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4 mr-1" />
            {saving ? 'Salvando...' : 'Salvar Preços'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}