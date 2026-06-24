import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { X, Trash2, ShoppingCart, UserPlus, MapPin, Phone, FileText, Store, User } from 'lucide-react';
import CityAutocomplete from '@/components/common/CityAutocomplete';

const STATES = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

const EMPTY_CLIENT = {
  full_name: '', company_name: '', cnpj_cpf: '',
  whatsapp: '', address: '', city: '', state: '',
  email: '', price_group_id: '', price_group_name: '', salesperson_id: '', notes: '',
};

export default function AdHocOrderModal({ onClose, onSaved }) {
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientSearch, setClientSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [orderItems, setOrderItems] = useState([]);
  const [orderNotes, setOrderNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [clientData, setClientData] = useState({ ...EMPTY_CLIENT });
  const [clientType, setClientType] = useState(null); // 'direct' | 'walk_in'
  const [isNewClient, setIsNewClient] = useState(false);

  const { data: allClients = [] } = useQuery({
    queryKey: ['all-clients-adhoc'],
    queryFn: async () => {
      const res = await base44.functions.invoke('listAllClients');
      return res.data.clients || [];
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list(),
  });

  const { data: priceGroups = [] } = useQuery({
    queryKey: ['price-groups'],
    queryFn: () => base44.entities.PriceGroup.filter({ active: true }),
  });

  const { data: salespersons = [] } = useQuery({
    queryKey: ['salespersons'],
    queryFn: () => base44.entities.Salesperson.list(),
  });

  const { data: customPrices = [] } = useQuery({
    queryKey: ['custom-prices'],
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
      email: c.email || '',
      price_group_id: c.price_group_id || '',
      price_group_name: c.price_group_name || '',
      salesperson_id: c.salesperson_id || '',
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
            Selecione um cliente (cadastrado ou avulso) ou cadastre um novo. O histórico de pedidos fica vinculado ao cadastro.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* CLIENTE */}
          <div className="border rounded-xl p-4 space-y-3 bg-muted/20">
            <h3 className="font-semibold text-sm flex items-center gap-2"><User className="w-4 h-4 text-primary" />Cliente</h3>

            {selectedClient ? (
              <div className="flex items-start justify-between bg-background rounded-lg px-3 py-2.5">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm">{selectedClient.company_name || selectedClient.full_name}</p>
                    <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${selectedClient.client_type === 'walk_in' ? 'border-amber-400 text-amber-700' : 'border-blue-400 text-blue-700'}`}>
                      {selectedClient.client_type === 'walk_in' ? 'Avulso' : 'Cadastrado'}
                    </span>
                  </div>
                  {selectedClient.company_name && <p className="text-xs text-muted-foreground flex items-center gap-1"><Store className="w-3 h-3" />Contato: {selectedClient.full_name}</p>}
                  {selectedClient.cnpj_cpf && <p className="text-xs text-muted-foreground flex items-center gap-1"><FileText className="w-3 h-3" />{selectedClient.cnpj_cpf}</p>}
                  {(selectedClient.city || selectedClient.state) && <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" />{[selectedClient.city, selectedClient.state].filter(Boolean).join(' - ')}</p>}
                  {selectedClient.whatsapp && <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" />{selectedClient.whatsapp}</p>}
                  {clientData.price_group_name && (
                    <span className="inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary border-primary/20">{clientData.price_group_name}</span>
                  )}
                </div>
                <Button variant="ghost" size="sm" onClick={clearClient}>
                  <X className="w-4 h-4 mr-1" />Trocar
                </Button>
              </div>
            ) : (
              <>
                {/* Busca de clientes cadastrados */}
                <div className="relative">
                  <Input
                    placeholder="Buscar cliente (nome, empresa, CNPJ, WhatsApp)..."
                    value={clientSearch}
                    onChange={e => { setClientSearch(e.target.value); setIsNewClient(false); }}
                  />
                  {filteredClients.length > 0 && (
                    <div className="absolute z-50 top-full left-0 right-0 border rounded-md mt-1 max-h-44 overflow-y-auto bg-background shadow-lg">
                      {filteredClients.map(c => (
                        <div key={`${c.client_type}-${c.id}`} className="px-3 py-2 hover:bg-muted cursor-pointer border-b last:border-b-0"
                          onClick={() => selectClient(c)}>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">{c.company_name || c.full_name}</p>
                            <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${c.client_type === 'walk_in' ? 'border-amber-400 text-amber-700' : 'border-blue-400 text-blue-700'}`}>
                              {c.client_type === 'walk_in' ? 'Avulso' : 'Cadastrado'}
                            </span>
                          </div>
                          {c.company_name && <p className="text-xs text-muted-foreground">{c.full_name}</p>}
                          <div className="flex gap-2 text-xs text-muted-foreground mt-0.5">
                            {c.city && <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" />{c.city}{c.state && ` - ${c.state}`}</span>}
                            {c.whatsapp && <span className="flex items-center gap-0.5"><Phone className="w-3 h-3" />{c.whatsapp}</span>}
                            {c.cnpj_cpf && <span className="flex items-center gap-0.5"><FileText className="w-3 h-3" />{c.cnpj_cpf}</span>}
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
                  <div className="space-y-3 border rounded-lg p-3 bg-background">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Novo cliente avulso</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div><Label className="text-xs">Nome Completo *</Label><Input value={clientData.full_name} onChange={e => setClientData(p=>({...p,full_name:e.target.value}))} /></div>
                      <div><Label className="text-xs">Empresa / Estabelecimento</Label><Input value={clientData.company_name} onChange={e => setClientData(p=>({...p,company_name:e.target.value}))} /></div>
                      <div><Label className="text-xs">CNPJ / CPF</Label><Input value={clientData.cnpj_cpf} onChange={e => setClientData(p=>({...p,cnpj_cpf:e.target.value}))} /></div>
                      <div><Label className="text-xs">WhatsApp / Telefone</Label><Input value={clientData.whatsapp} onChange={e => setClientData(p=>({...p,whatsapp:e.target.value}))} /></div>
                      <div><Label className="text-xs">Endereço</Label><Input value={clientData.address} onChange={e => setClientData(p=>({...p,address:e.target.value}))} /></div>
                      <div><Label className="text-xs">Cidade</Label><CityAutocomplete value={clientData.city} onChange={v => setClientData(p=>({...p,city:v}))} state={clientData.state} /></div>
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
                      <div>
                        <Label className="text-xs">Vendedor / Responsável</Label>
                        <Select value={clientData.salesperson_id || '__none__'} onValueChange={v => setClientData(p=>({...p, salesperson_id: v==='__none__'?'':v}))}>
                          <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">— Nenhum</SelectItem>
                            {salespersons.map(s=><SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
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
            <Label className="text-xs mb-1 block">Observações do Pedido</Label>
            <Textarea placeholder="Observações internas do pedido..." value={orderNotes} onChange={e => setOrderNotes(e.target.value)} rows={2} />
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