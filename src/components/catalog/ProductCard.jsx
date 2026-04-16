import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ShoppingCart, Tag, Package, Minus, Plus, Heart, CheckCircle2 } from 'lucide-react';
import { toggleFavorite, isFavorite } from '@/lib/favoritesStore';
import { addToCart, getCart } from '@/lib/cartStore';
import { toast } from 'sonner';

const getCartQty = (productId) => {
  const cart = getCart();
  const item = cart.find(i => i.product_id === productId);
  return item ? item.quantity : 0;
};

export default function ProductCard({ product, isLoggedIn, priceGroup }) {
  const [qty, setQty] = useState(1);
  const [fav, setFav] = useState(() => isFavorite(product.id));
  const [cartQty, setCartQty] = useState(() => getCartQty(product.id));

  useEffect(() => {
    const update = () => setCartQty(getCartQty(product.id));
    window.addEventListener('cart-updated', update);
    return () => window.removeEventListener('cart-updated', update);
  }, [product.id]);

  const handleToggleFav = (e) => {
    e.stopPropagation();
    toggleFavorite(product.id);
    setFav(f => !f);
  };
  const hasPromo = product.promo_active && product.promo_price;
  const basePrice = hasPromo ? product.promo_price : product.price;

  // Apply price group discount/surcharge
  const discount = priceGroup?.discount_percent || 0;
  const displayPrice = basePrice * (1 - discount / 100);
  const hasGroupDiscount = discount !== 0 && isLoggedIn;

  const handleAdd = () => {
    for (let i = 0; i < qty; i++) {
      addToCart({ ...product, price: displayPrice, promo_price: hasPromo ? displayPrice : product.promo_price });
    }
    toast.success(`${qty}x ${product.name} adicionado ao carrinho`);
    setQty(1);
  };

  return (
    <Card className="group overflow-hidden border border-border/60 hover:border-primary/30 hover:shadow-lg transition-all duration-300">
      <div className="relative aspect-square bg-muted overflow-hidden">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <Package className="w-12 h-12 opacity-30" />
          </div>
        )}
        {isLoggedIn && (
          <button
            onClick={handleToggleFav}
            className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-white/80 backdrop-blur flex items-center justify-center shadow hover:scale-110 transition-transform"
          >
            <Heart className={`w-4 h-4 transition-colors ${fav ? 'fill-red-500 text-red-500' : 'text-muted-foreground'}`} />
          </button>
        )}
        {hasPromo && (
          <Badge className="absolute top-3 left-3 bg-accent text-accent-foreground font-bold shadow-lg">
            <Tag className="w-3 h-3 mr-1" />PROMO
          </Badge>
        )}
        {cartQty > 0 && (
          <div className="absolute bottom-3 left-3 flex items-center gap-1 bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded-full shadow-md">
            <CheckCircle2 className="w-3 h-3" />
            {cartQty} no carrinho
          </div>
        )}
        <Badge variant="secondary" className="absolute bottom-3 right-3 text-xs">
          {product.category}
        </Badge>
      </div>

      <div className="p-4 space-y-3">
        <div>
          <h3 className="font-semibold text-base leading-tight">{product.name}</h3>
          {product.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{product.description}</p>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="bg-secondary px-2 py-0.5 rounded-md">{product.packaging_type}</span>
          {product.weight && <span>{product.weight}</span>}
        </div>

        {isLoggedIn ? (
          <div className="pt-1 space-y-2">
            <div>
              {(hasPromo || hasGroupDiscount) && (
                <span className="text-xs text-muted-foreground line-through block">
                  R$ {product.price.toFixed(2)}
                </span>
              )}
              <span className="text-xl font-bold text-primary">
                R$ {displayPrice.toFixed(2)}
              </span>
              {hasGroupDiscount && (
                <span className="text-[10px] text-green-600 font-semibold block">
                  {discount > 0 ? `-${discount}%` : `+${Math.abs(discount)}%`} {priceGroup.name}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between gap-1">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setQty(q => Math.max(1, q - 1))}
                  className="w-7 h-7 rounded-md border border-border flex items-center justify-center hover:bg-muted transition-colors"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="w-7 text-center text-sm font-semibold">{qty}</span>
                <button
                  onClick={() => setQty(q => q + 1)}
                  className="w-7 h-7 rounded-md border border-border flex items-center justify-center hover:bg-muted transition-colors"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
              <Button
                size="sm"
                className="bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-3 flex-shrink-0"
                onClick={handleAdd}
              >
                <ShoppingCart className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="pt-1">
            <p className="text-sm text-muted-foreground italic">Faça login para ver o preço</p>
          </div>
        )}
      </div>
    </Card>
  );
}