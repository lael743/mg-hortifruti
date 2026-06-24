import React, { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { MapPin, Plus } from 'lucide-react';

export default function CityAutocomplete({ value, onChange, state, placeholder = 'Cidade' }) {
  const [query, setQuery] = useState(value || '');
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const wrapRef = useRef(null);

  const { data: cities = [] } = useQuery({
    queryKey: ['cities'],
    queryFn: () => base44.entities.City.list(),
  });

  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const normalized = query.trim().toLowerCase();

  const filtered = normalized
    ? cities.filter(c => {
        const matchName = (c.name || '').toLowerCase().includes(normalized);
        const matchState = !state || (c.state || '').toUpperCase() === state.toUpperCase();
        return matchName && matchState;
      })
    : cities.filter(c => !state || (c.state || '').toUpperCase() === state.toUpperCase());

  const handleSelect = (cityName) => {
    setQuery(cityName);
    onChange(cityName);
    setShowDropdown(false);
    setHighlightIndex(-1);
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    onChange(val);
    setShowDropdown(true);
    setHighlightIndex(-1);
  };

  const handleKeyDown = (e) => {
    if (!showDropdown || filtered.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex(prev => (prev + 1) % filtered.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex(prev => (prev <= 0 ? filtered.length - 1 : prev - 1));
    } else if (e.key === 'Enter' && highlightIndex >= 0) {
      e.preventDefault();
      handleSelect(filtered[highlightIndex].name);
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  const exactMatch = filtered.some(c => (c.name || '').toLowerCase() === normalized);

  return (
    <div className="relative" ref={wrapRef}>
      <Input
        value={query}
        onChange={handleInputChange}
        onFocus={() => setShowDropdown(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
      />
      {showDropdown && (
        <div className="absolute z-50 top-full left-0 right-0 border rounded-md mt-1 max-h-44 overflow-y-auto bg-background shadow-lg">
          {filtered.length > 0 ? (
            filtered.slice(0, 20).map((c, idx) => (
              <div
                key={c.id}
                className={`px-3 py-2 cursor-pointer border-b last:border-b-0 flex items-center gap-2 ${
                  idx === highlightIndex ? 'bg-muted' : 'hover:bg-muted'
                }`}
                onMouseDown={(e) => { e.preventDefault(); handleSelect(c.name); }}
              >
                <MapPin className="w-3 h-3 text-muted-foreground shrink-0" />
                <span className="text-sm">{c.name}</span>
                {c.state && <span className="text-xs text-muted-foreground">- {c.state}</span>}
              </div>
            ))
          ) : null}
          {normalized && !exactMatch && (
            <div
              className="px-3 py-2 cursor-pointer hover:bg-muted border-t flex items-center gap-2 text-primary"
              onMouseDown={(e) => { e.preventDefault(); handleSelect(query.trim()); }}
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span className="text-sm font-medium">Cadastrar "{query.trim()}"</span>
            </div>
          )}
          {!normalized && filtered.length === 0 && (
            <div className="px-3 py-2 text-sm text-muted-foreground">Comece a digar para buscar cidades.</div>
          )}
        </div>
      )}
    </div>
  );
}