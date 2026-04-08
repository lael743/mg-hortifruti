import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Search, UserPlus, Phone, MapPin, Building2, Pencil, Check, X, FileText, Clock, TrendingUp, ShoppingBag, Star } from 'lucide-react';
import InviteClientDialog from '../../components/admin/InviteClientDialog';
import ClientFormDialog from '../../components/admin/ClientFormDialog';
import { toast } from 'sonner';

const statusColors = {
  pending:  'bg-yellow-100 text-yellow-800 border-yellow-200',
  approved: 'bg-green-100 text-green-800 border-green-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
};

const statusLabel = { pending: 'Pendente', approved: 'Aprovado', rejected: 'Rejeitado' };

export default function AdminClients() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [editClient, setEditClient] = useState(null);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin-clients'],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: orders = [] } = useQuery({
    queryKey: ['admin-orders'],
    queryFn: () => base44.entities.Order.list(),
  });

  // Build stats per client email
  const statsByEmail = orders.reduce((acc, o) => {
    if (!acc[o.customer_email]) acc[o.customer_email] = { total: 0, count: 0, lastOrder: null };
    acc[o.customer_email].total += o.total || 0;
    acc[o.customer_email].count += 1;
    const d = new Date(o.created_date);
    if (!acc[o.customer_email].lastOrder || d > new Date(acc[o.customer_email].lastOrder)) {
      acc[o.customer_email].lastOrder = o.created_date;
    }
    return acc;
  }, {});

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.User.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-clients'] });
    },
  });

  const handleApprove = (client) => {
    updateMutation.mutate({ id: client.id, data: { status: 'approved' } });
    toast.success(`${client.full_name || client.email} aprovado!`);
  };

  const handleReject = (client) => {
    updateMutation.mutate({ id: client.id, data: { status: 'rejected' } });
    toast.error(`${client.full_name || client.email} rejeitado.`);
  };

  const clients = users.filter(u => u.role !== 'admin');
  const pending  = clients.filter(u => (u.status || 'pending') === 'pending');
  const approved = clients.filter(u => u.status === 'approved');
  const rejected = clients.filter(u => u.status === 'rejected');

  const filterList = (list) => list.filter(u => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      u.full_name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.company_name?.toLowerCase().includes(q) ||
      u.city?.toLowerCase().includes(q) ||
      u.cnpj_cpf?.toLowerCase().includes(q)
    );
  });

  const ClientCard = ({ client, showActions }) => {
    const stats = statsByEmail[client.email];
    return (
    <Card key={client.id} className="p-4">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
          <span className="text-sm font-bold text-primary">
            {(client.full_name || client.email || '?')[0].toUpperCase()}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-sm">{client.full_name || '(sem nome)'}</h3>
            <Badge className={`${statusColors[client.status || 'pending']} border text-[10px]`}>
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
            {client.address && (
              <span className="text-xs text-muted-foreground">{client.address}</span>
            )}
          </div>

          {stats && (
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
        <div className="flex flex-col gap-1 flex-shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditClient(client)}>
            <Pencil className="w-4 h-4" />
          </Button>
          {showActions && (
            <>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50" onClick={() => handleApprove(client)}>
                <Check className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-red-50" onClick={() => handleReject(client)}>
                <X className="w-4 h-4" />
              </Button>
            </>
          )}
          {!showActions && client.status === 'approved' && (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-red-50" onClick={() => handleReject(client)}>
              <X className="w-4 h-4" />
            </Button>
          )}
          {!showActions && client.status === 'rejected' && (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:bg-green-50" onClick={() => handleApprove(client)}>
              <Check className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
  };

  // Top clients by total spend
  const topClients = [...clients]
    .filter(c => statsByEmail[c.email])
    .sort((a, b) => (statsByEmail[b.email]?.total || 0) - (statsByEmail[a.email]?.total || 0))
    .slice(0, 10);

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome, email, empresa, CNPJ..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Button className="bg-primary text-primary-foreground shrink-0" onClick={() => setShowInvite(true)}>
          <UserPlus className="w-4 h-4 mr-1" />Convidar
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      ) : (
        <Tabs defaultValue="pending">
          <TabsList className="w-full">
            <TabsTrigger value="top" className="flex-1 gap-1.5">
              <Star className="w-3.5 h-3.5" />Melhores
            </TabsTrigger>
            <TabsTrigger value="pending" className="flex-1 gap-1.5">
              <Clock className="w-3.5 h-3.5" />Pendentes
              {pending.length > 0 && (
                <span className="bg-yellow-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{pending.length}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="approved" className="flex-1 gap-1.5">
              <Check className="w-3.5 h-3.5" />Aprovados
              <span className="bg-muted text-muted-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">{approved.length}</span>
            </TabsTrigger>
            <TabsTrigger value="rejected" className="flex-1 gap-1.5">
              <X className="w-3.5 h-3.5" />Rejeitados
              <span className="bg-muted text-muted-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">{rejected.length}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="top" className="mt-4 space-y-3">
            {topClients.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">Nenhum pedido registrado ainda.</div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-muted/50 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-primary">{clients.filter(c => statsByEmail[c.email]).length}</p>
                    <p className="text-xs text-muted-foreground mt-1">Clientes ativos</p>
                  </div>
                  <div className="bg-muted/50 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-primary">R$ {Object.values(statsByEmail).reduce((s, v) => s + v.total, 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                    <p className="text-xs text-muted-foreground mt-1">Total faturado</p>
                  </div>
                  <div className="bg-muted/50 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-primary">{orders.length}</p>
                    <p className="text-xs text-muted-foreground mt-1">Pedidos totais</p>
                  </div>
                </div>
                {topClients.map((c, idx) => (
                  <div key={c.id} className="flex items-center gap-3">
                    <span className={`w-6 text-center font-bold text-sm ${idx < 3 ? 'text-accent' : 'text-muted-foreground'}`}>{idx + 1}</span>
                    <div className="flex-1"><ClientCard client={c} showActions={false} /></div>
                  </div>
                ))}
              </>
            )}
          </TabsContent>

          <TabsContent value="pending" className="mt-4 space-y-3">
            {filterList(pending).length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Clock className="w-10 h-10 mx-auto mb-2 opacity-20" />
                <p>Nenhum cadastro pendente.</p>
              </div>
            ) : filterList(pending).map(c => <ClientCard key={c.id} client={c} showActions />)}
          </TabsContent>

          <TabsContent value="approved" className="mt-4 space-y-3">
            {filterList(approved).length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">Nenhum cliente aprovado.</div>
            ) : filterList(approved).map(c => <ClientCard key={c.id} client={c} showActions={false} />)}
          </TabsContent>

          <TabsContent value="rejected" className="mt-4 space-y-3">
            {filterList(rejected).length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">Nenhum cadastro rejeitado.</div>
            ) : filterList(rejected).map(c => <ClientCard key={c.id} client={c} showActions={false} />)}
          </TabsContent>
        </Tabs>
      )}

      {showInvite && (
        <InviteClientDialog
          onClose={() => setShowInvite(false)}
          onInvited={() => { setShowInvite(false); queryClient.invalidateQueries({ queryKey: ['admin-clients'] }); }}
        />
      )}

      {editClient && (
        <ClientFormDialog
          client={editClient}
          onClose={() => setEditClient(null)}
          onSaved={() => { setEditClient(null); queryClient.invalidateQueries({ queryKey: ['admin-clients'] }); }}
        />
      )}
    </div>
  );
}