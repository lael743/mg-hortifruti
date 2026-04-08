import React, { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Sparkles, History, Heart, Users } from 'lucide-react';
import ProductCard from './ProductCard';
import { getFavorites } from '@/lib/favoritesStore';

function Section({ icon: Icon, title, color, products, isLoggedIn, priceGroup }) {
  if (!products.length) return null;
  return (
    <div className="space-y-3">
      <div className={`flex items-center gap-2 ${color}`}>
        <Icon className="w-5 h-5" />
        <h2 className="text-base font-bold">{title}</h2>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {products.map(p => (
          <ProductCard key={p.id} product={p} isLoggedIn={isLoggedIn} priceGroup={priceGroup} />
        ))}
      </div>
    </div>
  );
}

export default function ProductRecommendations({ allProducts, myOrders, allOrders, isLoggedIn, priceGroup, maxPerSection = 4 }) {
  const favorites = getFavorites();

  const { fromHistory, fromFavorites, fromSimilar } = useMemo(() => {
    const activeProducts = allProducts.filter(p => p.active !== false);
    const productMap = Object.fromEntries(activeProducts.map(p => [p.id, p]));

    // 1. Products from purchase history (bought before, recommend again)
    const boughtIds = new Set();
    const boughtCount = {};
    myOrders.forEach(order => {
      order.items?.forEach(item => {
        boughtIds.add(item.product_id);
        boughtCount[item.product_id] = (boughtCount[item.product_id] || 0) + item.quantity;
      });
    });
    const fromHistory = Object.entries(boughtCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxPerSection)
      .map(([id]) => productMap[id])
      .filter(Boolean);

    // 2. Favorited products not yet bought
    const fromFavorites = favorites
      .filter(id => !boughtIds.has(id) && productMap[id])
      .slice(0, maxPerSection)
      .map(id => productMap[id]);

    // 3. Collaborative filtering: find similar clients (share bought products),
    //    then surface their top products the user hasn't bought
    const myBoughtSet = new Set(Object.keys(boughtCount));

    // score each product_id by how many "similar" clients (who share ≥1 product) bought it
    const productScore = {};
    allOrders.forEach(order => {
      const orderProductIds = order.items?.map(i => i.product_id) || [];
      const overlap = orderProductIds.filter(id => myBoughtSet.has(id)).length;
      if (overlap === 0) return; // not similar
      orderProductIds.forEach(id => {
        if (!myBoughtSet.has(id) && productMap[id]) {
          productScore[id] = (productScore[id] || 0) + overlap;
        }
      });
    });

    const fromSimilar = Object.entries(productScore)
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxPerSection)
      .map(([id]) => productMap[id])
      .filter(Boolean);

    return { fromHistory, fromFavorites, fromSimilar };
  }, [allProducts, myOrders, allOrders, favorites, maxPerSection]);

  const hasAny = fromHistory.length || fromFavorites.length || fromSimilar.length;
  if (!hasAny) return null;

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2 text-primary">
        <Sparkles className="w-5 h-5" />
        <h2 className="text-xl font-bold">Recomendações para você</h2>
      </div>

      <Section
        icon={History}
        title="Compre novamente"
        color="text-primary"
        products={fromHistory}
        isLoggedIn={isLoggedIn}
        priceGroup={priceGroup}
      />

      <Section
        icon={Heart}
        title="Favoritos para experimentar"
        color="text-red-500"
        products={fromFavorites}
        isLoggedIn={isLoggedIn}
        priceGroup={priceGroup}
      />

      <Section
        icon={Users}
        title="Clientes similares também pediram"
        color="text-blue-600"
        products={fromSimilar}
        isLoggedIn={isLoggedIn}
        priceGroup={priceGroup}
      />
    </div>
  );
}