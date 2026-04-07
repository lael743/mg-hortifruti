import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, UserPlus, Phone, MapPin, Building2 } from 'lucide-react';
import InviteClientDialog from '../../components/admin/InviteClientDialog';

export default function AdminClients() {
  const [search, setSearch] = useState('');
  const [showInvite, setShowInvite] = useState(false);

  const { data: users = [], isLoading, refetch } = useQuery({
    queryKey: ['admin-clients'],
    queryFn: () => base44.entities.User.list(),
  });

  const clients = users.filter(u => u.role !== 'admin');

  const filtered = clients.filter(u => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.company_name?.toLowerCase().includes(q) || u.city?.toLowerCase().includes(q));
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar cliente..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Button className="bg-primary text-primary-foreground" onClick={() => setShowInvite(true)}>
          <UserPlus className="w-4 h-4 mr-1" />Convidar
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">Nenhum cliente encontrado.</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(client => (
            <Card key={client.id} className="p-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-primary">
                    {(client.full_name || client.email || '?')[0].toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm truncate">{client.full_name || client.email}</h3>
                  <p className="text-xs text-muted-foreground">{client.email}</p>
                  <div className="flex flex-wrap gap-3 mt-1.5">
                    {client.company_name && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Building2 className="w-3 h-3" />{client.company_name}
                      </span>
                    )}
                    {client.whatsapp && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Phone className="w-3 h-3" />{client.whatsapp}
                      </span>
                    )}
                    {client.city && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="w-3 h-3" />{client.city}
                      </span>
                    )}
                  </div>
                </div>
                <Badge variant="secondary" className="text-xs">{client.role || 'client'}</Badge>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showInvite && <InviteClientDialog onClose={() => setShowInvite(false)} onInvited={() => { setShowInvite(false); refetch(); }} />}
    </div>
  );
}