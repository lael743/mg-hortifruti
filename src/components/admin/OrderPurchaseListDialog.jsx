import React, { useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, Download } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Compila todos os itens dos pedidos fornecidos e exibe/imprime uma lista de compra consolidada.
 * Props:
 *   orders: Order[]  — pedidos já filtrados por período/grupo
 *   userByEmail: Record<string, User>
 *   periodLabel: string — descrição do período/filtro aplicado
 *   onClose: () => void
 */
// Parse weight string like "20kg", "500g", "1.5kg" → value in kg
function parseWeightKg(weightStr) {
  if (!weightStr) return null;
  const lower = weightStr.toLowerCase().replace(',', '.');
  const match = lower.match(/([\d.]+)\s*(kg|g)?/);
  if (!match) return null;
  const val = parseFloat(match[1]);
  const unit = match[2] || 'kg';
  return unit === 'g' ? val / 1000 : val;
}

export default function OrderPurchaseListDialog({ orders, userByEmail, periodLabel, onClose, companyName = '' }) {
  // Aggregate all items across orders
  const consolidated = useMemo(() => {
    const map = {};
    orders.forEach(order => {
      (order.items || []).forEach(item => {
        const key = item.product_id || item.product_name;
        if (!map[key]) {
          map[key] = {
            product_name: item.product_name,
            packaging_type: item.packaging_type || '',
            weight: item.weight || '',
            weight_kg: parseWeightKg(item.weight),
            total_qty: 0,
            total_value: 0,
            orders_count: 0,
          };
        }
        const effectivePrice = item.final_unit_price ?? item.unit_price;
        map[key].total_qty += item.quantity;
        map[key].total_value += effectivePrice * item.quantity;
        map[key].orders_count += 1;
      });
    });
    return Object.values(map).sort((a, b) => a.product_name.localeCompare(b.product_name));
  }, [orders]);

  const grandTotal = consolidated.reduce((s, i) => s + i.total_value, 0);
  const totalItems = consolidated.reduce((s, i) => s + i.total_qty, 0);
  const totalWeightKg = consolidated.reduce((s, i) => {
    if (i.weight_kg == null) return s;
    return s + i.weight_kg * i.total_qty;
  }, 0);
  const hasWeightData = consolidated.some(i => i.weight_kg != null);

  const handlePrint = () => {
    const rows = consolidated.map(i => {
      const estimatedWeight = i.weight_kg != null ? `~${(i.weight_kg * i.total_qty).toFixed(1)} kg` : '-';
      return `
      <tr>
        <td style="text-align:center;font-weight:bold;font-size:14px">${i.total_qty}</td>
        <td>${i.product_name}</td>
        <td>${i.packaging_type}${i.weight ? ' · ' + i.weight : ''}</td>
        <td style="text-align:center;color:#666">${estimatedWeight}</td>
      </tr>`;
    }).join('');

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html><head><title>Lista de Compra Consolidada</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; color: #222; }
        .company { font-size: 16px; font-weight: bold; margin-bottom: 12px; }
        h1 { font-size: 18px; margin-bottom: 2px; }
        .meta { font-size: 12px; color: #555; margin-bottom: 12px; }
        .meta p { margin: 2px 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        th, td { padding: 5px 8px; text-align: left; border: 1px solid #ccc; font-size: 12px; }
        th { background: #e8e8e8; font-weight: 600; }
        .total-row { font-weight: bold; background: #f5f5f5; }
        .footer { margin-top: 16px; font-size: 10px; color: #999; border-top: 1px solid #ddd; padding-top: 6px; }
      </style></head><body>
      ${companyName ? `<div class="company">${companyName}</div>` : ''}
      <h1>Lista de Compra Consolidada</h1>
      <div class="meta">
         <p><strong>Período / Filtro:</strong> ${periodLabel}</p>
         <p><strong>Total de pedidos:</strong> ${orders.length}</p>
         <p><strong>Gerado em:</strong> ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
       </div>
      <table>
        <tr>
          <th style="text-align:center">Qtd Total</th>
          <th>Produto</th>
          <th>Embalagem</th>
          <th style="text-align:center">Peso Est.</th>
        </tr>
        ${rows}
        <tr class="total-row">
          <td style="text-align:center">${totalItems}</td>
          <td colspan="2">TOTAL</td>
          <td style="text-align:center">${hasWeightData ? '~' + totalWeightKg.toFixed(1) + ' kg' : '-'}</td>
        </tr>
      </table>
      <div class="footer">Lista gerada automaticamente pelo sistema de pedidos.</div>
      </body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Lista de Compra Consolidada</DialogTitle>
        </DialogHeader>

        <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3 mb-3 space-y-0.5">
          <p><span className="font-medium">Filtro:</span> {periodLabel}</p>
          <p><span className="font-medium">Pedidos compilados:</span> {orders.length} &nbsp;•&nbsp; <span className="font-medium">Produtos distintos:</span> {consolidated.length}</p>
        </div>

        {consolidated.length === 0 ? (
          <p className="text-center py-10 text-muted-foreground">Nenhum item encontrado nos pedidos selecionados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                     <th className="pb-2 font-semibold text-center">Qtd Total</th>
                     <th className="pb-2 font-semibold">Produto</th>
                     <th className="pb-2 font-semibold">Embalagem</th>
                     <th className="pb-2 font-semibold text-center">Peso Est.</th>
                </tr>
              </thead>
              <tbody>
                {consolidated.map((item, idx) => (
                  <tr key={idx} className="border-b hover:bg-muted/30">
                     <td className="py-1 text-center font-bold text-primary">{item.total_qty}</td>
                     <td className="py-1 font-medium">{item.product_name}</td>
                     <td className="py-1 text-muted-foreground text-xs">{item.packaging_type}{item.weight && ` • ${item.weight}`}</td>
                     <td className="py-1 text-center text-xs text-muted-foreground">{item.weight_kg != null ? `~${(item.weight_kg * item.total_qty).toFixed(1)} kg` : '-'}</td>
                  </tr>
                ))}
                <tr className="font-bold bg-muted/50">
                   <td className="py-1 text-center text-primary">{totalItems}</td>
                   <td className="py-1">TOTAL</td>
                   <td />
                   <td className="py-1 text-center text-xs">{hasWeightData ? `~${totalWeightKg.toFixed(1)} kg` : '-'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-3">
          <Button variant="outline" onClick={onClose}>Fechar</Button>
          <Button onClick={handlePrint} className="bg-primary text-primary-foreground">
            <Printer className="w-4 h-4 mr-1" />Imprimir / Exportar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}