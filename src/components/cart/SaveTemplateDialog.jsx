import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { BookmarkPlus } from 'lucide-react';

export default function SaveTemplateDialog({ cartItems, user, onClose, onSaved }) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Dê um nome ao modelo.'); return; }
    setSaving(true);
    try {
      const items = cartItems.map(({ product_id, product_name, quantity, packaging_type, weight }) => ({
        product_id, product_name, quantity, packaging_type, weight,
      }));
      await base44.entities.OrderTemplate.create({
        name: name.trim(),
        user_email: user.email,
        items,
      });
      toast.success('Modelo salvo com sucesso!');
      onSaved();
    } catch (err) {
      toast.error('Erro ao salvar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookmarkPlus className="w-5 h-5 text-primary" />
            Salvar Modelo de Pedido
          </DialogTitle>
          <DialogDescription>
            Salve os {cartItems.length} item(ns) do carrinho atual como um modelo reutilizável.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div>
            <Label className="text-xs">Nome do Modelo *</Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Pedido semanal de frutas"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && handleSave()}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar Modelo'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}