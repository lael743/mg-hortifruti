import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Package, Save } from 'lucide-react';
import { toast } from 'sonner';

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
    existingPrices.forEach(cp => { map[cp.product_id] = { id: cp.id, value: String(cp.custom_price) }; });
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

  const handleSave = async () => {
    setSaving(true);
    try {
      const activeProductsList = products.filter(p => p.active !== false);
      const pricesPayload = activeProductsList.map(product => {
        const entry = prices[product.id];
        const val = entry?.value !== undefined && entry?.value !== '' ? Number(entry.value) : null;
        return {
          product_id: product.id,
          custom_price: (!isNaN(val) && val !== null) ? val : null,
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
      queryClient.invalidateQueries({ queryKey: ['custom-prices-catalog'] });
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

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Preços Customizados
            <Badge variant="secondary">{priceGroup.name}</Badge>
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Deixe em branco para usar o preço base do produto. {customCount > 0 && <strong>{customCount} produto(s) com preço customizado.</strong>}
          </p>
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

        <div className="overflow-y-auto flex-1 space-y-2 pr-1">
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8 text-sm">Carregando produtos...</p>
          ) : activeProducts.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">Nenhum produto encontrado.</p>
          ) : activeProducts.map(product => {
            const entry = prices[product.id];
            const hasCustom = entry?.value !== '' && entry?.value !== undefined;
            return (
              <div
                key={product.id}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${hasCustom ? 'border-primary/30 bg-primary/5' : 'border-border bg-card'}`}
              >
                <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {product.image_url
                    ? <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                    : <Package className="w-4 h-4 text-muted-foreground" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{product.name}</p>
                  <p className="text-xs text-muted-foreground">{product.packaging_type}{product.weight ? ` · ${product.weight}` : ''}</p>
                </div>
                <div className="text-right text-xs text-muted-foreground mr-2 flex-shrink-0">
                  <p>Base</p>
                  <p className="font-semibold">R$ {(product.price || 0).toFixed(2)}</p>
                </div>
                <div className="w-28 flex-shrink-0">
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
              </div>
            );
          })}
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