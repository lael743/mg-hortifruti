import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Printer, Eye, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

const statusColors = {
  Pendente: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  Confirmado: 'bg-blue-100 text-blue-800 border-blue-200',
  Entregue: 'bg-green-100 text-green-800 border-green-200',
  Cancelado: 'bg-red-100 text-red-800 border-red-200',
};

const STATUSES = ['Todos', 'Pendente', 'Confirmado', 'Entregue', 'Cancelado'];

export default function AdminOrders() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [expandedOrder, setExpandedOrder] = useState(null);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['admin-orders'],
    queryFn: () => base44.entities.Order.list('-created_date'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }) => base44.entities.Order.update(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      toast.success('Status atualizado');
    },
  });

  const filtered = orders.filter(o => {
    const matchSearch = !search ||
      o.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      o.customer_email?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'Todos' || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handlePrintSeparation = (order) => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html><head><title>Lista de Separação - Pedido ${order.id}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 24px; }
        h1 { font-size: 18px; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th, td { padding: 10px; text-align: left; border: 1px solid #ddd; }
        th { background: #f0f0f0; }
      </style></head><body>
      <h1>Lista de Separação</h1>
      <p>Cliente: <strong>${order.customer_name || order.customer_email}</strong></p>
      <p>Data: ${format(new Date(order.created_date), "dd/MM/yyyy HH:mm")}</p>
      <table>
        <tr><th>Produto</th><th>Embalagem</th><th>Peso</th><th>Qtd</th></tr>
        ${order.items?.map(i => `<tr><td>${i.product_name}</td><td>${i.packaging_type || ''}</td><td>${i.weight || ''}</td><td><strong>${i.quantity}</strong></td></tr>`).join('')}
      </table>
      </body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por cliente..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">Nenhum pedido encontrado.</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(order => (
            <Card key={order.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{order.customer_name || order.customer_email}</span>
                    <Badge className={`${statusColors[order.status]} border text-xs`}>{order.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(new Date(order.created_date), "dd/MM/yyyy HH:mm", { locale: ptBR })} • {order.items?.length || 0} itens
                  </p>
                  <p className="font-bold text-primary mt-1">R$ {order.total?.toFixed(2)}</p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        Status <ChevronDown className="w-3 h-3 ml-1" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      {['Pendente', 'Confirmado', 'Entregue', 'Cancelado'].map(s => (
                        <DropdownMenuItem key={s} onClick={() => updateMutation.mutate({ id: order.id, status: s })}>
                          {s}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handlePrintSeparation(order)}>
                    <Printer className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}>
                    <Eye className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {expandedOrder === order.id && (
                <div className="mt-4 pt-4 border-t space-y-2">
                  {order.items?.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span>{item.quantity}x {item.product_name} <span className="text-muted-foreground">({item.packaging_type} {item.weight && `• ${item.weight}`})</span></span>
                      <span className="font-medium">R$ {(item.unit_price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                  {order.notes && <p className="text-xs text-muted-foreground mt-2 p-2 bg-muted rounded">Obs: {order.notes}</p>}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}