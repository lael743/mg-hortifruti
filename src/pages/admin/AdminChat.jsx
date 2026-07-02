import React, { useState, useEffect, useRef, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Send, Loader2, User, Trash2, X, PhoneOff, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

export default function AdminChat() {
  const [messages, setMessages] = useState([]);
  const [selectedConv, setSelectedConv] = useState(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [unreadByConv, setUnreadByConv] = useState({});
  const bottomRef = useRef(null);
  const prevUnreadTotal = useRef(0);

  const { data: allUsers = [] } = useQuery({
    queryKey: ['users-list'],
    queryFn: () => base44.entities.User.list(),
  });
  const userByEmail = React.useMemo(() => Object.fromEntries(allUsers.map(u => [u.email, u])), [allUsers]);

  const { data: adminUser } = useQuery({
    queryKey: ['admin-me'],
    queryFn: () => base44.auth.me(),
  });

  // Load all messages and group by conversation
  const { data: allMessages = [], refetch } = useQuery({
    queryKey: ['chat-all'],
    queryFn: () => base44.entities.ChatMessage.list('-created_date', 500),
  });

  // Build conversation list
  const conversations = React.useMemo(() => {
    const convMap = {};
    allMessages.forEach(m => {
      if (!convMap[m.conversation_id]) {
        const u = userByEmail[m.conversation_id];
        const displayName = u?.company_name || u?.full_name || (m.is_admin ? m.conversation_id : (m.sender_name || m.conversation_id));
        convMap[m.conversation_id] = { id: m.conversation_id, name: displayName, lastMessage: m, unread: 0 };
      }
      const c = convMap[m.conversation_id];
      if (new Date(m.created_date) > new Date(c.lastMessage.created_date)) c.lastMessage = m;
      if (!m.is_admin && !m.read_by_admin) c.unread++;
    });
    return Object.values(convMap).sort((a, b) => new Date(b.lastMessage.created_date) - new Date(a.lastMessage.created_date));
  }, [allMessages]);

  // Load messages for selected conversation
  useEffect(() => {
    if (!selectedConv) return;
    const msgs = allMessages
      .filter(m => m.conversation_id === selectedConv)
      .sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
    setMessages(msgs);
    // mark as read
    msgs.filter(m => !m.is_admin && !m.read_by_admin).forEach(m => {
      base44.entities.ChatMessage.update(m.id, { read_by_admin: true });
    });
  }, [selectedConv, allMessages]);

  // Real-time subscription + browser notifications
  useEffect(() => {
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    const unsubscribe = base44.entities.ChatMessage.subscribe((event) => {
      refetch();
      // Notify if new client message
      if (event.type === 'create' && event.data && !event.data.is_admin) {
        const senderName = event.data.sender_name || event.data.sender_email || 'Cliente';
        toast(`💬 Nova mensagem de ${senderName}`, { description: event.data.message?.slice(0, 80) });
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(`Nova mensagem de ${senderName}`, {
            body: event.data.message?.slice(0, 100),
            icon: '/favicon.ico',
          });
        }
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!text.trim() || sending || !selectedConv || !adminUser) return;
    setSending(true);
    await base44.entities.ChatMessage.create({
      conversation_id: selectedConv,
      sender_email: adminUser.email,
      sender_name: adminUser.full_name || 'Equipe',
      message: text.trim(),
      is_admin: true,
      read_by_client: false,
      read_by_admin: true,
    });
    setText('');
    setSending(false);
  };

  const selectedConvData = conversations.find(c => c.id === selectedConv);

  const handleDeleteConversation = async (convId) => {
    if (!window.confirm('Excluir todas as mensagens desta conversa?')) return;
    const toDelete = allMessages.filter(m => m.conversation_id === convId);
    await Promise.all(toDelete.map(m => base44.entities.ChatMessage.delete(m.id)));
    if (selectedConv === convId) setSelectedConv(null);
    refetch();
    toast.success('Conversa excluída.');
  };

  const handleEndConversation = async (convId) => {
    if (!window.confirm('Encerrar esta conversa? O cliente não poderá mais enviar mensagens até iniciar uma nova.')) return;
    // Send a closing message
    await base44.entities.ChatMessage.create({
      conversation_id: convId,
      sender_email: adminUser?.email || 'admin',
      sender_name: 'Equipe',
      message: '✅ Conversa encerrada pela equipe. Para dúvidas, inicie um novo atendimento.',
      is_admin: true,
      read_by_client: false,
      read_by_admin: true,
      is_closed: true,
    });
    refetch();
    toast.success('Conversa encerrada.');
  };

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-160px)] gap-4">
      {/* Conversation list */}
      <Card className={`w-full md:w-72 flex-shrink-0 overflow-hidden flex-col ${selectedConv ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-3 border-b">
          <h2 className="font-semibold text-sm flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-primary" /> Conversas
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 && (
            <p className="text-xs text-muted-foreground text-center mt-8 px-4">Nenhuma conversa ainda.</p>
          )}
          {conversations.map(conv => (
            <div
              key={conv.id}
              className={`relative group flex items-start border-b hover:bg-muted/50 transition-colors ${selectedConv === conv.id ? 'bg-primary/5 border-l-2 border-l-primary' : ''}`}
            >
              <button
                onClick={() => setSelectedConv(conv.id)}
                className="flex-1 text-left px-3 py-3 min-w-0"
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-sm font-medium truncate">{conv.name}</span>
                  {conv.unread > 0 && (
                    <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0">{conv.unread}</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">{conv.lastMessage.message}</p>
                <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                  {format(new Date(conv.lastMessage.created_date), "dd/MM 'às' HH:mm", { locale: ptBR })}
                </p>
              </button>
              <button
                onClick={() => handleDeleteConversation(conv.id)}
                className="opacity-0 group-hover:opacity-100 p-2 mt-2 mr-1 text-muted-foreground hover:text-destructive transition-all"
                title="Excluir conversa"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </Card>

      {/* Chat panel */}
      <Card className={`flex-1 flex-col overflow-hidden ${selectedConv ? 'flex' : 'hidden md:flex'}`}>
        {!selectedConv ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>Selecione uma conversa para responder</p>
            </div>
          </div>
        ) : (
          <>
            <div className="px-4 py-3 border-b flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8 md:hidden" onClick={() => setSelectedConv(null)} title="Voltar">
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">{selectedConvData?.name}</p>
                <p className="text-xs text-muted-foreground">{selectedConv}</p>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-orange-500 hover:bg-orange-50" onClick={() => handleEndConversation(selectedConv)} title="Encerrar conversa">
                <PhoneOff className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleDeleteConversation(selectedConv)} title="Excluir conversa">
                <Trash2 className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedConv(null)} title="Fechar">
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {messages.map(m => (
                <div key={m.id} className={`flex flex-col gap-0.5 ${m.is_admin ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[70%] px-3 py-2 rounded-2xl text-sm ${
                    m.is_admin
                      ? 'bg-primary text-primary-foreground rounded-tr-sm'
                      : 'bg-muted text-foreground rounded-tl-sm'
                  }`}>
                    <p className="leading-snug">{m.message}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground px-1">
                    {format(new Date(m.created_date), "dd/MM 'às' HH:mm", { locale: ptBR })}
                  </span>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            <div className="border-t p-3 flex gap-2">
              <Input
                placeholder="Responder..."
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
              />
              <Button className="bg-primary" onClick={handleSend} disabled={sending || !text.trim()}>
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}