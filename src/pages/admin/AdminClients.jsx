import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Search, UserPlus, Check, X, Clock, Star, Shield } from 'lucide-react';
import InviteClientDialog from '../../components/admin/InviteClientDialog';
import ClientFormDialog from '../../components/admin/ClientFormDialog';
import ClientCard from '../../components/admin/ClientCard';
import UserRoleCard from '../../components/admin/UserRoleCard';
import { toast } from 'sonner';

export default function AdminClients() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [editClient, setEditClient] = useState(null);
  const [expandedClient, setExpandedClient] = useState(null);
  const [currentUserEmail, setCurrentUserEmail] = useState('');

  useEffect(() => {
    base44.auth.me().then(u => setCurrentUserEmail(u?.email || '')).catch(() => {});
  }, []);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin-clients'],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: orders = [] } = useQuery({
    queryKey: ['admin-orders'],
    queryFn: () => base44.entities.Order.list('-created_date'),
  });

  // Build stats per client email (for top clients ranking)
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

  // Todos os usuários exceto o proprietário (usuário logado atual)
  const allUsersExceptOwner = users.filter(u => u.email !== currentUserEmail);
  const clients = allUsersExceptOwner.filter(u => u.role !== 'admin');
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

  const admins = allUsersExceptOwner.filter(u => u.role === 'admin');

  const topClients = [...clients]
    .filter(c => statsByEmail[c.email])
    .sort((a, b) => (statsByEmail[b.email]?.total || 0) - (statsByEmail[a.email]?.total || 0))
    .slice(0, 10);

  const cardProps = (c, showActions) => ({
    client: c,
    showActions,
    orders,
    expandedClient,
    setExpandedClient,
    onApprove: handleApprove,
    onReject: handleReject,
    onEdit: setEditClient,
  });

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
          <TabsList className="w-full flex-wrap h-auto gap-1">
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
            <TabsTrigger value="roles" className="flex-1 gap-1.5">
              <Shield className="w-3.5 h-3.5" />Acessos
              <span className="bg-muted text-muted-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">{allUsersExceptOwner.length}</span>
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
                    <div className="flex-1"><ClientCard {...cardProps(c, false)} /></div>
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
            ) : filterList(pending).map(c => <ClientCard key={c.id} {...cardProps(c, true)} />)}
          </TabsContent>

          <TabsContent value="approved" className="mt-4 space-y-3">
            {filterList(approved).length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">Nenhum cliente aprovado.</div>
            ) : filterList(approved).map(c => <ClientCard key={c.id} {...cardProps(c, false)} />)}
          </TabsContent>

          <TabsContent value="rejected" className="mt-4 space-y-3">
            {filterList(rejected).length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">Nenhum cadastro rejeitado.</div>
            ) : filterList(rejected).map(c => <ClientCard key={c.id} {...cardProps(c, false)} />)}
          </TabsContent>

          <TabsContent value="roles" className="mt-4 space-y-3">
            <p className="text-xs text-muted-foreground pb-1">
              Gerencie o nível de acesso dos usuários.
            </p>
            {allUsersExceptOwner.filter(u => u.role === 'admin' || u.role === 'user').length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">Nenhum usuário encontrado.</div>
            ) : allUsersExceptOwner
                .filter(u => {
                  if (u.role !== 'admin' && u.role !== 'user') return false;
                  if (!search) return true;
                  const q = search.toLowerCase();
                  return u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.company_name?.toLowerCase().includes(q);
                })
                .sort((a, b) => (a.role === 'admin' ? -1 : 1) - (b.role === 'admin' ? -1 : 1))
                .map(u => (
                  <UserRoleCard key={u.id} user={u} currentUserEmail={currentUserEmail} />
                ))}
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