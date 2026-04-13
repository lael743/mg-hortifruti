import React, { useState, useEffect } from 'react';
import { getFavorites } from '../lib/favoritesStore';
import { useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import ProductCard from '../components/catalog/ProductCard';
import CatalogFilters from '../components/catalog/CatalogFilters';
import { Leaf, TrendingUp, Wrench, Printer, ChevronUp, Phone, Mail, MapPin } from 'lucide-react';
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
  const [visibleCount, setVisibleCount] = useState(20);
  const [showTopBtn, setShowTopBtn] = useState(false);
  const [sortAZ, setSortAZ] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowTopBtn(window.scrollY > 400);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

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

  const isCatalogActive = company?.catalog_active !== false;

  const handlePrintCatalog = () => {
    const activeProds = products.filter(p => p.active !== false).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    const discount = userPriceGroup?.discount_percent || 0;

    // Build last-order qty map
    const lastQtyMap = {};
    if (myOrders.length > 0) {
      const sorted = [...myOrders].sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
      sorted.forEach(order => {
        (order.items || []).forEach(item => {
          if (!lastQtyMap[item.product_id]) {
            lastQtyMap[item.product_id] = item.quantity;
          }
        });
      });
    }

    const makeRow = (p) => {
      const basePrice = p.promo_active && p.promo_price ? p.promo_price : p.price || 0;
      const origPrice = p.price || 0;
      const finalPrice = basePrice * (1 - discount / 100);
      const origFinal = origPrice * (1 - discount / 100);
      const lastQty = lastQtyMap[p.id];
      const isPromo = p.promo_active && p.promo_price;
      const rowStyle = isPromo ? 'background:#fffbe6;' : '';
      const priceHtml = isPromo
        ? `<span style="text-decoration:line-through;color:#999;font-size:7px;">R$ ${origFinal.toFixed(2)}</span> <span style="color:#d97706;font-weight:bold;">R$ ${finalPrice.toFixed(2)}</span> <span style="background:#f59e0b;color:#fff;font-size:6px;padding:0 2px;border-radius:2px;font-weight:bold;">PROMO</span>`
        : `<span style="font-weight:bold;color:#1a5c2a;">R$ ${finalPrice.toFixed(2)}</span>`;
      const lastQtyHtml = lastQty
        ? `<span style="background:#dcfce7;color:#166534;border:1px solid #86efac;border-radius:3px;padding:0 3px;font-size:6.5px;font-weight:bold;">${String(lastQty).padStart(2,'0')}</span>`
        : `<span style="color:#ccc;font-size:6.5px;">--</span>`;
      return `<tr style="${rowStyle}">
        <td style="padding:2px 4px;border:1px solid #ddd;">
          <div style="font-weight:bold;font-size:7.5px;line-height:1.2;">${p.name}</div>
          <div style="color:#666;font-size:6.5px;">${p.packaging_type}${p.weight ? ' · ' + p.weight : ''}</div>
        </td>
        <td style="padding:2px 4px;border:1px solid #ddd;text-align:center;white-space:nowrap;">${priceHtml}</td>
        <td style="padding:2px 4px;border:1px solid #ddd;text-align:center;">${lastQtyHtml}</td>
        <td style="padding:2px 4px;border:1px solid #ddd;width:36px;"><div style="border-bottom:1px solid #aaa;height:12px;"></div></td>
      </tr>`;
    };

    // Split products in two halves for 2-column layout
    const half = Math.ceil(activeProds.length / 2);
    const left = activeProds.slice(0, half);
    const right = activeProds.slice(half);
    const maxRows = Math.max(left.length, right.length);

    const tableGroup = userPriceGroup ? `<p style="font-size:7px;color:#555;margin-bottom:4px;">Tabela: <b>${userPriceGroup.name}</b>${userPriceGroup.discount_percent ? ` (${userPriceGroup.discount_percent}% de desconto)` : ''}</p>` : '';

    const theadRow = `<tr style="background:#2d7a3a;color:#fff;">
      <th style="padding:3px 4px;text-align:left;font-size:7px;">PRODUTO</th>
      <th style="padding:3px 4px;font-size:7px;">PREÇO</th>
      <th style="padding:3px 4px;font-size:7px;" title="Qtd última compra">ÚLT.</th>
      <th style="padding:3px 4px;font-size:7px;">QTD</th>
    </tr>`;

    let tableRows = '';
    for (let i = 0; i < maxRows; i++) {
      const lp = left[i];
      const rp = right[i];
      const leftCells = lp ? makeRow(lp).replace(/^<tr[^>]*>/, '').replace(/<\/tr>$/, '') : '<td colspan="4" style="border:1px solid #ddd;"></td>';
      const rightCells = rp ? makeRow(rp).replace(/^<tr[^>]*>/, '').replace(/<\/tr>$/, '') : '<td colspan="4" style="border:1px solid #ddd;"></td>';
      const bg = (lp?.promo_active || rp?.promo_active) ? '' : (i % 2 === 0 ? 'background:#f9fafb;' : '');
      tableRows += `<tr style="${bg}">${leftCells}<td style="width:4px;background:#e5e7eb;"></td>${rightCells}</tr>`;
    }

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Tabela de Preços</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: Arial, sans-serif; font-size: 7.5px; padding: 6px 8px; }
      h2 { font-size: 11px; margin-bottom: 2px; }
      table { width: 100%; border-collapse: collapse; }
      @media print { @page { margin: 6mm; size: A4; } body { padding: 0; } }
    </style></head>
    <body>
      <h2>${company?.company_name || 'Tabela de Preços'} &nbsp;·&nbsp; <span style="font-size:9px;font-weight:normal">${new Date().toLocaleDateString('pt-BR')} &nbsp;·&nbsp; ${activeProds.length} produtos</span></h2>
      ${tableGroup}
      <p style="font-size:6.5px;color:#888;margin-bottom:4px;">★ ÚLT. = quantidade da última compra &nbsp;|&nbsp; QTD = quantidade do novo pedido</p>
      <table>
        <thead>${theadRow}<tr><td colspan="9" style="height:2px;"></td></tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
    </body></html>`;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);
    iframe.contentDocument.write(html);
    iframe.contentDocument.close();
    iframe.contentWindow.focus();
    setTimeout(() => {
      iframe.contentWindow.print();
      setTimeout(() => document.body.removeChild(iframe), 1000);
    }, 500);
  };

  // Show maintenance screen for non-admin users when catalog is off
  if (!isCatalogActive && user?.role !== 'admin') {
    return (
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
            <Wrench className="w-10 h-10 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-bold">Catálogo em Manutenção</h2>
          <p className="text-muted-foreground max-w-sm">
            Estamos atualizando nossos produtos. Em breve o catálogo estará disponível novamente.
          </p>
          {company?.whatsapp && (
            <a
              href={`https://wa.me/${company.whatsapp.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-green-500 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-green-600 transition-colors"
            >
              Falar pelo WhatsApp
            </a>
          )}
        </div>
      </main>
    );
  }

  const activeProducts = products.filter(p => p.active !== false);
  const maxPrice = Math.max(0, ...activeProducts.map(p => p.promo_active && p.promo_price ? p.promo_price : p.price || 0));

  const normalizeStr = (str) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  const filtered = activeProducts.filter(p => {
    const matchSearch = !search || normalizeStr(p.name).includes(normalizeStr(search));
    const matchCategory = category === 'Todas' || p.category === category;
    const productPrice = p.promo_active && p.promo_price ? p.promo_price : p.price || 0;
    const matchPrice = productPrice >= priceRange[0] && productPrice <= priceRange[1];
    const matchFav = !onlyFavorites || favorites.includes(p.id);
    return matchSearch && matchCategory && matchPrice && matchFav;
  });

  if (sortAZ) filtered.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

  const promoProducts = filtered.filter(p => p.promo_active);
  const regularProducts = filtered.filter(p => !p.promo_active);
  const visibleRegular = regularProducts.slice(0, visibleCount);
  const hasMore = visibleCount < regularProducts.length;

  return (
    <main className="max-w-7xl mx-auto px-4 py-6 space-y-8">
      {/* Print button */}
      {user && (
        <div className="flex justify-end">
          <button
            onClick={handlePrintCatalog}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5 hover:bg-muted transition-colors"
          >
            <Printer className="w-4 h-4" />
            Imprimir tabela de preços
          </button>
        </div>
      )}

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

      <div className="space-y-3">
        <CatalogFilters
          search={search} setSearch={setSearch}
          category={category} setCategory={setCategory}
          priceRange={priceRange} setPriceRange={setPriceRange}
          onlyFavorites={onlyFavorites} setOnlyFavorites={setOnlyFavorites}
          maxPrice={maxPrice || 500}
          isLoggedIn={!!user}
          extraCategories={company?.custom_categories || []}
        />
        <div className="flex justify-end">
          <button
            onClick={() => setSortAZ(v => !v)}
            className={`inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border transition-colors ${
              sortAZ ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            <span className="font-bold text-xs">A→Z</span>
            {sortAZ ? 'Ordenado' : 'Ordenar A-Z'}
          </button>
        </div>
      </div>

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
              <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {visibleRegular.map(p => (
                  <ProductCard key={p.id} product={p} isLoggedIn={!!user} priceGroup={userPriceGroup} />
                ))}
              </div>
              {hasMore && (
                <div className="flex justify-center mt-6">
                  <button
                    onClick={() => setVisibleCount(c => c + 20)}
                    className="px-6 py-2.5 rounded-xl border border-primary text-primary font-semibold text-sm hover:bg-primary hover:text-primary-foreground transition-colors"
                  >
                    Ver mais ({regularProducts.length - visibleCount} restantes)
                  </button>
                </div>
              )}
              </>
            )}
          </section>
        </>
      )}

      {/* Footer */}
      <footer className="mt-16 bg-primary text-primary-foreground rounded-2xl px-8 py-8 text-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <p className="font-bold text-lg">{company?.company_name}</p>
            {company?.address && (
              <p className="flex items-center gap-1 mt-1 opacity-80"><MapPin className="w-3.5 h-3.5" />{company.address}{company.city ? `, ${company.city}` : ''}{company.state ? ` - ${company.state}` : ''}</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            {company?.whatsapp && (
              <a href={`https://wa.me/${company.whatsapp.replace(/\D/g,'')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 opacity-80 hover:opacity-100 transition-opacity">
                <Phone className="w-3.5 h-3.5" />{company.whatsapp}
              </a>
            )}
            {company?.email && (
              <a href={`mailto:${company.email}`} className="flex items-center gap-1.5 opacity-80 hover:opacity-100 transition-opacity">
                <Mail className="w-3.5 h-3.5" />{company.email}
              </a>
            )}
          </div>
          <p className="text-xs opacity-60">&copy; {new Date().getFullYear()} {company?.company_name}. Todos os direitos reservados.</p>
        </div>
      </footer>

      {/* Back to top */}
      {showTopBtn && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-24 right-5 z-50 w-10 h-10 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-all"
        >
          <ChevronUp className="w-5 h-5" />
        </button>
      )}
    </main>
  );
}