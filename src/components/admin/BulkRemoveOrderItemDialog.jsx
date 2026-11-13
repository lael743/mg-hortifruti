import React, { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { AlertTriangle, Check, ChevronsUpDown, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { orderDateInLocalTimezone, orderItemIdentity, removeProductFromOrder, isOrderEligibleForBulkItemRemoval } from '@/lib/bulkRemoveOrderItem';

function formatDateBR(value) {
  if (!value) return '—';
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
}

export default function BulkRemoveOrderItemDialog({ orders = [], startDate, endDate, onClose, onCompleted }) {
  const queryClient = useQueryClient();
  const [productKey, setProductKey] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [productPickerOpen, setProductPickerOpen] = useState(false);

  const periodOrders = useMemo(() => orders.filter(order => {
    const date = orderDateInLocalTimezone(order);
    return (!startDate || date >= startDate) && (!endDate || date <= endDate);
  }), [orders, startDate, endDate]);

  const products = useMemo(() => {
    const map = new Map();
    periodOrders.forEach(order => (order.items || []).forEach(item => {
      const key = orderItemIdentity(item);
      if (key === 'name:') return;
      if (!map.has(key)) map.set(key, { key, name: item.product_name || 'Produto sem nome', packaging: item.packaging_type || '', weight: item.weight || '' });
    }));
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [periodOrders]);

  const matchingOrders = useMemo(() => productKey
    ? periodOrders.filter(order => (order.items || []).some(item => orderItemIdentity(item) === productKey))
    : [], [periodOrders, productKey]);

  // Pedidos entregues/cancelados são preservados para não desalinhar títulos e histórico financeiro.
  const skippedOrders = matchingOrders.filter(order => !isOrderEligibleForBulkItemRemoval(order));
  const editableOrders = matchingOrders.filter(order => isOrderEligibleForBulkItemRemoval(order));

  const mutation = useMutation({
    mutationFn: async () => {
      if (!productKey || !editableOrders.length) throw new Error('Nenhum pedido elegível para alteração.');
      let updated = 0;
      const failures = [];
      for (const order of editableOrders) {
        try {
          await base44.entities.Order.update(order.id, removeProductFromOrder(order, productKey));
          updated += 1;
        } catch (error) {
          failures.push({ orderId: order.id, orderNumber: order.order_number, message: error?.message || String(error) });
        }
      }
      return { updated, failures };
    },
    onSuccess: async ({ updated, failures }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-orders'] }),
        queryClient.invalidateQueries({ queryKey: ['my-orders'] }),
        queryClient.invalidateQueries({ queryKey: ['contas-a-receber'] }),
        queryClient.invalidateQueries({ queryKey: ['ceasa-report-items'] }),
        queryClient.invalidateQueries({ queryKey: ['ceasa-conferencia'] }),
      ]);
      if (failures.length) toast.error(`${updated} pedido(s) atualizado(s); ${failures.length} falharam. Confira e tente novamente.`);
      else toast.success(`Produto removido de ${updated} pedido(s).`);
      onCompleted?.({ updated, failures });
    },
    onError: error => toast.error(error?.message || 'Não foi possível remover o produto dos pedidos.'),
  });

  const selectedProduct = products.find(product => product.key === productKey);

  return (
    <Dialog open onOpenChange={open => { if (!open && !mutation.isPending) onClose(); }}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Trash2 className="w-5 h-5 text-destructive" />Remover produto de vários pedidos</DialogTitle>
          <DialogDescription>Remove o produto selecionado dos pedidos reais dentro do período definido na tela de Pedidos.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Produto</Label>
            <Popover open={productPickerOpen} onOpenChange={setProductPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={productPickerOpen}
                  className="w-full justify-between font-normal"
                >
                  <span className={selectedProduct ? 'truncate' : 'text-muted-foreground'}>
                    {selectedProduct
                      ? `${selectedProduct.name}${selectedProduct.packaging ? ` • ${selectedProduct.packaging}` : ''}${selectedProduct.weight ? ` • ${selectedProduct.weight}` : ''}`
                      : 'Buscar e selecionar produto...'}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Digite o nome do produto..." />
                  <CommandList>
                    <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
                    <CommandGroup>
                      {products.map(product => {
                        const label = `${product.name}${product.packaging ? ` • ${product.packaging}` : ''}${product.weight ? ` • ${product.weight}` : ''}`;
                        return (
                          <CommandItem
                            key={product.key}
                            value={label}
                            onSelect={() => {
                              setProductKey(product.key);
                              setConfirmed(false);
                              setProductPickerOpen(false);
                            }}
                          >
                            <Check className={`mr-2 h-4 w-4 ${productKey === product.key ? 'opacity-100' : 'opacity-0'}`} />
                            <span className="truncate">{label}</span>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <p className="text-xs text-muted-foreground">Período: {formatDateBR(startDate)} até {formatDateBR(endDate)} · {periodOrders.length} pedido(s) analisado(s).</p>
          </div>
          {productKey && <div className="rounded-lg border p-3 space-y-2">
            <div className="flex justify-between text-sm"><span>Pedidos que contêm o produto</span><strong>{matchingOrders.length}</strong></div>
            <div className="flex justify-between text-sm"><span>Pedidos que serão alterados</span><strong className="text-destructive">{editableOrders.length}</strong></div>
            {skippedOrders.length > 0 && <div className="flex gap-2 rounded-md bg-amber-50 text-amber-800 p-2 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0" />{skippedOrders.length} pedido(s) Entregue/Cancelado não serão alterados, para preservar o histórico financeiro.
            </div>}
            {editableOrders.length > 0 && <div className="max-h-44 overflow-y-auto divide-y text-xs">
              {editableOrders.map(order => <div key={order.id} className="py-2 flex justify-between gap-2">
                <span>Pedido #{order.order_number || '—'} · {order.customer_display_name || order.customer_name || order.customer_email}</span>
                <span className="shrink-0">{order.status}</span>
              </div>)}
            </div>}
            <p className="text-xs text-muted-foreground">Subtotal, desconto e total serão recalculados em cada pedido. Os demais itens e preços serão preservados.</p>
          </div>}
          {editableOrders.length > 0 && <label className="flex items-start gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} className="mt-1" />
            <span>Confirmo a remoção de <strong>{selectedProduct?.name}</strong> dos {editableOrders.length} pedido(s) listados acima.</span>
          </label>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>Voltar</Button>
          <Button variant="destructive" disabled={!confirmed || !editableOrders.length || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? 'Removendo...' : `Remover de ${editableOrders.length} pedido(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
