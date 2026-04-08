import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ShoppingCart, Tag, Package } from 'lucide-react';
import { addToCart } from '@/lib/cartStore';
import { toast } from 'sonner';

export default function ProductCard({ product, isLoggedIn, priceGroup }) {
  const hasPromo = product.promo_active && product.promo_price;
  const basePrice = hasPromo ? product.promo_price : product.price;

  // Apply price group discount/surcharge
  const discount = priceGroup?.discount_percent || 0;
  const displayPrice = basePrice * (1 - discount / 100);
  const hasGroupDiscount = discount !== 0 && isLoggedIn;

  const handleAdd = () => {
    // Pass the adjusted price to cart
    addToCart({ ...product, price: displayPrice, promo_price: hasPromo ? displayPrice : product.promo_price });
    toast.success(`${product.name} adicionado ao carrinho`);
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
        {hasPromo && (
          <Badge className="absolute top-3 left-3 bg-accent text-accent-foreground font-bold shadow-lg">
            <Tag className="w-3 h-3 mr-1" />PROMO
          </Badge>
        )}
        <Badge variant="secondary" className="absolute top-3 right-3 text-xs">
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
          <div className="flex items-end justify-between pt-1">
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
                <span className="text-[10px] text-green-600 font-semibold">
                  {discount > 0 ? `-${discount}%` : `+${Math.abs(discount)}%`} {priceGroup.name}
                </span>
              )}
            </div>
            <Button
              size="sm"
              className="bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4"
              onClick={handleAdd}
            >
              <ShoppingCart className="w-4 h-4 mr-1" />
              Adicionar
            </Button>
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