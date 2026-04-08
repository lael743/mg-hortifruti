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
import { Upload, Plus } from 'lucide-react';

const DEFAULT_CATEGORIES = ['Frutas', 'Verduras', 'Legumes', 'Temperos', 'Outros'];
const DEFAULT_PACKAGING = ['Caixa', 'Saco', 'Fardo', 'Unidade'];

export default function ProductFormDialog({ product, onClose, onSaved }) {
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
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [packagings, setPackagings] = useState(DEFAULT_PACKAGING);
  const [newCategory, setNewCategory] = useState('');
  const [newPackaging, setNewPackaging] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);
  const [addingPackaging, setAddingPackaging] = useState(false);

  const handleAddCategory = () => {
    const val = newCategory.trim();
    if (val && !categories.includes(val)) {
      setCategories(prev => [...prev, val]);
      handleChange('category', val);
    }
    setNewCategory('');
    setAddingCategory(false);
  };

  const handleAddPackaging = () => {
    const val = newPackaging.trim();
    if (val && !packagings.includes(val)) {
      setPackagings(prev => [...prev, val]);
      handleChange('packaging_type', val);
    }
    setNewPackaging('');
    setAddingPackaging(false);
  };

  const handleChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

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
                    {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" size="icon" onClick={() => setAddingCategory(v => !v)}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {addingCategory && (
                <div className="flex gap-1 mt-1">
                  <Input value={newCategory} onChange={e => setNewCategory(e.target.value)} placeholder="Nova categoria" className="flex-1" onKeyDown={e => e.key === 'Enter' && handleAddCategory()} />
                  <Button type="button" size="sm" onClick={handleAddCategory}>OK</Button>
                </div>
              )}
            </div>
            <div>
              <Label>Embalagem *</Label>
              <div className="flex gap-1">
                <Select value={form.packaging_type} onValueChange={(v) => handleChange('packaging_type', v)}>
                  <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {packagings.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" size="icon" onClick={() => setAddingPackaging(v => !v)}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {addingPackaging && (
                <div className="flex gap-1 mt-1">
                  <Input value={newPackaging} onChange={e => setNewPackaging(e.target.value)} placeholder="Nova embalagem" className="flex-1" onKeyDown={e => e.key === 'Enter' && handleAddPackaging()} />
                  <Button type="button" size="sm" onClick={handleAddPackaging}>OK</Button>
                </div>
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