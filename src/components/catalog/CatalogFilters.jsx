import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, X } from 'lucide-react';

const CATEGORIES = ['Todas', 'Frutas', 'Verduras', 'Legumes', 'Temperos', 'Outros'];

export default function CatalogFilters({ search, setSearch, category, setCategory }) {
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

      <div className="flex flex-wrap gap-2">
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
      </div>
    </div>
  );
}