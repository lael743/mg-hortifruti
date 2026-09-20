import React, { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';

/**
 * Dropdown pesquisável de caminhões (globais da empresa).
 * O valor persistido é o nome/identificação do caminhão (CeasaReportItem.caminhao).
 * Campo opcional: permite ficar vazio e lista apenas caminhões ativos.
 */
export default function TruckCombobox({
  trucks = [],
  value = '',
  onChange,
  placeholder = 'Sem caminhão',
  className,
}) {
  const [open, setOpen] = useState(false);

  const active = trucks.filter(t => t.active !== false);
  // Mantém visível um valor já gravado cujo caminhão saiu da lista de ativos
  const orphan = value && !active.some(t => t.name === value) ? value : null;

  const select = (name) => {
    onChange(name);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('h-8 w-full justify-between text-sm font-normal px-3', className)}
        >
          <span className={cn('truncate', !value && 'text-muted-foreground')}>{value || placeholder}</span>
          <ChevronsUpDown className="shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="p-0 w-[240px]">
        <Command>
          <CommandInput placeholder="Pesquisar caminhão..." />
          <CommandList>
            <CommandEmpty>Nenhum caminhão ativo.</CommandEmpty>
            <CommandGroup>
              <CommandItem value="Sem caminhão" onSelect={() => select('')}>
                <Check className={cn(value ? 'opacity-0' : 'opacity-100')} />
                <span className="text-muted-foreground">Sem caminhão</span>
              </CommandItem>
              {orphan && (
                <CommandItem value={orphan} onSelect={() => select(orphan)}>
                  <Check />
                  <span className="truncate">{orphan}</span>
                  <span className="ml-auto text-xs text-muted-foreground">inativo</span>
                </CommandItem>
              )}
              {active.map(t => (
                <CommandItem key={t.id} value={t.name} onSelect={() => select(t.name)}>
                  <Check className={cn(value === t.name ? 'opacity-100' : 'opacity-0')} />
                  <span className="truncate">{t.name}</span>
                  {t.plate && <span className="ml-auto text-xs text-muted-foreground">{t.plate}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}