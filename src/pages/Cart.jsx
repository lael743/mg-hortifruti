import React, { useState, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Trash2, Minus, Plus, ShoppingCart, ArrowLeft, Package, Bookmark, BookmarkPlus } from 'lucide-react';
import { getCart, removeFromCart, updateCartQuantity, clearCart, getCartTotal } from '@/lib/cartStore';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { generateOrderNumber } from '@/lib/orderNumberService';
import { withLineIds } from '@/lib/orderLines';
import SaveTemplateDialog from '@/components/cart/SaveTemplateDialog';
import LoadTemplateDialog from '@/components/cart/LoadTemplateDialog';

export default function Cart() {
  const { user } = useOutletContext();
  const navigate = useNavigate();
  const [cart, setCart] = useState([]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [showLoadTemplate, setShowLoadTemplate] = useState(false);

  useEffect(() => {
    setCart(getCart());
    const update = () => setCart(getCart());
    window.addEventListener('cart-updated', update);
    return () => window.removeEventListener('cart-updated', update);
  }, []);

  if (!user) {
    navigate('/');
    return null;
  }

  const total = getCartTotal(cart);

  const handleQuantityChange = (productId, delta) => {
    const item = cart.find(i => i.product_id === productId);
    if (item) {
      updateCartQuantity(productId, item.quantity + delta);
    }
  };

  const handleFinalize = async () => {
    if (cart.length === 0) return;
    setSubmitting(true);
    const orderNumber = await generateOrderNumber();
    await base44.entities.Order.create({
      order_number: orderNumber,
      customer_email: user.email,
      customer_name: user.full_name || user.company_name || user.email,
      items: withLineIds(cart.map(({ image_url, ...rest }) => rest)),
      total,
      status: 'Pendente',
      notes,
    });
    clearCart();
    toast.success(`Pedido #${orderNumber} realizado com sucesso!`);
    navigate('/orders');
    setSubmitting(false);
  };

  if (cart.length === 0) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-16 text-center">
        <ShoppingCart className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
        <h2 className="text-xl font-bold mb-2">Carrinho vazio</h2>
        <p className="text-muted-foreground mb-6">Adicione produtos do catálogo ao seu carrinho.</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button onClick={() => navigate('/')} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />Voltar ao Catálogo
          </Button>
          <Button onClick={() => setShowLoadTemplate(true)} variant="secondary">
            <Bookmark className="w-4 h-4 mr-2" />Carregar Modelo
          </Button>
        </div>
        {showLoadTemplate && (
          <LoadTemplateDialog user={user} onClose={() => setShowLoadTemplate(false)} onLoaded={() => setShowLoadTemplate(false)} />
        )}
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Carrinho</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowLoadTemplate(true)}>
            <Bookmark className="w-4 h-4 mr-1" />Modelos
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowSaveTemplate(true)}>
            <BookmarkPlus className="w-4 h-4 mr-1" />Salvar Modelo
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
            <ArrowLeft className="w-4 h-4 mr-1" />Continuar
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {cart.map(item => (
          <Card key={item.product_id} className="p-4">
            <div className="flex gap-4">
              <div className="w-16 h-16 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                {item.image_url ? (
                  <img src={item.image_url} alt={item.product_name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="w-6 h-6 text-muted-foreground/30" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm truncate">{item.product_name}</h3>
                <p className="text-xs text-muted-foreground">{item.packaging_type} {item.weight && `• ${item.weight}`}</p>
                <p className="text-sm font-bold text-primary mt-1">R$ {item.unit_price.toFixed(2)}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeFromCart(item.product_id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
                <div className="flex items-center gap-1 bg-secondary rounded-lg">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleQuantityChange(item.product_id, -1)} disabled={item.quantity <= 1}>
                    <Minus className="w-3 h-3" />
                  </Button>
                  <span className="w-8 text-center text-sm font-semibold">{item.quantity}</span>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleQuantityChange(item.product_id, 1)}>
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>
                <span className="text-sm font-bold">R$ {(item.unit_price * item.quantity).toFixed(2)}</span>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Textarea
        placeholder="Observações do pedido (opcional)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        className="bg-card"
      />

      <Card className="p-6 bg-primary/5 border-primary/20">
        <div className="flex items-center justify-between mb-4">
          <span className="text-lg font-semibold">Total</span>
          <span className="text-2xl font-extrabold text-primary">R$ {total.toFixed(2)}</span>
        </div>
        <Button
          className="w-full h-12 text-base bg-primary text-primary-foreground hover:bg-primary/90"
          onClick={handleFinalize}
          disabled={submitting}
        >
          {submitting ? 'Finalizando...' : 'Finalizar Pedido'}
        </Button>
      </Card>
      {showSaveTemplate && (
        <SaveTemplateDialog
          cartItems={cart}
          user={user}
          onClose={() => setShowSaveTemplate(false)}
          onSaved={() => setShowSaveTemplate(false)}
        />
      )}
      {showLoadTemplate && (
        <LoadTemplateDialog
          user={user}
          onClose={() => setShowLoadTemplate(false)}
          onLoaded={() => setShowLoadTemplate(false)}
        />
      )}
    </main>
  );
}