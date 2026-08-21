import React from 'react';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { FileText, Truck } from 'lucide-react';

/**
 * Painel de seleção de NF-e para pedidos.
 * Props:
 *  - items: array de itens do pedido (será imutável aqui; mudanças via onChange)
 *  - nfeData: { requires_nfe, nfe_cnpj, nfe_company_name, caminhao }
 *  - defaultCnpj / defaultCompanyName: valores do cadastro do cliente para pre-fill
 *  - onChange: ({ items, nfeData }) => void
 */
export default function NfeSelectionPanel({
  items = [],
  nfeData,
  defaultCnpj = '',
  defaultCompanyName = '',
  onChange,
}) {
  const { requires_nfe, nfe_cnpj, nfe_company_name, caminhao } = nfeData;

  const updateNfeData = (patch) => {
    onChange({ items, nfeData: { ...nfeData, ...patch } });
  };

  const toggleNfe = (checked) => {
    if (checked) {
      // Ativa NF-e: marca todos os itens como incluídos e preenche CNPJ/empresa se vazios
      const newItems = items.map(it => ({ ...it, nfe_included: it.is_bonus ? false : true }));
      onChange({
        items: newItems,
        nfeData: {
          ...nfeData,
          requires_nfe: true,
          nfe_cnpj: nfe_cnpj || defaultCnpj || '',
          nfe_company_name: nfe_company_name || defaultCompanyName || '',
        },
      });
    } else {
      updateNfeData({ requires_nfe: false });
    }
  };

  const toggleItemIncluded = (idx, checked) => {
    const newItems = items.map((it, i) => i === idx ? { ...it, nfe_included: checked } : it);
    onChange({ items: newItems, nfeData });
  };

  const setItemNfeValue = (idx, value) => {
    const num = parseFloat(value);
    const newItems = items.map((it, i) =>
      i === idx ? { ...it, nfe_value: (!isNaN(num) && num >= 0 ? num : null) } : it
    );
    onChange({ items: newItems, nfeData });
  };

  const nfeItems = items.filter(it => !it.is_bonus && it.nfe_included);

  // "Meia nota": todos os itens incluídos têm nfe_value exatamente metade do preço efetivo
  const effectivePriceOf = (it) => it.final_unit_price ?? it.unit_price ?? 0;
  const isMeia = nfeItems.length > 0 && nfeItems.every(it =>
    it.nfe_value != null && Math.abs(it.nfe_value - effectivePriceOf(it) / 2) < 0.01
  );

  const handleToggleMeia = (checked) => {
    const newItems = items.map(it => {
      if (it.is_bonus) return it;
      const base = effectivePriceOf(it);
      return checked
        ? { ...it, nfe_value: +(base / 2).toFixed(2) }
        : { ...it, nfe_value: null };
    });
    onChange({ items: newItems, nfeData });
  };

  const nonBonusItems = items.filter(it => !it.is_bonus);
  const allIncluded = nonBonusItems.length > 0 && nonBonusItems.every(it => it.nfe_included);
  const handleToggleAll = (checked) => {
    const newItems = items.map(it => it.is_bonus ? it : { ...it, nfe_included: checked });
    onChange({ items: newItems, nfeData });
  };

  return (
    <div className="border-2 border-blue-200 rounded-xl p-4 space-y-4 bg-blue-50/40">
      {/* Toggle principal */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600" />
          <div>
            <p className="font-semibold text-sm">NF-e (Nota Fiscal)</p>
            <p className="text-xs text-muted-foreground">
              Marque se este pedido precisa de Nota Fiscal eletrônica
            </p>
          </div>
        </div>
        <Switch checked={!!requires_nfe} onCheckedChange={toggleNfe} />
      </div>

      {requires_nfe && (
        <>
          {/* Dados fiscais do cliente */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-blue-200 pt-3">
            <div className="sm:col-span-1">
              <Label className="text-xs">CNPJ do cliente</Label>
              <Input
                value={nfe_cnpj || ''}
                onChange={e => updateNfeData({ nfe_cnpj: e.target.value })}
                placeholder="00.000.000/0001-00"
                className="bg-white"
              />
            </div>
            <div className="sm:col-span-1">
              <Label className="text-xs">Nome da empresa</Label>
              <Input
                value={nfe_company_name || ''}
                onChange={e => updateNfeData({ nfe_company_name: e.target.value })}
                placeholder="Razão social"
                className="bg-white"
              />
            </div>
            <div>
              <Label className="text-xs flex items-center gap-1">
                <Truck className="w-3 h-3" /> Caminhão / Rota
              </Label>
              <Input
                value={caminhao || ''}
                onChange={e => updateNfeData({ caminhao: e.target.value })}
                placeholder="Ex: BITRUCK"
                className="bg-white"
              />
            </div>
          </div>

          {/* Seleção de itens */}
          <div className="border-t border-blue-200 pt-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Itens para NF-e
              </p>
              <Badge variant="secondary" className="text-xs">
                {nfeItems.length} de {items.filter(it => !it.is_bonus).length} selecionados
              </Badge>
            </div>

            {/* Meia nota + Marcar/desmarcar todos */}
            <div className="flex flex-col sm:flex-row gap-2 mb-2">
              <div className="flex items-center justify-between gap-3 flex-1 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-amber-800">Meia nota</span>
                  <span className="text-[11px] text-amber-700/80">
                    Deixa todos os valores da NF-e pela metade
                  </span>
                </div>
                <Switch checked={isMeia} onCheckedChange={handleToggleMeia} />
              </div>
              <div className="flex items-center justify-between gap-3 flex-1 rounded-lg border border-blue-300 bg-blue-50 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-blue-800">Todos os itens</span>
                  <span className="text-[11px] text-blue-700/80">
                    Marcar ou desmarcar todos de uma vez
                  </span>
                </div>
                <Switch checked={allIncluded} onCheckedChange={handleToggleAll} />
              </div>
            </div>

            <div className="space-y-1.5 max-h-52 overflow-y-auto">
              {items.filter(it => !it.is_bonus).map((item, idx) => {
                const realIdx = items.indexOf(item);
                const included = !!item.nfe_included;
                const effectiveValue = item.nfe_value != null ? item.nfe_value : (item.final_unit_price ?? item.unit_price);
                const isOverridden = item.nfe_value != null;
                return (
                  <div
                    key={item.product_id || realIdx}
                    className={`flex items-center gap-2 rounded-lg px-2 py-1.5 border ${included ? 'bg-white border-blue-200' : 'bg-muted/40 border-transparent opacity-60'}`}
                  >
                    <Checkbox
                      checked={included}
                      onCheckedChange={(v) => toggleItemIncluded(realIdx, !!v)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.product_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.packaging_type}{item.weight ? ` • ${item.weight}` : ''} • Qtd: {item.quantity}
                      </p>
                    </div>
                    {included && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Label className="text-[10px] text-muted-foreground whitespace-nowrap">Valor NF-e</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={isOverridden ? String(item.nfe_value) : ''}
                          onChange={e => setItemNfeValue(realIdx, e.target.value)}
                          placeholder={String(effectiveValue ?? '')}
                          className="h-7 w-20 text-right text-xs px-1.5 bg-white"
                          title="Sobrescrever valor fiscal (meia nota). Deixe vazio para usar o preço do pedido."
                        />
                      </div>
                    )}
                  </div>
                );
              })}
              {items.filter(it => !it.is_bonus).length === 0 && (
                <p className="text-center text-xs text-muted-foreground py-3">Nenhum item no pedido.</p>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              Por padrão todos os itens são incluídos. Desmarque os que não precisam de NF-e.
              O campo <strong>Valor NF-e</strong> sobrescreve o preço do pedido na exportação fiscal (meia nota) — deixe vazio para usar o preço original.
            </p>
          </div>
        </>
      )}
    </div>
  );
}