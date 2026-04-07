import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function InviteClientDialog({ onClose, onInvited }) {
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);

  const handleInvite = async () => {
    if (!email) {
      toast.error('Informe o email do cliente');
      return;
    }
    setSaving(true);
    await base44.users.inviteUser(email, 'user');
    toast.success('Convite enviado!');
    setSaving(false);
    onInvited();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Convidar Cliente</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Email do cliente *</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="cliente@email.com" />
          </div>
          <p className="text-xs text-muted-foreground">O cliente receberá um convite por email para acessar o catálogo.</p>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button className="flex-1 bg-primary text-primary-foreground" onClick={handleInvite} disabled={saving}>
              {saving ? 'Enviando...' : 'Enviar Convite'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}