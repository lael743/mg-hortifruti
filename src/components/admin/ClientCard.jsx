import React, { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Phone, MapPin, Building2, Pencil, Check, X, FileText,
  TrendingUp, ShoppingBag, Star, ChevronDown, ChevronUp,
  Package, Calendar,
} from 'lucide-react';

const orderStatusColors = {
  Pendente: 'bg-yellow-100 text-yellow-800',
  Confirmado: 'bg-blue-100 text-blue-800',
  Entregue: 'bg-green-100 text-green-800',
  Cancelado: 'bg-red-100 text-red-800',
};

const clientStatusColors = {
  pending:  'bg-yellow-100 text-yellow-800 border-yellow-200',
  approved: 'bg-green-100 text-green-800 border-green-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
};

const statusLabel = { pending: 'Pendente', approved: 'Aprovado', rejected: 'Rejeitado' };

function OrderHistoryItem({ order }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-muted/50 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium">{format(new Date(order.created_date), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${orderStatusColors[order.status] || 'bg-muted text-muted-foreground'}`}>{order.status}</span>
          <span className="text-xs text-muted-foreground">{order.items?.length || 0} itens</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-primary">R$ {order.total?.toFixed(2)}</span>
          {open ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
        </div>
      </button>
      {open && (
        <div className="px-3 pb-3 pt-1 bg-muted/20 space-y-1 border-t">
          {order.items?.map((item, idx) => {
            const ep = item.final_unit_price ?? item.unit_price;
            return (
              <div key={idx} className="flex justify-between text-xs">
                <span className="text-foreground">{item.quantity}x <strong>{item.product_name}</strong> <span className="text-muted-foreground">({item.packaging_type}{item.weight && ` • ${item.weight}`})</span></span>
                <span className="font-medium">R$ {(ep * item.quantity).toFixed(2)}</span>
              </div>
            );
          })}
          {order.notes && <p className="text-xs text-muted-foreground italic mt-1 border-t pt-1">Obs: {order.notes}</p>}
        </div>
      )}
    </div>
  );
}

export default function ClientCard({ client, showActions, orders, expandedClient, setExpandedClient, onApprove, onReject, onEdit }) {
  const stats = orders.reduce((acc, o) => {
    if (o.customer_email !== client.email) return acc;
    acc.total += o.total || 0;
    acc.count += 1;
    const d = new Date(o.created_date);
    if (!acc.lastOrder || d > new Date(acc.lastOrder)) acc.lastOrder = o.created_date;
    return acc;
  }, { total: 0, count: 0, lastOrder: null });

  const hasStats = stats.count > 0;

  const clientOrders = orders
    .filter(o => o.customer_email === client.email)
    .sort((a, b) => new Date(b.created_date) - new Date(a.created_date));

  const productMap = {};
  clientOrders.forEach(o => {
    o.items?.forEach(item => {
      const ep = item.final_unit_price ?? item.unit_price;
      if (!productMap[item.product_name]) productMap[item.product_name] = { name: item.product_name, qty: 0, total: 0 };
      productMap[item.product_name].qty += item.quantity;
      productMap[item.product_name].total += ep * item.quantity;
    });
  });
  const topProducts = Object.values(productMap).sort((a, b) => b.qty - a.qty).slice(0, 5);
  const isExpanded = expandedClient === client.id;

  return (
    <Card className="p-4">
      <div className="flex flex-col">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="text-sm font-bold text-primary">
              {(client.company_name || client.full_name || client.email || '?')[0].toUpperCase()}
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-sm">{client.company_name || client.full_name || '(sem nome)'}</h3>
              {client.company_name && client.full_name && (
                <span className="text-xs text-muted-foreground">({client.full_name})</span>
              )}
              <Badge className={`${clientStatusColors[client.status || 'pending']} border text-[10px]`}>
                {statusLabel[client.status || 'pending']}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">{client.email}</p>

            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
              {client.company_name && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Building2 className="w-3 h-3" />{client.company_name}
                </span>
              )}
              {client.cnpj_cpf && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <FileText className="w-3 h-3" />{client.cnpj_cpf}
                </span>
              )}
              {client.whatsapp && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Phone className="w-3 h-3" />{client.whatsapp}
                </span>
              )}
              {(client.city || client.state) && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin className="w-3 h-3" />{[client.city, client.state].filter(Boolean).join(' - ')}
                </span>
              )}
              {client.address && <span className="text-xs text-muted-foreground">{client.address}</span>}
            </div>

            {hasStats && (
              <div className="flex flex-wrap gap-3 mt-2 pt-2 border-t border-border/50">
                <span className="flex items-center gap-1 text-xs font-semibold text-primary">
                  <TrendingUp className="w-3 h-3" />R$ {stats.total.toFixed(2)}
                </span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <ShoppingBag className="w-3 h-3" />{stats.count} pedido{stats.count !== 1 ? 's' : ''}
                </span>
                {stats.lastOrder && (
                  <span className="text-xs text-muted-foreground">
                    Último: {new Date(stats.lastOrder).toLocaleDateString('pt-BR')}
                  </span>
                )}
              </div>
            )}
            {client.notes && (
              <p className="text-xs text-muted-foreground italic mt-2 border-l-2 border-border pl-2">{client.notes}</p>
            )}
          </div>

          <div className="flex flex-col gap-1 flex-shrink-0 items-center">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setExpandedClient(isExpanded ? null : client.id)}>
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(client)}>
              <Pencil className="w-4 h-4" />
            </Button>
            {showActions && (
              <>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50" onClick={() => onApprove(client)}>
                  <Check className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-red-50" onClick={() => onReject(client)}>
                  <X className="w-4 h-4" />
                </Button>
              </>
            )}
            {!showActions && client.status === 'approved' && (
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-red-50" onClick={() => onReject(client)}>
                <X className="w-4 h-4" />
              </Button>
            )}
            {!showActions && client.status === 'rejected' && (
              <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:bg-green-50" onClick={() => onApprove(client)}>
                <Check className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-4 pt-4 border-t space-y-4">
          {topProducts.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                <Package className="w-3.5 h-3.5" /> Produtos mais comprados
              </h4>
              <div className="flex flex-wrap gap-2">
                {topProducts.map((p, i) => (
                  <div key={p.name} className="flex items-center gap-1.5 bg-primary/5 border border-primary/10 rounded-lg px-3 py-1.5">
                    <span className="text-xs font-bold text-primary">{i + 1}.</span>
                    <span className="text-xs font-medium">{p.name}</span>
                    <span className="text-[10px] text-muted-foreground bg-muted rounded-full px-1.5 py-0.5">{p.qty}x</span>
                    <span className="text-[10px] text-primary font-semibold">R$ {p.total.toFixed(0)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" /> Histórico de pedidos ({clientOrders.length})
            </h4>
            {clientOrders.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum pedido registrado.</p>
            ) : (
              <div className="space-y-2">
                {clientOrders.map(order => (
                  <OrderHistoryItem key={order.id} order={order} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}