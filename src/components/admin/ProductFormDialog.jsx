import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Upload, Plus, Pencil, Check, X, Trash2 } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

const DEFAULT_CATEGORIES = ['Frutas', 'Verduras', 'Legumes', 'Temperos', 'Outros'];
const DEFAULT_PACKAGING = ['Caixa', 'Saco', 'Fardo', 'Unidade'];

function OptionsManager({ label, items, onAdd, onEdit, onDelete }) {
  const [adding, setAdding] = useState(false);
  const [newVal, setNewVal] = useState('');
  const [editingIdx, setEditingIdx] = useState(null);
  const [editVal, setEditVal] = useState('');

  const handleAdd = () => {
    const v = newVal.trim();
    if (v) onAdd(v);
    setNewVal('');
    setAdding(false);
  };

  const handleEdit = (idx) => {
    const v = editVal.trim();
    if (v) onEdit(idx, v);
    setEditingIdx(null);
  };

  return (
    <div className="mt-1 border rounded-lg p-2 space-y-1 bg-muted/30">
      <p className="text-xs font-semibold text-muted-foreground mb-1">{label}</p>
      {items.map((item, idx) => (
        <div key={idx} className="flex items-center gap-1">
          {editingIdx === idx ? (
            <>
              <Input
                autoFocus
                value={editVal}
                onChange={e => setEditVal(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleEdit(idx); if (e.key === 'Escape') setEditingIdx(null); }}
                className="h-7 text-xs flex-1"
              />
              <button onClick={() => handleEdit(idx)} className="text-green-600 p-0.5"><Check className="w-3.5 h-3.5" /></button>
              <button onClick={() => setEditingIdx(null)} className="text-muted-foreground p-0.5"><X className="w-3.5 h-3.5" /></button>
            </>
          ) : (
            <>
              <span className="flex-1 text-sm">{item}</span>
              <button onClick={() => { setEditingIdx(idx); setEditVal(item); }} className="text-muted-foreground hover:text-foreground p-0.5">
                <Pencil className="w-3 h-3" />
              </button>
              <button onClick={() => onDelete(idx)} className="text-destructive/70 hover:text-destructive p-0.5">
                <Trash2 className="w-3 h-3" />
              </button>
            </>
          )}
        </div>
      ))}
      {adding ? (
        <div className="flex gap-1 mt-1">
          <Input
            autoFocus
            value={newVal}
            onChange={e => setNewVal(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setAdding(false); }}
            placeholder={`Nova ${label.toLowerCase()}`}
            className="h-7 text-xs flex-1"
          />
          <Button type="button" size="sm" className="h-7 text-xs px-2" onClick={handleAdd}>OK</Button>
          <Button type="button" size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={() => setAdding(false)}>×</Button>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1 text-xs text-primary hover:underline mt-1"
        >
          <Plus className="w-3 h-3" /> Adicionar nova
        </button>
      )}
    </div>
  );
}

