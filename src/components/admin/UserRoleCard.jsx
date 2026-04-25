import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Shield, User } from 'lucide-react';

export default function UserRoleCard({ user, currentUserEmail }) {
  const queryClient = useQueryClient();

  const roleMutation = useMutation({
    mutationFn: ({ id, role }) => base44.entities.User.update(id, { role }),
    onSuccess: (_, { role }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-clients'] });
      toast.success(`Cargo atualizado para "${role === 'admin' ? 'Administrador' : 'Cliente'}"`);
    },
    onError: () => toast.error('Erro ao atualizar cargo.'),
  });

  const isCurrentUser = user.email === currentUserEmail;

  return (
    <Card className="p-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0">
          {user.role === 'admin'
            ? <Shield className="w-4 h-4 text-primary" />
            : <User className="w-4 h-4 text-muted-foreground" />}
        </div>
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">{user.full_name || '—'}</p>
          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          {user.company_name && (
            <p className="text-xs text-muted-foreground truncate">{user.company_name}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {isCurrentUser ? (
          <Badge variant="outline" className="text-xs">Você</Badge>
        ) : (
          <Select
            value={user.role || 'user'}
            onValueChange={(role) => roleMutation.mutate({ id: user.id, role })}
            disabled={roleMutation.isPending}
          >
            <SelectTrigger className="w-36 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="user">Cliente</SelectItem>
              <SelectItem value="admin">Administrador</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>
    </Card>
  );
}