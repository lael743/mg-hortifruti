import React, { useState, useEffect } from 'react';
import { getFavorites } from '../lib/favoritesStore';
import { useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import ProductCard from '../components/catalog/ProductCard';
import CatalogFilters from '../components/catalog/CatalogFilters';
import { Leaf, TrendingUp } from 'lucide-react';
import ProductRecommendations from '../components/catalog/ProductRecommendations';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

export default function Catalog() {
  const { user } = useOutletContext();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Todas');
  const [priceRange, setPriceRange] = useState([0, 9999]);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [favorites, setFavorites] = useState(() => getFavorites());

  useEffect(() => {
    const update = () => setFavorites(getFavorites());
    window.addEventListener('favorites-updated', update);
    return () => window.removeEventListener('favorites-updated', update);
  }, []);

  const { data: settings = [] } = useQuery({
    queryKey: ['company-settings'],
    queryFn: () => base44.entities.CompanySettings.list(),
  });
  const company = settings[0];

  const { data: products = [], isLoading } = useQuery({
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

  const { data: myOrders = [] } = useQuery({
    queryKey: ['my-orders-catalog', user?.email],
    queryFn: () => base44.entities.Order.filter({ customer_email: user.email }, '-created_date'),
    enabled: !!user,
  });

  const { data: allOrders = [] } = useQuery({
    queryKey: ['all-orders-reco'],
    queryFn: () => base44.entities.Order.list(),
    enabled: !!user,
  });

  const activeProducts = products.filter(p => p.active !== false);
  const maxPrice = Math.max(0, ...activeProducts.map(p => p.promo_active && p.promo_price ? p.promo_price : p.price || 0));

  const filtered = activeProducts.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    const matchCategory = category === 'Todas' || p.category === category;
    const productPrice = p.promo_active && p.promo_price ? p.promo_price : p.price || 0;
    const matchPrice = productPrice >= priceRange[0] && productPrice <= priceRange[1];
    const matchFav = !onlyFavorites || favorites.includes(p.id);
    return matchSearch && matchCategory && matchPrice && matchFav;
  });

  const promoProducts = filtered.filter(p => p.promo_active);
  const regularProducts = filtered.filter(p => !p.promo_active);

  return (
    <main className="max-w-7xl mx-auto px-4 py-6 space-y-8">
      {/* Hero Banner */}
      <div
        className="relative rounded-2xl overflow-hidden p-8 md:p-12"
        style={company?.banner_url
          ? { backgroundImage: `url(${company.banner_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
          : {}}
      >
        {/* overlay */}
        <div className={`absolute inset-0 rounded-2xl ${company?.banner_url ? 'bg-black/45' : 'bg-gradient-to-br from-primary/10 via-primary/5 to-transparent'}`} />
        <div className="relative z-10">
          <div className={`flex items-center gap-2 mb-2 ${company?.banner_url ? 'text-white/80' : 'text-primary'}`}>
            <Leaf className="w-5 h-5" />
            <span className="text-sm font-semibold tracking-wide uppercase">{company?.company_name || 'Atacado HortiFruti'}</span>
          </div>
          <h1 className={`text-3xl md:text-4xl font-extrabold tracking-tight ${company?.banner_url ? 'text-white' : ''}`}>
            {company?.banner_title || <>Produtos frescos direto <br className="hidden sm:block" />do Produtor para sua loja</>}
          </h1>
          {company?.banner_subtitle && (
            <p className={`mt-2 text-lg font-medium ${company?.banner_url ? 'text-white/90' : 'text-foreground/70'}`}>{company.banner_subtitle}</p>
          )}
          <p className={`mt-3 max-w-lg ${company?.banner_url ? 'text-white/75' : 'text-muted-foreground'}`}>
            {user
              ? 'Navegue pelo catálogo, adicione ao carrinho e faça seu pedido online.'
              : 'Faça login para ver preços e realizar pedidos.'}
          </p>
          {userPriceGroup && (
            <Badge className="mt-3 bg-primary/10 text-primary border-primary/20 border">
              Tabela: {userPriceGroup.name}
              {userPriceGroup.discount_percent > 0 && ` — ${userPriceGroup.discount_percent}% de desconto`}
            </Badge>
          )}
        </div>
        {!company?.banner_url && (
          <div className="absolute right-0 bottom-0 opacity-10">
            <Leaf className="w-64 h-64 -mr-10 -mb-10" />
          </div>
        )}
      </div>

      <CatalogFilters
        search={search} setSearch={setSearch}
        category={category} setCategory={setCategory}
        priceRange={priceRange} setPriceRange={setPriceRange}
        onlyFavorites={onlyFavorites} setOnlyFavorites={setOnlyFavorites}
        maxPrice={maxPrice || 500}
      />

      {user && myOrders.length > 0 && (
        <ProductRecommendations
          allProducts={products}
          myOrders={myOrders}
          allOrders={allOrders}
          isLoggedIn={!!user}
          priceGroup={userPriceGroup}
        />
      )}

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
                  <ProductCard key={p.id} product={p} isLoggedIn={!!user} priceGroup={userPriceGroup} />
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
                  <ProductCard key={p.id} product={p} isLoggedIn={!!user} priceGroup={userPriceGroup} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}