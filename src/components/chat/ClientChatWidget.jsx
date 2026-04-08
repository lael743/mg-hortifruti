import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { MessageCircle, X, Send, Loader2 } from 'lucide-react';

export default function ClientChatWidget({ user }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [unread, setUnread] = useState(0);
  const bottomRef = useRef(null);
  const conversationId = user?.email;

  const loadMessages = async () => {
    if (!conversationId) return;
    const msgs = await base44.entities.ChatMessage.filter(
      { conversation_id: conversationId }, 'created_date'
    );
    setMessages(msgs);
    // mark admin messages as read
    msgs.filter(m => m.is_admin && !m.read_by_client).forEach(m => {
      base44.entities.ChatMessage.update(m.id, { read_by_client: true });
    });
    setUnread(0);
  };

  useEffect(() => {
    if (!conversationId) return;
    loadMessages();
    const unsubscribe = base44.entities.ChatMessage.subscribe((event) => {
      if (event.data?.conversation_id !== conversationId) return;
      setMessages(prev => {
        const exists = prev.find(m => m.id === event.id);
        if (event.type === 'delete') return prev.filter(m => m.id !== event.id);
        if (exists) return prev.map(m => m.id === event.id ? event.data : m);
        return [...prev, event.data];
      });
      if (event.data?.is_admin && !open) {
        setUnread(u => u + 1);
      }
    });
    return unsubscribe;
  }, [conversationId]);

  useEffect(() => {
    if (open) {
      setUnread(0);
      messages.filter(m => m.is_admin && !m.read_by_client).forEach(m => {
        base44.entities.ChatMessage.update(m.id, { read_by_client: true });
      });
    }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  const handleSend = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    await base44.entities.ChatMessage.create({
      conversation_id: conversationId,
      sender_email: user.email,
      sender_name: user.full_name || user.email,
      message: text.trim(),
      is_admin: false,
      read_by_client: true,
      read_by_admin: false,
    });
    setText('');
    setSending(false);
  };

  if (!user || user.role === 'admin') return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="w-80 bg-card border rounded-2xl shadow-2xl flex flex-col overflow-hidden" style={{ height: '420px' }}>
          {/* Header */}
          <div className="bg-primary text-primary-foreground px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4" />
              <span className="font-semibold text-sm">Chat com a equipe</span>
            </div>
            <button onClick={() => setOpen(false)}>
              <X className="w-4 h-4 opacity-80 hover:opacity-100" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {messages.length === 0 && (
              <p className="text-xs text-muted-foreground text-center mt-8">
                Olá! Tire suas dúvidas sobre produtos ou pedidos. 🌿
              </p>
            )}
            {messages.map(m => (
              <div key={m.id} className={`flex ${m.is_admin ? 'justify-start' : 'justify-end'}`}>
                <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm ${
                  m.is_admin
                    ? 'bg-muted text-foreground rounded-tl-sm'
                    : 'bg-primary text-primary-foreground rounded-tr-sm'
                }`}>
                  {m.is_admin && <p className="text-[10px] font-semibold opacity-70 mb-0.5">Equipe</p>}
                  <p className="leading-snug">{m.message}</p>
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t p-2 flex gap-2">
            <input
              className="flex-1 text-sm bg-transparent outline-none px-2"
              placeholder="Digite sua mensagem..."
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            />
            <Button size="icon" className="h-8 w-8 bg-primary" onClick={handleSend} disabled={sending || !text.trim()}>
              {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-xl flex items-center justify-center hover:scale-105 transition-transform relative"
      >
        {open ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
        {!open && unread > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
            {unread}
          </span>
        )}
      </button>
    </div>
  );
}