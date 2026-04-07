import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import ProductCard from '../components/catalog/ProductCard';
import CatalogFilters from '../components/catalog/CatalogFilters';
import { Leaf, TrendingUp } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function Catalog() {
  const { user } = useOutletContext();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Todas');

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list(),
  });

  const activeProducts = products.filter(p => p.active !== false);

  const filtered = activeProducts.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    const matchCategory = category === 'Todas' || p.category === category;
    return matchSearch && matchCategory;
  });

  const promoProducts = filtered.filter(p => p.promo_active);
  const regularProducts = filtered.filter(p => !p.promo_active);

  return (
    <main className="max-w-7xl mx-auto px-4 py-6 space-y-8">
      {/* Hero */}
      <div className="relative rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-8 md:p-12 overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-primary mb-2">
            <Leaf className="w-5 h-5" />
            <span className="text-sm font-semibold tracking-wide uppercase">Atacado HortiFruti</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            Produtos frescos direto <br className="hidden sm:block" />do CEASA para sua loja
          </h1>
          <p className="text-muted-foreground mt-3 max-w-lg">
            {user
              ? 'Navegue pelo catálogo, adicione ao carrinho e faça seu pedido online.'
              : 'Faça login para ver preços e realizar pedidos.'}
          </p>
        </div>
        <div className="absolute right-0 bottom-0 opacity-10">
          <Leaf className="w-64 h-64 -mr-10 -mb-10" />
        </div>
      </div>

      <CatalogFilters search={search} setSearch={setSearch} category={category} setCategory={setCategory} />

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array(8).fill(0).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="aspect-square rounded-xl" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {promoProducts.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-accent" />
                <h2 className="text-lg font-bold">Promoções</h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {promoProducts.map(p => (
                  <ProductCard key={p.id} product={p} isLoggedIn={!!user} />
                ))}
              </div>
            </section>
          )}

          <section>
            {promoProducts.length > 0 && <h2 className="text-lg font-bold mb-4">Todos os Produtos</h2>}
            {regularProducts.length === 0 && promoProducts.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <p className="text-lg">Nenhum produto encontrado</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {regularProducts.map(p => (
                  <ProductCard key={p.id} product={p} isLoggedIn={!!user} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}