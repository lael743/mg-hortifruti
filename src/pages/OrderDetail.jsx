import React, { useRef } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Printer, RefreshCw } from 'lucide-react';
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

function parseAsUTC(dateInput) {
  if (dateInput instanceof Date) return dateInput;
  let str = String(dateInput);
  if (!str.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(str)) {
    str = str + 'Z';
  }
  return new Date(str);
}

export default function OrderDetail() {
  const { user } = useOutletContext();
  const navigate = useNavigate();
  const printRef = useRef();
  const urlParams = new URLSearchParams(window.location.search);
  const pathParts = window.location.pathname.split('/');
  const orderId = pathParts[pathParts.length - 1];

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['order-detail', orderId],
    queryFn: () => base44.entities.Order.filter({ id: orderId }),
    enabled: !!orderId,
  });

  const order = orders[0];

  const { data: salespersons = [] } = useQuery({
    queryKey: ['salespersons'],
    queryFn: () => base44.entities.Salesperson.list(),
  });

  // Busca o salesperson_id do usuário atual para encontrar o vendedor
  const salespersonId = user?.salesperson_id;
  const salesperson = salespersonId ? salespersons.find(s => s.id === salespersonId) : null;

  const handlePrint = () => {
    const content = printRef.current;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html><head><title>Pedido #${order?.order_number || order?.id.slice(-6)}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 24px; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #eee; }
        th { background: #f5f5f5; font-weight: 600; }
        .total { font-size: 18px; font-weight: bold; text-align: right; margin-top: 16px; }
        .header { margin-bottom: 24px; }
      </style></head><body>
      ${content.innerHTML}
      <style>a { color: inherit; text-decoration: none; }</style>
      </body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const handleRepeatOrder = () => {
    if (!order) return;
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

  if (isLoading) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-6">
        <Skeleton className="h-64 rounded-xl" />
      </main>
    );
  }

  if (!order) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-16 text-center">
        <p className="text-muted-foreground">Pedido não encontrado.</p>
        <Button className="mt-4" onClick={() => navigate('/orders')}>
          <ArrowLeft className="w-4 h-4 mr-2" />Voltar
        </Button>
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate('/orders')}>
          <ArrowLeft className="w-4 h-4 mr-1" />Voltar
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRepeatOrder}>
            <RefreshCw className="w-4 h-4 mr-1" />Repetir
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-1" />Imprimir
          </Button>
        </div>
      </div>

      <div ref={printRef}>
        <Card className="p-6">
          <div className="header flex items-start justify-between mb-6">
            <div>
              <h1 className="text-xl font-bold">Pedido #{order.order_number || order.id.slice(-6)}</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {format(parseAsUTC(order.created_date), "dd 'de' MMMM, yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
              {order.customer_name && (
                <p className="text-sm mt-2">Cliente: <strong>{order.customer_name}</strong></p>
              )}
              {salesperson && (
                <p className="text-sm mt-1 text-muted-foreground">
                  Vendedor: <strong className="text-foreground">{salesperson.name}</strong>
                  {salesperson.whatsapp && (
                    <a
                      href={`https://wa.me/55${salesperson.whatsapp.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 text-green-600 hover:underline text-xs"
                    >
                      📱 {salesperson.whatsapp}
                    </a>
                  )}
                </p>
              )}
            </div>
            <Badge className={`${statusColors[order.status]} border`}>
              {order.status}
            </Badge>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 font-semibold">Produto</th>
                <th className="text-center py-2 font-semibold">Qtd</th>
                <th className="text-right py-2 font-semibold">Unit.</th>
                <th className="text-right py-2 font-semibold">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {order.items?.map((item, idx) => (
                <tr key={idx} className="border-b border-border/50">
                  <td className="py-3">
                    <span className="font-medium">{item.product_name}</span>
                    <br />
                    <span className="text-xs text-muted-foreground">{item.packaging_type} {item.weight && `• ${item.weight}`}</span>
                  </td>
                  <td className="text-center py-3">{item.quantity}</td>
                  <td className="text-right py-3">R$ {(item.final_unit_price ?? item.unit_price)?.toFixed(2)}</td>
                  <td className="text-right py-3 font-semibold">R$ {((item.final_unit_price ?? item.unit_price) * item.quantity).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4 pt-4 border-t space-y-1">
            {order.discount_amount > 0 && (
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Subtotal dos itens:</span>
                <span>R$ {(order.subtotal ?? (order.total + order.discount_amount)).toFixed(2)}</span>
              </div>
            )}
            {order.discount_amount > 0 && (
              <div className="flex justify-between text-sm text-green-700 font-medium">
                <span>🏷️ Desconto{order.discount_type === 'percent' ? ` (${order.discount_value}%)` : ''}:</span>
                <span>− R$ {order.discount_amount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between total">
              <span className="font-bold">Total:</span>
              <span className="text-2xl font-extrabold text-primary">R$ {order.total?.toFixed(2)}</span>
            </div>
          </div>

          {order.notes && (
            <div className="mt-4 p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground"><strong>Observações:</strong> {order.notes}</p>
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}