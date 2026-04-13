import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Save, Building2, Clock, Send } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

export default function AdminCampaign() {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const [savingMsg, setSavingMsg] = useState(false);
  const [sending, setSending] = useState(null);

  const { data: settings = [] } = useQuery({
    queryKey: ['company-settings'],
    queryFn: () => base44.entities.CompanySettings.list(),
    onSuccess: (data) => {
      if (data[0]?.whatsapp_campaign_message) {
        setMessage(data[0].whatsapp_campaign_message);
      }
    }
  });

  const company = settings[0];

  // Sync message from settings once loaded
  React.useEffect(() => {
    if (company?.whatsapp_campaign_message && !message) {
      setMessage(company.whatsapp_campaign_message);
    }
  }, [company]);

  const { data: allUsers = [] } = useQuery({
    queryKey: ['users-list'],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: orders = [] } = useQuery({
    queryKey: ['orders-campaign'],
    queryFn: () => base44.entities.Order.list('-created_date', 1000),
  });

  const clients = useMemo(() => {
    const approved = allUsers.filter(u => u.role !== 'admin' && u.approved !== false);

    return approved.map(u => {
      const userOrders = orders.filter(o => o.customer_email === u.email && o.status !== 'Cancelado');
      const lastOrder = userOrders.sort((a, b) => new Date(b.created_date) - new Date(a.created_date))[0];
      const daysSince = lastOrder
        ? Math.floor((new Date() - new Date(lastOrder.created_date)) / 86400000)
        : null;
      const lastCampaign = u.last_whatsapp_campaign_date ? new Date(u.last_whatsapp_campaign_date) : null;

      return {
        ...u,
        lastOrderDate: lastOrder?.created_date || null,
        daysSince,
        lastCampaign,
      };
    }).sort((a, b) => {
      // Never sent → top; then sort by oldest campaign sent
      const aTime = a.lastCampaign ? a.lastCampaign.getTime() : 0;
      const bTime = b.lastCampaign ? b.lastCampaign.getTime() : 0;
      return aTime - bTime;
    });
  }, [allUsers, orders]);

  const handleSaveMessage = async () => {
    if (!company) return;
    setSavingMsg(true);
    await base44.entities.CompanySettings.update(company.id, { whatsapp_campaign_message: message });
    queryClient.invalidateQueries({ queryKey: ['company-settings'] });
    toast.success('Mensagem salva!');
    setSavingMsg(false);
  };

  const handleSendWhatsApp = async (client) => {
    const number = client.whatsapp?.replace(/\D/g, '');
    if (!number) {
      toast.error('WhatsApp não cadastrado para este cliente.');
      return;
    }
    const name = client.contact_name || client.company_name || client.full_name || client.email;
    const text = message
      .replace('{nome}', name)
      .replace('{empresa}', name);
    const url = `https://wa.me/55${number}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');

    // Mark as sent
    setSending(client.id);
    await base44.entities.User.update(client.id, { last_whatsapp_campaign_date: new Date().toISOString() });
    queryClient.invalidateQueries({ queryKey: ['users-list'] });
    setSending(null);
    toast.success(`Mensagem enviada para ${name}`);
  };

  return (
    <div className="space-y-6">
      {/* Message config */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-primary" />
            Mensagem de Campanha
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Use <code className="bg-muted px-1 rounded">{'{nome}'}</code> ou <code className="bg-muted px-1 rounded">{'{empresa}'}</code> para personalizar com o nome do cliente.
          </p>
          <Textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Ex: Olá {nome}! Estamos quase encerrando os pedidos, hoje é dia de fazer seu pedido! 🛒"
            rows={4}
          />
          <Button size="sm" onClick={handleSaveMessage} disabled={savingMsg || !message.trim()}>
            <Save className="w-4 h-4 mr-1" />
            {savingMsg ? 'Salvando...' : 'Salvar mensagem'}
          </Button>
        </CardContent>
      </Card>

      {/* Client list */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" />
            Clientes Aprovados ({clients.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {clients.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum cliente aprovado encontrado.</p>
          ) : (
            <div className="divide-y">
              {clients.map(client => {
                const name = client.company_name || client.full_name || client.email;
                const notSentYet = !client.lastCampaign;
                return (
                  <div key={client.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold truncate">{name}</p>
                        {notSentYet && (
                          <Badge variant="outline" className="text-[10px] border-orange-300 text-orange-600 bg-orange-50">
                            Nunca enviado
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
                        {client.lastOrderDate ? (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Última compra: {format(new Date(client.lastOrderDate), "dd/MM/yyyy", { locale: ptBR })}
                            {client.daysSince !== null && <span className="text-orange-500 font-medium">({client.daysSince}d atrás)</span>}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/60 italic">Sem compras</span>
                        )}
                        {client.lastCampaign && (
                          <span className="text-blue-500">
                            Último envio: {formatDistanceToNow(client.lastCampaign, { locale: ptBR, addSuffix: true })}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      disabled={!client.whatsapp || sending === client.id || !message.trim()}
                      onClick={() => handleSendWhatsApp(client)}
                      className={`flex-shrink-0 gap-1.5 ${client.whatsapp ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-muted text-muted-foreground cursor-not-allowed'}`}
                      title={client.whatsapp ? `WhatsApp: ${client.whatsapp}` : 'WhatsApp não cadastrado'}
                    >
                      <Send className="w-3.5 h-3.5" />
                      {sending === client.id ? 'Enviando...' : 'WhatsApp'}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}