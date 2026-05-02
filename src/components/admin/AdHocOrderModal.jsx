import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { X, Trash2, ShoppingCart } from 'lucide-react';

const STATES = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

export default function AdHocOrderModal({ onClose, onSaved }) {
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientSearch, setClientSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [orderItems, setOrderItems] = useState([]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [clientData, setClientData] = useState({
    full_name: '', email: '', company_name: '', cnpj_cpf: '',
    whatsapp: '', address: '', city: '', state: '',
    price_group_id: '', price_group_name: '',
  });

  const { data: usersRes } = useQuery({
    queryKey: ['all-users-adhoc'],
    queryFn: () => base44.functions.invoke('listAllUsers', {}),
  });
  const allUsers = usersRes?.data?.users || [];

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list(),
  });

  const { data: priceGroups = [] } = useQuery({
    queryKey: ['price-groups'],
    queryFn: () => base44.entities.PriceGroup.filter({ active: true }),
  });

  const { data: customPrices = [] } = useQuery({
    queryKey: ['custom-prices'],
    queryFn: () => base44.entities.CustomPrice.list(),
    enabled: priceGroups.some(g => g.type === 'custom'),
  });

  const activeProducts = products.filter(p => p.active);

  const filteredUsers = clientSearch.length > 1
    ? allUsers.filter(u =>
        u.full_name?.toLowerCase().includes(clientSearch.toLowerCase()) ||
        u.email?.toLowerCase().includes(clientSearch.toLowerCase()) ||
        u.company_name?.toLowerCase().includes(clientSearch.toLowerCase())
      )
    : [];

  const filteredProducts = productSearch.length > 1
    ? activeProducts.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()))
    : [];

  useEffect(() => {
    if (selectedClient) {
      setClientData({
        full_name: selectedClient.full_name || '',
        email: selectedClient.email || '',
        company_name: selectedClient.company_name || '',
        cnpj_cpf: selectedClient.cnpj_cpf || '',
        whatsapp: selectedClient.whatsapp || '',
        address: selectedClient.address || '',
        city: selectedClient.city || '',
        state: selectedClient.state || '',
        price_group_id: selectedClient.price_group_id || '',
        price_group_name: selectedClient.price_group_name || '',
      });
    }
  }, [selectedClient]);

  const getEffectivePrice = (product) => {
    const basePrice = product.promo_active && product.promo_price ? product.promo_price : product.price;
    const group = priceGroups.find(g => g.id === clientData.price_group_id);
    if (!group) return basePrice;
    if (group.type === 'percentage') {
      return basePrice * (1 - (group.discount_percent || 0) / 100);
    }
    if (group.type === 'custom') {
      const cp = customPrices.find(c => c.price_group_id === group.id && c.product_id === product.id);
      return cp ? cp.custom_price : basePrice;
    }
    return basePrice;
  };

  const addProduct = (product) => {
    setOrderItems(prev => {
      const existing = prev.find(i => i.product_id === product.id);
      if (existing) {
        return prev.map(i => i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      const effectivePrice = getEffectivePrice(product);
      return [...prev, {
        product_id: product.id,
        product_name: product.name,
        quantity: 1,
        unit_price: product.price,
        final_unit_price: effectivePrice,
        packaging_type: product.packaging_type,
        weight: product.weight,
      }];
    });
    setProductSearch('');
  };

  const updateQty = (productId, qty) => {
    setOrderItems(prev => prev.map(i => i.product_id === productId ? { ...i, quantity: Math.max(1, qty) } : i));
  };

  const removeItem = (productId) => {
    setOrderItems(prev => prev.filter(i => i.product_id !== productId));
  };

  const total = orderItems.reduce((sum, item) => sum + item.final_unit_price * item.quantity, 0);

  const handleSave = async () => {
    if (!clientData.email || !clientData.full_name) {
      toast.error('Informe o nome e email do cliente.');
      return;
    }
    if (orderItems.length === 0) {
      toast.error('Adicione pelo menos um produto ao pedido.');
      return;
    }
    setSaving(true);
    try {
      await base44.functions.invoke('createAdHocOrder', {
        customer_id: selectedClient?.id || null,
        customer_email: clientData.email,
        customer_name: clientData.full_name,
        items: orderItems,
        total,
        notes,
        client_data: clientData, // sempre envia para salvar/atualizar dados do cliente
      });
      toast.success('Pedido avulso criado com sucesso!');
      onSaved();
    } catch (err) {
      toast.error('Erro ao criar pedido: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Pedido Avulso</DialogTitle>
          <DialogDescription>
            Selecione um cliente existente ou preencha os dados manualmente. Novos clientes são salvos para pedidos futuros.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* CLIENTE */}
          <div className="border rounded-xl p-4 space-y-3 bg-muted/20">
            <h3 className="font-semibold text-sm">Cliente</h3>

            {selectedClient ? (
              <div className="flex items-center justify-between bg-secondary/60 rounded-lg px-3 py-2">
                <div>
                  <p className="font-medium text-sm">{selectedClient.full_name}</p>
                  <p className="text-xs text-muted-foreground">{selectedClient.email}</p>
                  {selectedClient.company_name && <p className="text-xs text-muted-foreground">{selectedClient.company_name}</p>}
                </div>
                <Button variant="ghost" size="sm" onClick={() => { setSelectedClient(null); setClientData({ full_name:'',email:'',company_name:'',cnpj_cpf:'',whatsapp:'',address:'',city:'',state:'',price_group_id:'',price_group_name:'' }); }}>
                  <X className="w-4 h-4 mr-1" />Trocar
                </Button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Input
                    placeholder="Buscar cliente existente (nome, email, empresa)..."
                    value={clientSearch}
                    onChange={e => setClientSearch(e.target.value)}
                  />
                  {filteredUsers.length > 0 && (
                    <div className="absolute z-50 top-full left-0 right-0 border rounded-md mt-1 max-h-44 overflow-y-auto bg-background shadow-lg">
                      {filteredUsers.map(u => (
                        <div key={u.id} className="px-3 py-2 hover:bg-muted cursor-pointer border-b last:border-b-0"
                          onClick={() => { setSelectedClient(u); setClientSearch(''); }}>
                          <p className="text-sm font-medium">{u.full_name} <span className="text-muted-foreground font-normal">({u.email})</span></p>
                          {u.company_name && <p className="text-xs text-muted-foreground">{u.company_name}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">— ou preencha os dados de um novo cliente abaixo —</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><Label className="text-xs">Nome Completo *</Label><Input value={clientData.full_name} onChange={e => setClientData(p=>({...p,full_name:e.target.value}))} /></div>
                  <div><Label className="text-xs">Email *</Label><Input type="email" value={clientData.email} onChange={e => setClientData(p=>({...p,email:e.target.value}))} /></div>
                  <div><Label className="text-xs">Empresa</Label><Input value={clientData.company_name} onChange={e => setClientData(p=>({...p,company_name:e.target.value}))} /></div>
                  <div><Label className="text-xs">CNPJ / CPF</Label><Input value={clientData.cnpj_cpf} onChange={e => setClientData(p=>({...p,cnpj_cpf:e.target.value}))} /></div>
                  <div><Label className="text-xs">WhatsApp</Label><Input value={clientData.whatsapp} onChange={e => setClientData(p=>({...p,whatsapp:e.target.value}))} /></div>
                  <div><Label className="text-xs">Endereço</Label><Input value={clientData.address} onChange={e => setClientData(p=>({...p,address:e.target.value}))} /></div>
                  <div><Label className="text-xs">Cidade</Label><Input value={clientData.city} onChange={e => setClientData(p=>({...p,city:e.target.value}))} /></div>
                  <div>
                    <Label className="text-xs">Estado</Label>
                    <Select value={clientData.state} onValueChange={v => setClientData(p=>({...p,state:v}))}>
                      <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                      <SelectContent>{STATES.map(s=><SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-xs">Tabela de Preços</Label>
                    <Select value={clientData.price_group_id || '__none__'} onValueChange={v => {
                      const g = priceGroups.find(g=>g.id===v);
                      setClientData(p=>({...p, price_group_id: v==='__none__'?'':v, price_group_name: g?.name||'' }));
                    }}>
                      <SelectTrigger><SelectValue placeholder="Preço padrão" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— Preço padrão (sem tabela)</SelectItem>
                        {priceGroups.map(g=><SelectItem key={g.id} value={g.id}>{g.name}{g.discount_percent?` (${g.discount_percent}%)`  :''}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* PRODUTOS */}
          <div className="border rounded-xl p-4 space-y-3 bg-muted/20">
            <h3 className="font-semibold text-sm">Produtos</h3>
            <div className="relative">
              <Input
                placeholder="Buscar e adicionar produto..."
                value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
              />
              {filteredProducts.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 border rounded-md mt-1 max-h-44 overflow-y-auto bg-background shadow-lg">
                  {filteredProducts.map(p => (
                    <div key={p.id} className="px-3 py-2 hover:bg-muted cursor-pointer border-b last:border-b-0 flex justify-between items-center"
                      onClick={() => addProduct(p)}>
                      <div>
                        <p className="text-sm font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.packaging_type}{p.weight && ` • ${p.weight}`}</p>
                      </div>
                      <span className="text-sm font-semibold">R$ {getEffectivePrice(p).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {orderItems.length > 0 ? (
              <div className="space-y-2">
                {orderItems.map(item => (
                  <div key={item.product_id} className="flex items-center gap-2 border-b pb-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.product_name}</p>
                      <p className="text-xs text-muted-foreground">{item.packaging_type}{item.weight && ` • ${item.weight}`} • R$ {item.final_unit_price.toFixed(2)}/un.</p>
                    </div>
                    <Input
                      type="number" min="1" value={item.quantity}
                      onChange={e => updateQty(item.product_id, parseInt(e.target.value) || 1)}
                      className="w-16 text-center"
                    />
                    <span className="font-semibold w-24 text-right text-sm">R$ {(item.final_unit_price * item.quantity).toFixed(2)}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeItem(item.product_id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
                <div className="flex justify-between font-bold pt-1">
                  <span>Total</span>
                  <span className="text-primary">R$ {total.toFixed(2)}</span>
                </div>
              </div>
            ) : (
              <p className="text-center text-muted-foreground text-sm py-4">Nenhum produto adicionado.</p>
            )}
          </div>

          {/* OBSERVAÇÕES */}
          <div>
            <Label className="text-xs mb-1 block">Observações</Label>
            <Textarea placeholder="Observações internas do pedido..." value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            <ShoppingCart className="w-4 h-4 mr-1.5" />
            {saving ? 'Criando...' : 'Criar Pedido Avulso'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}