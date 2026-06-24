import React, { useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Search, X, Trash2, ShoppingCart, UserPlus, Building2, MapPin, FileText, Phone, User, Store, ArrowLeft } from 'lucide-react';

const STATES = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

const EMPTY_CLIENT = {
  full_name: '', company_name: '', cnpj_cpf: '',
  whatsapp: '', address: '', city: '', state: '',
  price_group_id: '', price_group_name: '', email: '', notes: '',
};

export default function NewOrder() {
  const { user } = useOutletContext();
  const navigate = useNavigate();

  const [selectedClient, setSelectedClient] = useState(null);
  const [clientSearch, setClientSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [orderItems, setOrderItems] = useState([]);
  const [orderNotes, setOrderNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [clientData, setClientData] = useState({ ...EMPTY_CLIENT });
  const [clientType, setClientType] = useState(null); // 'direct' | 'walk_in'
  const [isNewClient, setIsNewClient] = useState(false);

  const { data: clientsData } = useQuery({
    queryKey: ['all-clients-new-order'],
    queryFn: async () => {
      const res = await base44.functions.invoke('listAllClients');
      return res.data.clients || [];
    },
  });
  const allClients = clientsData || [];

  const { data: products = [] } = useQuery({
    queryKey: ['products-new-order'],
    queryFn: () => base44.entities.Product.list(),
  });

  const { data: priceGroups = [] } = useQuery({
    queryKey: ['price-groups-new-order'],
    queryFn: () => base44.entities.PriceGroup.filter({ active: true }),
  });

  const { data: customPrices = [] } = useQuery({
    queryKey: ['custom-prices-new-order'],
    queryFn: () => base44.entities.CustomPrice.list(),
    enabled: priceGroups.some(g => g.type === 'custom'),
  });

  const activeProducts = products.filter(p => p.active);

  const filteredClients = clientSearch.length > 1
    ? allClients.filter(c =>
        (c.full_name || '').toLowerCase().includes(clientSearch.toLowerCase()) ||
        (c.company_name || '').toLowerCase().includes(clientSearch.toLowerCase()) ||
        (c.cnpj_cpf || '').toLowerCase().includes(clientSearch.toLowerCase()) ||
        (c.whatsapp || '').includes(clientSearch)
      )
    : [];

  const filteredProducts = productSearch.length > 1
    ? activeProducts.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()))
    : [];

  const selectClient = (c) => {
    setSelectedClient(c);
    setClientType(c.client_type);
    setClientData({
      full_name: c.full_name || '',
      company_name: c.company_name || '',
      cnpj_cpf: c.cnpj_cpf || '',
      whatsapp: c.whatsapp || '',
      address: c.address || '',
      city: c.city || '',
      state: c.state || '',
      price_group_id: c.price_group_id || '',
      price_group_name: c.price_group_name || '',
      email: c.email || '',
      notes: '',
    });
    setClientSearch('');
    setIsNewClient(false);
  };

  const clearClient = () => {
    setSelectedClient(null);
    setClientType(null);
    setClientData({ ...EMPTY_CLIENT });
    setIsNewClient(false);
  };

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
    if (!clientData.full_name.trim()) {
      toast.error('Informe o nome do cliente.');
      return;
    }
    if (orderItems.length === 0) {
      toast.error('Adicione pelo menos um produto ao pedido.');
      return;
    }
    setSaving(true);
    try {
      await base44.functions.invoke('createAdHocOrder', {
        walk_in_client_id: clientType === 'walk_in' ? selectedClient?.id : null,
        client_type: clientType,
        client_data: clientData,
        items: orderItems,
        total,
        notes: orderNotes,
      });
      toast.success('Pedido criado com sucesso!');
      navigate('/orders');
    } catch (err) {
      toast.error('Erro ao criar pedido: ' + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/orders')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Novo Pedido</h1>
          <p className="text-sm text-muted-foreground">Crie um pedido para qualquer cliente cadastrado ou avulso.</p>
        </div>
      </div>

      {/* CLIENTE */}
      <div className="border rounded-xl p-5 space-y-4 bg-card">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <User className="w-4 h-4 text-primary" /> Cliente
        </h3>

        {selectedClient ? (
          <div className="flex items-start justify-between bg-muted/50 rounded-xl px-4 py-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-sm">
                  {selectedClient.company_name || selectedClient.full_name}
                </p>
                <Badge variant="outline" className={selectedClient.client_type === 'walk_in' ? 'border-amber-400 text-amber-700' : 'border-blue-400 text-blue-700'}>
                  {selectedClient.client_type === 'walk_in' ? 'Avulso' : 'Cadastrado'}
                </Badge>
              </div>
              {selectedClient.company_name && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Store className="w-3 h-3" /> Contato: {selectedClient.full_name}
                </p>
              )}
              {selectedClient.cnpj_cpf && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <FileText className="w-3 h-3" /> {selectedClient.cnpj_cpf}
                </p>
              )}
              {(selectedClient.city || selectedClient.state) && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> {[selectedClient.city, selectedClient.state].filter(Boolean).join(' - ')}
                </p>
              )}
              {selectedClient.whatsapp && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Phone className="w-3 h-3" /> {selectedClient.whatsapp}
                </p>
              )}
              {clientData.price_group_name && (
                <Badge className="mt-1 bg-primary/10 text-primary border-primary/20 border">
                  Tabela: {clientData.price_group_name}
                </Badge>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={clearClient}>
              <X className="w-4 h-4 mr-1" />Trocar
            </Button>
          </div>
        ) : (
          <>
            <div className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar cliente por nome, empresa, CNPJ ou WhatsApp..."
                  value={clientSearch}
                  onChange={e => { setClientSearch(e.target.value); setIsNewClient(false); }}
                  className="pl-10"
                />
              </div>
              {filteredClients.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 border rounded-xl mt-1.5 max-h-60 overflow-y-auto bg-card shadow-xl">
                  {filteredClients.map(c => (
                    <div key={`${c.client_type}-${c.id}`} className="px-4 py-3 hover:bg-muted cursor-pointer border-b last:border-b-0 transition-colors"
                      onClick={() => selectClient(c)}>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{c.company_name || c.full_name}</span>
                        <Badge variant="outline" className={c.client_type === 'walk_in' ? 'text-[10px] border-amber-400 text-amber-700' : 'text-[10px] border-blue-400 text-blue-700'}>
                          {c.client_type === 'walk_in' ? 'Avulso' : 'Cadastrado'}
                        </Badge>
                      </div>
                      {c.company_name && <p className="text-xs text-muted-foreground mt-0.5">{c.full_name}</p>}
                      <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                        {c.city && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{c.city}{c.state && `-${c.state}`}</span>}
                        {c.whatsapp && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{c.whatsapp}</span>}
                        {c.cnpj_cpf && <span className="flex items-center gap-1"><FileText className="w-3 h-3" />{c.cnpj_cpf}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {!isNewClient ? (
              <Button variant="outline" size="sm" className="w-full border-dashed" onClick={() => { setIsNewClient(true); setClientSearch(''); }}>
                <UserPlus className="w-4 h-4 mr-1.5" />Cadastrar Novo Cliente Avulso
              </Button>
            ) : (
              <div className="space-y-3 border rounded-xl p-4 bg-muted/20">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Novo cliente avulso</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><Label className="text-xs">Nome Completo *</Label><Input value={clientData.full_name} onChange={e => setClientData(p=>({...p,full_name:e.target.value}))} /></div>
                  <div><Label className="text-xs">Empresa / Estabelecimento</Label><Input value={clientData.company_name} onChange={e => setClientData(p=>({...p,company_name:e.target.value}))} /></div>
                  <div><Label className="text-xs">CNPJ / CPF</Label><Input value={clientData.cnpj_cpf} onChange={e => setClientData(p=>({...p,cnpj_cpf:e.target.value}))} /></div>
                  <div><Label className="text-xs">WhatsApp / Telefone</Label><Input value={clientData.whatsapp} onChange={e => setClientData(p=>({...p,whatsapp:e.target.value}))} /></div>
                  <div><Label className="text-xs">Endereço</Label><Input value={clientData.address} onChange={e => setClientData(p=>({...p,address:e.target.value}))} /></div>
                  <div><Label className="text-xs">Cidade</Label><Input value={clientData.city} onChange={e => setClientData(p=>({...p,city:e.target.value}))} /></div>
                  <div>
                    <Label className="text-xs">Estado</Label>
                    <Select value={clientData.state} onValueChange={v => setClientData(p=>({...p,state:v}))}>
                      <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                      <SelectContent>{STATES.map(s=><SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Tabela de Preços</Label>
                    <Select value={clientData.price_group_id || '__none__'} onValueChange={v => {
                      const g = priceGroups.find(g=>g.id===v);
                      setClientData(p=>({...p, price_group_id: v==='__none__'?'':v, price_group_name: g?.name||'' }));
                    }}>
                      <SelectTrigger><SelectValue placeholder="Preço padrão" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— Preço padrão (sem tabela)</SelectItem>
                        {priceGroups.map(g=><SelectItem key={g.id} value={g.id}>{g.name}{g.discount_percent?` (${g.discount_percent}%)`:''}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* PRODUTOS */}
      <div className="border rounded-xl p-5 space-y-4 bg-card">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <ShoppingCart className="w-4 h-4 text-primary" /> Produtos
        </h3>
        <div className="relative">
          <Input
            placeholder="Buscar e adicionar produto..."
            value={productSearch}
            onChange={e => setProductSearch(e.target.value)}
          />
          {filteredProducts.length > 0 && (
            <div className="absolute z-50 top-full left-0 right-0 border rounded-xl mt-1.5 max-h-56 overflow-y-auto bg-card shadow-xl">
              {filteredProducts.map(p => (
                <div key={p.id} className="px-4 py-3 hover:bg-muted cursor-pointer border-b last:border-b-0 flex justify-between items-center transition-colors"
                  onClick={() => addProduct(p)}>
                  <div>
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.packaging_type}{p.weight && ` • ${p.weight}`}</p>
                  </div>
                  <span className="text-sm font-semibold text-primary">R$ {getEffectivePrice(p).toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {orderItems.length > 0 ? (
          <div className="space-y-2">
            {orderItems.map(item => (
              <div key={item.product_id} className="flex items-center gap-3 border-b pb-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.product_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.packaging_type}{item.weight && ` • ${item.weight}`} • R$ {item.final_unit_price.toFixed(2)}/un.
                  </p>
                </div>
                <Input
                  type="number" min="1" value={item.quantity}
                  onChange={e => updateQty(item.product_id, parseInt(e.target.value) || 1)}
                  className="w-16 text-center h-9"
                />
                <span className="font-semibold w-24 text-right text-sm">R$ {(item.final_unit_price * item.quantity).toFixed(2)}</span>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => removeItem(item.product_id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
            <div className="flex justify-between items-center font-bold pt-2 text-lg">
              <span>Total</span>
              <span className="text-primary">R$ {total.toFixed(2)}</span>
            </div>
          </div>
        ) : (
          <div className="text-center py-10 text-muted-foreground">
            <ShoppingCart className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhum produto adicionado.</p>
            <p className="text-xs mt-1">Busque produtos acima para montar o pedido.</p>
          </div>
        )}
      </div>

      {/* OBSERVAÇÕES */}
      <div className="border rounded-xl p-5 space-y-3 bg-card">
        <Label className="text-sm font-semibold">Observações do Pedido</Label>
        <Textarea placeholder="Observações do pedido..." value={orderNotes} onChange={e => setOrderNotes(e.target.value)} rows={3} />
      </div>

      {/* ACTIONS */}
      <div className="flex justify-end gap-3 pt-2">
        <Button variant="outline" onClick={() => navigate('/orders')}>Cancelar</Button>
        <Button onClick={handleSave} disabled={saving} size="lg">
          <ShoppingCart className="w-4 h-4 mr-2" />
          {saving ? 'Criando...' : 'Criar Pedido'}
        </Button>
      </div>
    </main>
  );
}