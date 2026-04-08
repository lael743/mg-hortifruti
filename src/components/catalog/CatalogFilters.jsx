import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, X, SlidersHorizontal, Heart } from 'lucide-react';
import { Slider } from '@/components/ui/slider';

const CATEGORIES = ['Todas', 'Frutas', 'Verduras', 'Legumes', 'Temperos', 'Outros'];

export default function CatalogFilters({ search, setSearch, category, setCategory, priceRange, setPriceRange, onlyFavorites, setOnlyFavorites, maxPrice }) {
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
        {CATEGORIES.map(cat => (
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
        <Button
          variant={hasAdvancedFilter ? 'default' : 'outline'}
          size="sm"
          className={`ml-auto gap-1.5 ${hasAdvancedFilter ? 'bg-primary text-primary-foreground' : ''}`}
          onClick={() => setShowAdvanced(v => !v)}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Filtros{hasAdvancedFilter ? ' ●' : ''}
        </Button>
      </div>

      {showAdvanced && (
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
            <label className="text-xs text-muted-foreground mb-2 block">
              Faixa de preço: <strong>R$ {priceRange[0].toFixed(0)} – R$ {priceRange[1].toFixed(0)}</strong>
            </label>
            <Slider
              min={0}
              max={maxPrice}
              step={1}
              value={priceRange}
              onValueChange={setPriceRange}
              className="mt-2"
            />
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