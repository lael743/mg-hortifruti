import React from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Package, RefreshCw, Eye } from 'lucide-react';
import { format } from 'date-fns';
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

  const handleRepeatOrder = (order) => {
    clearCart();
    order.items.forEach(item => {
      addToCart({
        id: item.product_id,
        name: item.product_name,
        price: item.unit_price,
        packaging_type: item.packaging_type,
        weight: item.weight,
      }, item.quantity);
    });
    toast.success('Itens adicionados ao carrinho!');
    navigate('/cart');
  };

  return (
    <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-2xl font-bold">Meus Pedidos</h1>

      {isLoading ? (
        <div className="space-y-4">
          {Array(3).fill(0).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16">
          <Package className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">Você ainda não fez nenhum pedido.</p>
          <Button className="mt-4" onClick={() => navigate('/')}>Ver Catálogo</Button>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map(order => (
            <Card key={order.id} className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(order.created_date), "dd 'de' MMMM, yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">Pedido #{order.order_number || order.id.slice(-6)}</p>
                  </div>
                <Badge className={`${statusColors[order.status]} border`}>
                  {order.status}
                </Badge>
              </div>

              <div className="space-y-1 mb-3">
                {order.items?.slice(0, 3).map((item, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{item.quantity}x {item.product_name}</span>
                    <span className="font-medium">R$ {(item.unit_price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
                {order.items?.length > 3 && (
                  <p className="text-xs text-muted-foreground">+ {order.items.length - 3} itens</p>
                )}
              </div>

              <div className="flex items-center justify-between pt-3 border-t">
                <span className="font-bold text-lg text-primary">R$ {order.total?.toFixed(2)}</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => navigate(`/orders/${order.id}`)}>
                    <Eye className="w-4 h-4 mr-1" />Detalhes
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleRepeatOrder(order)}>
                    <RefreshCw className="w-4 h-4 mr-1" />Repetir
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}