import React, { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';

/**
 * Combobox pesquisável de Boxes do Ceasa. O valor persistido é o id do CeasaBox.
 * Lista apenas Boxes ativos; o Box já vinculado permanece visível mesmo se estiver inativo.
 */
export default function BoxCombobox({ boxes = [], value = '', onChange, placeholder = 'Selecionar Box', className }) {
  const [open, setOpen] = useState(false);

  const active = boxes.filter(b => b.active !== false);
  const current = value ? boxes.find(b => b.id === value) : null;
  const options = current && !active.some(b => b.id === value) ? [current, ...active] : active;

  const select = (id) => {
    onChange(id);
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
          className={cn('w-full justify-between font-normal px-2', className)}
        >
          <span className={cn('truncate', !current && 'text-muted-foreground')}>
            {current?.name || placeholder}
          </span>
          <ChevronsUpDown className="shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="p-0 w-[220px]">
        <Command>
          <CommandInput placeholder="Pesquisar Box..." />
          <CommandList>
            <CommandEmpty>Nenhum Box ativo.</CommandEmpty>
            <CommandGroup>
              {options.map(b => (
                <CommandItem key={b.id} value={b.name} onSelect={() => select(b.id)}>
                  <Check className={cn(value === b.id ? 'opacity-100' : 'opacity-0')} />
                  <span className="truncate">{b.name}</span>
                  {b.active === false && (
                    <span className="ml-auto text-xs text-muted-foreground">inativo</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}