import React from 'react';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileText } from 'lucide-react';

/**
 * Painel fiscal do pedido.
 *
 * NF-e = SIM significa que o pedido participa da Gestão CEASA com TODOS os seus
 * itens. Não existe mais seleção individual de produtos para NF-e/CEASA — por
 * isso este painel não recebe nem devolve itens.
 *
 * Props:
 *  - nfeData: { requires_nfe, nfe_cnpj, nfe_company_name }
 *  - defaultCnpj / defaultCompanyName: dados do cadastro do cliente, usados para
 *    preencher CNPJ/empresa quando o campo ainda estiver vazio
 *  - onChange: (nfeData) => void
 */
export default function NfePanel({ nfeData, defaultCnpj = '', defaultCompanyName = '', onChange }) {
  const { requires_nfe, nfe_cnpj, nfe_company_name } = nfeData;

  const update = (patch) => onChange({ ...nfeData, ...patch });

  const toggleNfe = (checked) => {
    if (checked) {
      update({
        requires_nfe: true,
        nfe_cnpj: nfe_cnpj || defaultCnpj || '',
        nfe_company_name: nfe_company_name || defaultCompanyName || '',
      });
    } else {
      update({ requires_nfe: false });
    }
  };

  return (
    <div className="border-2 border-blue-200 rounded-xl p-4 space-y-4 bg-blue-50/40">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-blue-200 pt-3">
          <div>
            <Label className="text-xs">CNPJ do cliente</Label>
            <Input
              value={nfe_cnpj || ''}
              onChange={e => update({ nfe_cnpj: e.target.value })}
              placeholder="00.000.000/0001-00"
              className="bg-white"
            />
          </div>
          <div>
            <Label className="text-xs">Nome da empresa</Label>
            <Input
              value={nfe_company_name || ''}
              onChange={e => update({ nfe_company_name: e.target.value })}
              placeholder="Razão social"
              className="bg-white"
            />
          </div>
        </div>
      )}
    </div>
  );
}