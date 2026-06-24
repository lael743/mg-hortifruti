import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { MapPin, Plus, Pencil, Merge, Database, Trash2, Check } from 'lucide-react';

const STATES = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

export default function AdminCities() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterState, setFilterState] = useState('all');
  const [editingCity, setEditingCity] = useState(null);
  const [mergeCity, setMergeCity] = useState(null);
  const [seeding, setSeeding] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const { data: cities = [] } = useQuery({
    queryKey: ['cities'],
    queryFn: () => base44.entities.City.list(),
  });

  const filtered = cities.filter(c => {
    const matchName = !search || (c.name || '').toLowerCase().includes(search.toLowerCase());
    const matchState = filterState === 'all' || (c.state || '').toUpperCase() === filterState;
    return matchName && matchState;
  });

  const grouped = filtered.reduce((acc, c) => {
    const st = c.state || '—';
    if (!acc[st]) acc[st] = [];
    acc[st].push(c);
    return acc;
  }, {});
  const sortedStates = Object.keys(grouped).sort();

  const handleSeed = async () => {
    setSeeding(true);
    try {
      const res = await base44.functions.invoke('manageCities', { action: 'seed' });
      toast.success(`${res.data.seeded} cidade(s) importada(s) dos cadastros existentes!`);
      queryClient.invalidateQueries({ queryKey: ['cities'] });
    } catch (err) {
      toast.error('Erro ao importar: ' + err.message);
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Gestão de Cidades</h2>
          <p className="text-sm text-muted-foreground">
            {cities.length} cidade(s) cadastrada(s). Padronize os nomes para filtros consistentes.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleSeed} disabled={seeding}>
            <Database className="w-4 h-4 mr-1.5" />
            {seeding ? 'Importando...' : 'Importar Existentes'}
          </Button>
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="w-4 h-4 mr-1.5" />Nova Cidade
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-[200px]">
          <Input
            placeholder="Buscar cidade..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={filterState} onValueChange={setFilterState}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os estados</SelectItem>
            {STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MapPin className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              {cities.length === 0
                ? 'Nenhuma cidade cadastrada. Clique em "Importar Existentes" para começar.'
                : 'Nenhuma cidade encontrada com os filtros aplicados.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {sortedStates.map(st => (
            <Card key={st}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase">{st}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {grouped[st].map(c => (
                    <div key={c.id} className="flex items-center justify-between border rounded-lg px-3 py-2 hover:bg-muted/50">
                      <div className="flex items-center gap-2 min-w-0">
                        <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span className="text-sm font-medium truncate">{c.name}</span>
                        {!c.active && <span className="text-[10px] text-muted-foreground">(inativa)</span>}
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingCity(c)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setMergeCity(c)}>
                          <Merge className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showAdd && <AddCityDialog onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); queryClient.invalidateQueries({ queryKey: ['cities'] }); }} />}
      {editingCity && <EditCityDialog city={editingCity} onClose={() => setEditingCity(null)} onSaved={() => { setEditingCity(null); queryClient.invalidateQueries({ queryKey: ['cities'] }); }} />}
      {mergeCity && <MergeCityDialog sourceCity={mergeCity} cities={cities} onClose={() => setMergeCity(null)} onSaved={() => { setMergeCity(null); queryClient.invalidateQueries({ queryKey: ['cities'] }); }} />}
    </div>
  );
}

function AddCityDialog({ onClose, onSaved }) {
  const [name, setName] = useState('');
  const [state, setState] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Informe o nome da cidade.'); return; }
    setSaving(true);
    try {
      await base44.entities.City.create({ name: name.trim(), state: state.toUpperCase(), active: true });
      toast.success('Cidade cadastrada!');
      onSaved();
    } catch (err) {
      toast.error('Erro: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Nova Cidade</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div>
            <Label className="text-xs">Nome da Cidade *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Campo Grande" />
          </div>
          <div>
            <Label className="text-xs">Estado</Label>
            <Select value={state || '__none__'} onValueChange={v => setState(v === '__none__' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">—</SelectItem>
                {STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Salvando...' : 'Cadastrar'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditCityDialog({ city, onClose, onSaved }) {
  const [name, setName] = useState(city.name);
  const [state, setState] = useState(city.state || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Nome é obrigatório.'); return; }
    setSaving(true);
    try {
      const res = await base44.functions.invoke('manageCities', {
        action: 'rename',
        city_id: city.id,
        new_name: name.trim(),
        new_state: state.toUpperCase(),
      });
      toast.success(`Cidade renomeada! ${res.data.walk_in_updated + res.data.users_updated} cadastro(s) atualizado(s).`);
      onSaved();
    } catch (err) {
      toast.error('Erro: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Editar Cidade</DialogTitle>
          <DialogDescription>
            Renomear a cidade atualizará automaticamente todos os clientes que a utilizam.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div>
            <Label className="text-xs">Nome da Cidade *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Estado</Label>
            <Select value={state || '__none__'} onValueChange={v => setState(v === '__none__' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">—</SelectItem>
                {STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : <><Check className="w-4 h-4 mr-1" />Salvar e Atualizar</>}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MergeCityDialog({ sourceCity, cities, onClose, onSaved }) {
  const [targetId, setTargetId] = useState('');
  const [saving, setSaving] = useState(false);

  const targetCities = cities.filter(c => c.id !== sourceCity.id);

  const handleMerge = async () => {
    if (!targetId) { toast.error('Selecione a cidade de destino.'); return; }
    setSaving(true);
    try {
      const res = await base44.functions.invoke('manageCities', {
        action: 'merge',
        source_city_id: sourceCity.id,
        target_city_id: targetId,
      });
      toast.success(`Cidade mesclada! ${res.data.walk_in_updated + res.data.users_updated} cadastro(s) atualizado(s).`);
      onSaved();
    } catch (err) {
      toast.error('Erro: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Mesclar Cidade</DialogTitle>
          <DialogDescription>
            Todos os clientes cadastrados em <strong>{sourceCity.name}</strong> serão transferidos para a cidade de destino, e esta será removida.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div>
            <Label className="text-xs">Cidade de Destino *</Label>
            <Select value={targetId} onValueChange={setTargetId}>
              <SelectTrigger><SelectValue placeholder="Selecionar cidade..." /></SelectTrigger>
              <SelectContent>
                {targetCities.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}{c.state ? ` - ${c.state}` : ''}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button variant="destructive" onClick={handleMerge} disabled={saving}>
              {saving ? 'Mesclando...' : <><Merge className="w-4 h-4 mr-1" />Mesclar</>}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}