import React, { useState, useMemo } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Package, RefreshCw, Calendar, Eye, Search, X, Filter, Trash2 } from 'lucide-react';
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

const statusDot = {
  Pendente: 'bg-yellow-400',
  Confirmado: 'bg-blue-400',
  Entregue: 'bg-green-500',
  Cancelado: 'bg-red-400',
};

export default function Orders() {
  const { user } = useOutletContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(null);

  const deleteMutation = useMutation({
    mutationFn: (orderId) => base44.entities.Order.delete(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-orders'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      queryClient.invalidateQueries({ queryKey: ['contas-a-receber'] });
      setConfirmDelete(null);
      toast.success('Pedido excluído com sucesso.');
    },
  });

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['my-orders', user?.email],
    queryFn: () => base44.entities.Order.filter({ customer_email: user.email }, '-created_date'),
    enabled: !!user,
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list(),
  });

  const { data: priceGroups = [] } = useQuery({
    queryKey: ['price-groups'],
    queryFn: () => base44.entities.PriceGroup.list(),
    enabled: !!user,
  });

  const { data: customPrices = [] } = useQuery({
    queryKey: ['custom-prices'],
    queryFn: () => base44.entities.CustomPrice.list(),
    enabled: !!user,
  });

  const [dateFilter, setDateFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  const handleRepeatOrder = (order) => {
    // Build a map of current products for quick lookup
    const productMap = Object.fromEntries(products.map(p => [p.id, p]));

    // Find user's price group
    const userPriceGroup = priceGroups.find(pg => pg.id === user?.price_group_id);
    const isCustomTable = userPriceGroup?.type === 'custom';
    const discount = userPriceGroup?.discount_percent || 0;

    // Build custom price map if applicable
    const customPriceMap = {};
    if (isCustomTable && userPriceGroup) {
      customPrices
        .filter(cp => cp.price_group_id === userPriceGroup.id)
        .forEach(cp => { customPriceMap[cp.product_id] = cp.custom_price; });
    }

    clearCart();
    order.items.forEach(item => {
      const currentProduct = productMap[item.product_id];
      let currentPrice = item.unit_price; // fallback to old price if product not found

      if (currentProduct) {
        const basePrice = currentProduct.promo_active && currentProduct.promo_price
          ? currentProduct.promo_price
          : currentProduct.price || 0;

        if (isCustomTable) {
          currentPrice = customPriceMap[item.product_id] !== undefined
            ? customPriceMap[item.product_id]
            : currentProduct.price || 0;
        } else {
          currentPrice = basePrice * (1 - discount / 100);
        }
      }

      addToCart({
        id: item.product_id,
        name: item.product_name,
        price: currentPrice,
        packaging_type: item.packaging_type,
        weight: item.weight,
        image_url: currentProduct?.image_url || item.image_url,
      }, item.quantity);
    });
    toast.success('Itens adicionados ao carrinho com preços atualizados!');
    navigate('/cart');
  };

  const filteredOrders = useMemo(() => {
    let result = orders;

    // Date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      const startDate = startOfMonth(subMonths(now, parseInt(dateFilter)));
      const endDate = endOfMonth(now);
      result = result.filter(o => {
        const d = new Date(o.created_date);
        return d >= startDate && d <= endDate;
      });
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(o => o.status === statusFilter);
    }

    // Search by order number
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(o => {
        const num = String(o.order_number || o.id.slice(-6)).toLowerCase();
        return num.includes(q);
      });
    }

    return result;
  }, [orders, dateFilter, statusFilter, search]);

  const hasFilters = dateFilter !== 'all' || statusFilter !== 'all' || search.trim();

  const clearFilters = () => {
    setDateFilter('all');
    setStatusFilter('all');
    setSearch('');
  };

  // Summary stats
  const stats = useMemo(() => {
    const total = orders.reduce((s, o) => s + (o.total || 0), 0);
    const delivered = orders.filter(o => o.status === 'Entregue').length;
    const pending = orders.filter(o => o.status === 'Pendente' || o.status === 'Confirmado').length;
    return { count: orders.length, total, delivered, pending };
  }, [orders]);

  if (!user) { navigate('/'); return null; }

  return (
    <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Meus Pedidos</h1>
        <p className="text-muted-foreground text-sm mt-1">Acompanhe e gerencie seus pedidos</p>
      </div>

      {/* Stats */}
      {!isLoading && orders.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total de pedidos', value: stats.count },
            { label: 'Entregues', value: stats.delivered },
            { label: 'Em andamento', value: stats.pending },
          ].map(s => (
            <div key={s.label} className="bg-muted/50 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-primary">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="space-y-2">
        <div className="flex gap-2 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9 h-9"
              placeholder="Nº do pedido..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Date */}
          <div className="flex items-center gap-1.5 bg-muted rounded-lg px-3 h-9 border">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <select
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value)}
              className="bg-transparent text-sm outline-none cursor-pointer"
            >
              <option value="all">Qualquer data</option>
              <option value="0">Este mês</option>
              <option value="1">Últimos 2 meses</option>
              <option value="3">Últimos 4 meses</option>
              <option value="6">Últimos 7 meses</option>
            </select>
          </div>

          {/* Status */}
          <div className="flex items-center gap-1.5 bg-muted rounded-lg px-3 h-9 border">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="bg-transparent text-sm outline-none cursor-pointer"
            >
              <option value="all">Todos os status</option>
              <option value="Pendente">Pendente</option>
              <option value="Confirmado">Confirmado</option>
              <option value="Entregue">Entregue</option>
              <option value="Cancelado">Cancelado</option>
            </select>
          </div>

          {hasFilters && (
            <button onClick={clearFilters} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors px-2">
              <X className="w-4 h-4" /> Limpar
            </button>
          )}
        </div>
        {hasFilters && (
          <p className="text-xs text-muted-foreground">{filteredOrders.length} pedido(s) encontrado(s)</p>
        )}
      </div>

      {/* Orders list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="text-center py-16">
          <Package className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">
            {hasFilters ? 'Nenhum pedido encontrado com esses filtros.' : 'Você ainda não fez nenhum pedido.'}
          </p>
          {hasFilters
            ? <Button variant="outline" className="mt-4" onClick={clearFilters}>Limpar filtros</Button>
            : <Button className="mt-4" onClick={() => navigate('/')}>Ver Catálogo</Button>
          }
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map(order => (
            <Card key={order.id} className="overflow-hidden hover:shadow-md transition-shadow">
              <div className="p-4">
                {/* Top row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-base">Pedido #{order.order_number || order.id.slice(-6)}</span>
                      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full border ${statusColors[order.status]}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${statusDot[order.status]}`} />
                        {order.status}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(order.created_date), "dd 'de' MMM, yyyy", { locale: ptBR })}
                      {' · '}
                      {order.items?.length || 0} {order.items?.length === 1 ? 'item' : 'itens'}
                    </p>
                  </div>
                  <span className="font-extrabold text-lg text-primary whitespace-nowrap">
                    R$ {order.total?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                {/* Items preview */}
                <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                  {order.items?.slice(0, 4).map((item, idx) => (
                    <div key={idx} className="flex-shrink-0 flex items-center gap-1.5 bg-muted/60 rounded-lg px-2.5 py-1.5 text-xs">
                      <span className="font-semibold">{item.quantity}x</span>
                      <span className="text-muted-foreground max-w-[80px] truncate">{item.product_name}</span>
                    </div>
                  ))}
                  {(order.items?.length || 0) > 4 && (
                    <div className="flex-shrink-0 flex items-center bg-muted/60 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground">
                      +{order.items.length - 4} mais
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 mt-3 pt-3 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => navigate(`/orders/${order.id}`)}
                  >
                    <Eye className="w-4 h-4" />Ver detalhes
                  </Button>
                  <Button
                    size="sm"
                    className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={() => handleRepeatOrder(order)}
                  >
                    <RefreshCw className="w-4 h-4" />Repetir pedido
                  </Button>
                  {confirmDelete === order.id ? (
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="destructive"
                        className="gap-1"
                        disabled={deleteMutation.isPending}
                        onClick={() => deleteMutation.mutate(order.id)}
                      >
                        Confirmar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setConfirmDelete(null)}>
                        Cancelar
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive px-2"
                      onClick={() => setConfirmDelete(order.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}