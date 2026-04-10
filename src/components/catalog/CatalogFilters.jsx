import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, X, SlidersHorizontal, Heart } from 'lucide-react';
import { Slider } from '@/components/ui/slider';

const DEFAULT_CATEGORIES = ['Todas', 'Frutas', 'Verduras', 'Legumes', 'Temperos', 'Outros'];

export default function CatalogFilters({ search, setSearch, category, setCategory, priceRange, setPriceRange, onlyFavorites, setOnlyFavorites, maxPrice, isLoggedIn, extraCategories = [] }) {
  const categories = [...new Set([...DEFAULT_CATEGORIES, ...extraCategories])];
  const [showAdvanced, setShowAdvanced] = useState(false);
  const hasAdvancedFilter = onlyFavorites || priceRange[1] < maxPrice || priceRange[0] > 0;

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar produtos..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 h-11 bg-card"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
            <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        {categories.map(cat => (
          <Button
            key={cat}
            variant={category === cat ? 'default' : 'outline'}
            size="sm"
            className={category === cat ? 'bg-primary text-primary-foreground' : ''}
            onClick={() => setCategory(cat)}
          >
            {cat}
          </Button>
        ))}
        {isLoggedIn && (
          <Button
            variant={hasAdvancedFilter ? 'default' : 'outline'}
            size="sm"
            className={`ml-auto gap-1.5 ${hasAdvancedFilter ? 'bg-primary text-primary-foreground' : ''}`}
            onClick={() => setShowAdvanced(v => !v)}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Filtros{hasAdvancedFilter ? ' ●' : ''}
          </Button>
        )}
      </div>

      {showAdvanced && isLoggedIn && (
        <div className="bg-card border rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Filtros avançados</span>
            {hasAdvancedFilter && (
              <button
                className="text-xs text-primary underline"
                onClick={() => { setPriceRange([0, maxPrice]); setOnlyFavorites(false); }}
              >
                Limpar
              </button>
            )}
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-3 block">
              Faixa de preço:
            </label>
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1">
                <label className="text-[10px] text-muted-foreground block mb-1">Mínimo</label>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                  <input
                    type="number"
                    min={0}
                    max={priceRange[1]}
                    value={priceRange[0]}
                    onChange={e => setPriceRange([Math.min(Number(e.target.value), priceRange[1]), priceRange[1]])}
                    className="w-full pl-7 pr-2 py-1.5 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              </div>
              <span className="text-muted-foreground text-sm mt-4">—</span>
              <div className="flex-1">
                <label className="text-[10px] text-muted-foreground block mb-1">Máximo</label>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                  <input
                    type="number"
                    min={priceRange[0]}
                    max={maxPrice}
                    value={priceRange[1]}
                    onChange={e => setPriceRange([priceRange[0], Math.max(Number(e.target.value), priceRange[0])])}
                    className="w-full pl-7 pr-2 py-1.5 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              </div>
            </div>
            <Slider
              min={0}
              max={maxPrice}
              step={1}
              value={priceRange}
              onValueChange={setPriceRange}
              className="mt-2"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
              <span>R$ 0</span>
              <span>R$ {maxPrice.toFixed(0)}</span>
            </div>
          </div>

          <button
            onClick={() => setOnlyFavorites(v => !v)}
            className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg border w-full transition-colors ${
              onlyFavorites ? 'bg-red-50 border-red-200 text-red-600' : 'border-border hover:bg-muted'
            }`}
          >
            <Heart className={`w-4 h-4 ${onlyFavorites ? 'fill-red-500 text-red-500' : 'text-muted-foreground'}`} />
            Mostrar apenas favoritos
          </button>
        </div>
      )}
    </div>
  );
}