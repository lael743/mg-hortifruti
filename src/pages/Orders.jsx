import React, { useState, useMemo } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Package, RefreshCw, ChevronDown, Calendar, X, Eye } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { addToCart, clearCart } from '@/lib/cartStore';
import { toast } from 'sonner';

const statusColors = {
  Pendente: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  Confirmado: 'bg-blue-100 text-blue-800 border-blue-200',
  Entregue: 'bg-green-100 text-green-800 border-green-200',
  Cancelado: 'bg-red-100 text-red-800 border-red-200',
};

export default function Orders() {
  const { user } = useOutletContext();
  const navigate = useNavigate();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['my-orders', user?.email],
    queryFn: () => base44.entities.Order.filter({ customer_email: user.email }, '-created_date'),
    enabled: !!user,
  });

  if (!user) {
    navigate('/');
    return null;
  }

  const [expandedOrder, setExpandedOrder] = useState(null);
  const [dateFilter, setDateFilter] = useState('all');

  const handleRepeatOrder = (order) => {
    clearCart();
    order.items.forEach(item => {
      addToCart({
        id: item.product_id,
        name: item.product_name,
        price: item.unit_price,
        packaging_type: item.packaging_type,
        weight: item.weight,
        image_url: item.image_url,
      }, item.quantity);
    });
    toast.success('Itens adicionados ao carrinho!');
    navigate('/cart');
  };

  const filteredOrders = useMemo(() => {
    if (dateFilter === 'all') return orders;
    const now = new Date();
    const startDate = startOfMonth(subMonths(now, parseInt(dateFilter)));
    const endDate = endOfMonth(now);
    return orders.filter(o => {
      const orderDate = new Date(o.created_date);
      return orderDate >= startDate && orderDate <= endDate;
    });
  }, [orders, dateFilter]);

  return (
    <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold">Meus Pedidos</h1>
        <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-1.5 border">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="bg-transparent text-sm font-medium outline-none cursor-pointer"
          >
            <option value="all">Todos</option>
            <option value="0">Este mês</option>
            <option value="1">Últimos 2 meses</option>
            <option value="3">Últimos 4 meses</option>
            <option value="6">Últimos 7 meses</option>
            <option value="12">Últimos 13 meses</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array(3).fill(0).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="text-center py-16">
          <Package className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">Você ainda não fez nenhum pedido.</p>
          <Button className="mt-4" onClick={() => navigate('/')}>Ver Catálogo</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map(order => (
            <Card key={order.id} className="overflow-hidden">
              <button
                onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                className="w-full p-4 flex items-start justify-between hover:bg-muted/30 transition-colors text-left"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm">Pedido #{order.order_number || order.id.slice(-6)}</p>
                    <Badge className={`${statusColors[order.status]} border text-xs`}>
                      {order.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(new Date(order.created_date), "dd 'de' MMM, yyyy", { locale: ptBR })} • {order.items?.length || 0} itens
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="font-bold text-primary">R$ {order.total?.toFixed(2)}</span>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${expandedOrder === order.id ? 'rotate-180' : ''}`} />
                </div>
              </button>

              {expandedOrder === order.id && (
                <div className="border-t p-4 space-y-3">
                  <div className="space-y-2">
                    {order.items?.map((item, idx) => (
                      <div key={idx} className="flex gap-3">
                        {item.image_url && (
                          <img src={item.image_url} alt={item.product_name} className="w-16 h-16 rounded object-cover flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{item.quantity}x {item.product_name}</p>
                          <p className="text-xs text-muted-foreground">{item.packaging_type}{item.weight && ` • ${item.weight}`}</p>
                          <p className="font-semibold text-sm text-primary mt-1">R$ {(item.unit_price * item.quantity).toFixed(2)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  {order.notes && (
                    <div className="p-2 bg-muted rounded text-xs text-muted-foreground">
                      <strong>Obs:</strong> {order.notes}
                    </div>
                  )}
                  <div className="flex gap-2 pt-2 border-t">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => navigate(`/orders/${order.id}`)}>
                      <Eye className="w-4 h-4 mr-1" />Ver detalhes completos
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => handleRepeatOrder(order)}>
                      <RefreshCw className="w-4 h-4 mr-1" />Repetir pedido
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}