export default function ProductFormDialog({ product, onClose, onSaved }) {
  const queryClient = useQueryClient();

  const { data: settings = [] } = useQuery({
    queryKey: ['company-settings'],
    queryFn: () => base44.entities.CompanySettings.list(),
  });
  const company = settings[0];

  const allCategories = [...new Set([...DEFAULT_CATEGORIES, ...(company?.custom_categories || [])])];
  const allPackagings = [...new Set([...DEFAULT_PACKAGING, ...(company?.custom_packagings || [])])];

  const [form, setForm] = useState({
    name: product?.name || '',
    description: product?.description || '',
    category: product?.category || 'Frutas',
    image_url: product?.image_url || '',
    packaging_type: product?.packaging_type || 'Caixa',
    weight: product?.weight || '',
    price: product?.price || '',
    promo_active: product?.promo_active || false,
    promo_price: product?.promo_price || '',
    active: product?.active !== false,
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [managingCategories, setManagingCategories] = useState(false);
  const [managingPackagings, setManagingPackagings] = useState(false);

  const handleChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const saveSettings = async (patch) => {
    if (company) {
      await base44.entities.CompanySettings.update(company.id, patch);
    }
    queryClient.invalidateQueries({ queryKey: ['company-settings'] });
    queryClient.invalidateQueries({ queryKey: ['products'] });
  };

  const handleAddCategory = async (val) => {
    if (allCategories.includes(val)) return;
    const updated = [...(company?.custom_categories || []), val];
    await saveSettings({ custom_categories: updated });
    handleChange('category', val);
  };

  const handleEditCategory = async (idx, newVal) => {
    const custom = [...(company?.custom_categories || [])];
    // idx is in allCategories, map to custom
    const item = allCategories[idx];
    const ci = custom.indexOf(item);
    if (ci !== -1) custom[ci] = newVal;
    else custom.push(newVal);
    await saveSettings({ custom_categories: custom });
  };

  const handleDeleteCategory = async (idx) => {
    const item = allCategories[idx];
    const custom = (company?.custom_categories || []).filter(c => c !== item);
    await saveSettings({ custom_categories: custom });
  };

  const handleAddPackaging = async (val) => {
    if (allPackagings.includes(val)) return;
    const updated = [...(company?.custom_packagings || []), val];
    await saveSettings({ custom_packagings: updated });
    handleChange('packaging_type', val);
  };

  const handleEditPackaging = async (idx, newVal) => {
    const custom = [...(company?.custom_packagings || [])];
    const item = allPackagings[idx];
    const ci = custom.indexOf(item);
    if (ci !== -1) custom[ci] = newVal;
    else custom.push(newVal);
    await saveSettings({ custom_packagings: custom });
  };

  const handleDeletePackaging = async (idx) => {
    const item = allPackagings[idx];
    const custom = (company?.custom_packagings || []).filter(p => p !== item);
    await saveSettings({ custom_packagings: custom });
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    handleChange('image_url', file_url);
    setUploading(false);
  };

  const handleSubmit = async () => {
    if (!form.name || !form.price) {
      toast.error('Preencha nome e preço');
      return;
    }
    setSaving(true);
    const data = { ...form, price: Number(form.price), promo_price: form.promo_price ? Number(form.promo_price) : null };
    if (product) {
      await base44.entities.Product.update(product.id, data);
      toast.success('Produto atualizado');
    } else {
      await base44.entities.Product.create(data);
      toast.success('Produto criado');
    }
    setSaving(false);
    onSaved();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? 'Editar Produto' : 'Novo Produto'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nome *</Label>
            <Input value={form.name} onChange={(e) => handleChange('name', e.target.value)} placeholder="Ex: Tomate Italiano" />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea value={form.description} onChange={(e) => handleChange('description', e.target.value)} placeholder="Descrição do produto" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Categoria *</Label>
              <div className="flex gap-1">
                <Select value={form.category} onValueChange={(v) => handleChange('category', v)}>
                  <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {allCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" size="icon" onClick={() => { setManagingCategories(v => !v); setManagingPackagings(false); }}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {managingCategories && (
                <OptionsManager
                  label="Categorias"
                  items={allCategories}
                  onAdd={handleAddCategory}
                  onEdit={handleEditCategory}
                  onDelete={handleDeleteCategory}
                />
              )}
            </div>
            <div>
              <Label>Embalagem *</Label>
              <div className="flex gap-1">
                <Select value={form.packaging_type} onValueChange={(v) => handleChange('packaging_type', v)}>
                  <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {allPackagings.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" size="icon" onClick={() => { setManagingPackagings(v => !v); setManagingCategories(false); }}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {managingPackagings && (
                <OptionsManager
                  label="Embalagens"
                  items={allPackagings}
                  onAdd={handleAddPackaging}
                  onEdit={handleEditPackaging}
                  onDelete={handleDeletePackaging}
                />
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Preço (R$) *</Label>
              <Input type="number" step="0.01" value={form.price} onChange={(e) => handleChange('price', e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <Label>Peso</Label>
              <Input value={form.weight} onChange={(e) => handleChange('weight', e.target.value)} placeholder="Ex: 20kg" />
            </div>
          </div>

          <div>
            <Label>Imagem</Label>
            <div className="flex gap-2 mt-1">
              <Input value={form.image_url} onChange={(e) => handleChange('image_url', e.target.value)} placeholder="URL da imagem" className="flex-1" />
              <label className="cursor-pointer">
                <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                <Button variant="outline" size="icon" asChild disabled={uploading}>
                  <span><Upload className="w-4 h-4" /></span>
                </Button>
              </label>
            </div>
            {form.image_url && (
              <img src={form.image_url} alt="Preview" className="w-20 h-20 rounded-lg object-cover mt-2" />
            )}
          </div>

          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div>
              <Label>Promoção</Label>
              <p className="text-xs text-muted-foreground">Destacar produto com preço promocional</p>
            </div>
            <Switch checked={form.promo_active} onCheckedChange={(v) => handleChange('promo_active', v)} />
          </div>
          {form.promo_active && (
            <div>
              <Label>Preço Promocional (R$)</Label>
              <Input type="number" step="0.01" value={form.promo_price} onChange={(e) => handleChange('promo_price', e.target.value)} placeholder="0.00" />
            </div>
          )}

          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div>
              <Label>Ativo no Catálogo</Label>
              <p className="text-xs text-muted-foreground">Produto visível para clientes</p>
            </div>
            <Switch checked={form.active} onCheckedChange={(v) => handleChange('active', v)} />
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button className="flex-1 bg-primary text-primary-foreground" onClick={handleSubmit} disabled={saving}>
              {saving ? 'Salvando...' : (product ? 'Atualizar' : 'Criar Produto')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}