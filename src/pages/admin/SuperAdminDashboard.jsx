import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Eye, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';

export default function SuperAdminDashboard() {
  const [isCreating, setIsCreating] = useState(false);
  const [activeTab, setActiveTab] = useState('pending_approval');
  const [formData, setFormData] = useState({ name: '', subdomain: '', admin_email: '' });

  const { data: tenants = [], refetch, isLoading } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => base44.entities.Tenant.list('-created_date'),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Tenant.create({ ...data, status: 'pending_approval' }),
    onSuccess: () => {
      toast.success('Tenant criado e aguardando aprovação!');
      setFormData({ name: '', subdomain: '', admin_email: '' });
      setIsCreating(false);
      refetch();
    },
  });

  const approveMutation = useMutation({
    mutationFn: (id) => base44.entities.Tenant.update(id, { status: 'active' }),
    onSuccess: () => {
      toast.success('Tenant aprovado!');
      refetch();
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id) => base44.entities.Tenant.update(id, { status: 'rejected' }),
    onSuccess: () => {
      toast.success('Tenant rejeitado');
      refetch();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Tenant.delete(id),
    onSuccess: () => {
      toast.success('Tenant removido!');
      refetch();
    },
  });

  const handleCreate = () => {
    if (!formData.name || !formData.subdomain || !formData.admin_email) {
      toast.error('Preencha todos os campos');
      return;
    }
    if (!/^[a-z0-9-]+$/.test(formData.subdomain)) {
      toast.error('Subdomínio deve conter apenas letras minúsculas, números e hífen');
      return;
    }
    createMutation.mutate(formData);
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'pending_approval': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'active': return 'bg-green-100 text-green-800 border-green-200';
      case 'rejected': return 'bg-red-100 text-red-800 border-red-200';
      case 'suspended': return 'bg-slate-100 text-slate-800 border-slate-200';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const getStatusIcon = (status) => {
    switch(status) {
      case 'pending_approval': return <Clock className="w-4 h-4" />;
      case 'active': return <CheckCircle2 className="w-4 h-4" />;
      case 'rejected': return <XCircle className="w-4 h-4" />;
      default: return null;
    }
  };

  const getStatusLabel = (status) => {
    switch(status) {
      case 'pending_approval': return 'Aguardando Aprovação';
      case 'active': return 'Ativo';
      case 'rejected': return 'Rejeitado';
      case 'suspended': return 'Suspenso';
      default: return status;
    }
  };

  const filteredTenants = activeTab === 'all' 
    ? tenants 
    : tenants.filter(t => t.status === activeTab);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Painel Super Admin</h1>
          <Dialog open={isCreating} onOpenChange={setIsCreating}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="w-4 h-4" />Novo Tenant</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Novo Tenant</DialogTitle>
                <DialogDescription>Cadastre um novo administrador e sua empresa.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <Input
                  placeholder="Nome da empresa"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
                <Input
                  placeholder="Subdomínio (ex: empresaA)"
                  value={formData.subdomain}
                  onChange={(e) => setFormData({ ...formData, subdomain: e.target.value.toLowerCase() })}
                />
                <Input
                  type="email"
                  placeholder="Email do administrador"
                  value={formData.admin_email}
                  onChange={(e) => setFormData({ ...formData, admin_email: e.target.value })}
                />
                <Button onClick={handleCreate} className="w-full" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Criando...' : 'Criar Tenant'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b">
          <button
            onClick={() => setActiveTab('pending_approval')}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === 'pending_approval'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Aguardando Aprovação ({tenants.filter(t => t.status === 'pending_approval').length})
          </button>
          <button
            onClick={() => setActiveTab('active')}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === 'active'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Ativos ({tenants.filter(t => t.status === 'active').length})
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === 'all'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Todos ({tenants.length})
          </button>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Carregando...</div>
        ) : filteredTenants.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">Nenhum tenant encontrado nesta categoria</div>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Subdomínio</TableHead>
                  <TableHead>Admin</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-32">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTenants.map((tenant) => (
                  <TableRow key={tenant.id}>
                    <TableCell className="font-medium">{tenant.name}</TableCell>
                    <TableCell className="font-mono text-sm">{tenant.subdomain}.horta.com.br</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{tenant.admin_email}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Badge className={`${getStatusColor(tenant.status)} border text-xs flex items-center gap-1`}>
                          {getStatusIcon(tenant.status)}
                          {getStatusLabel(tenant.status)}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="flex gap-1">
                      {tenant.status === 'pending_approval' && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-green-600 border-green-200 hover:bg-green-50"
                            onClick={() => approveMutation.mutate(tenant.id)}
                            disabled={approveMutation.isPending}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 border-red-200 hover:bg-red-50"
                            onClick={() => rejectMutation.mutate(tenant.id)}
                            disabled={rejectMutation.isPending}
                          >
                            <XCircle className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      )}
                      {tenant.status === 'active' && (
                        <Button size="icon" variant="ghost" onClick={() => window.open(`https://${tenant.subdomain}.horta.com.br`, '_blank')} title="Visualizar tenant">
                          <Eye className="w-4 h-4" />
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteMutation.mutate(tenant.id)} title="Deletar tenant">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </div>
  );
}