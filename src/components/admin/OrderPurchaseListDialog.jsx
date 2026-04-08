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
export default function OrderPurchaseListDialog({ orders, userByEmail, periodLabel, onClose }) {
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
            total_qty: 0,
            total_value: 0,
            orders_count: 0,
          };
        }
        map[key].total_qty += item.quantity;
        map[key].total_value += item.unit_price * item.quantity;
        map[key].orders_count += 1;
      });
    });
    return Object.values(map).sort((a, b) => a.product_name.localeCompare(b.product_name));
  }, [orders]);

  const grandTotal = consolidated.reduce((s, i) => s + i.total_value, 0);
  const totalItems = consolidated.reduce((s, i) => s + i.total_qty, 0);

  const handlePrint = () => {
    const rows = consolidated.map(i => `
      <tr>
        <td>${i.product_name}</td>
        <td>${i.packaging_type}</td>
        <td>${i.weight}</td>
        <td style="text-align:center;font-weight:bold;font-size:16px">${i.total_qty}</td>
        <td style="text-align:right">R$ ${i.total_value.toFixed(2)}</td>
        <td style="text-align:center">${i.orders_count}</td>
      </tr>
    `).join('');

    const clientNames = [...new Set(orders.map(o => {
      const u = userByEmail[o.customer_email];
      return u?.company_name || o.customer_name || o.customer_email;
    }))].join(', ');

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html><head><title>Lista de Compra Consolidada</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 24px; color: #222; }
        h1 { font-size: 20px; margin-bottom: 4px; }
        .meta { font-size: 13px; color: #555; margin-bottom: 16px; }
        .meta p { margin: 2px 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        th, td { padding: 9px 11px; text-align: left; border: 1px solid #ddd; font-size: 13px; }
        th { background: #f0f0f0; font-weight: 600; }
        .total-row { font-weight: bold; background: #f8f8f8; }
        .summary { margin-top: 16px; text-align: right; font-size: 15px; }
        .footer { margin-top: 24px; font-size: 11px; color: #999; border-top: 1px solid #eee; padding-top: 8px; }
      </style></head><body>
      <h1>📋 Lista de Compra Consolidada</h1>
      <div class="meta">
        <p><strong>Período / Filtro:</strong> ${periodLabel}</p>
        <p><strong>Pedidos compilados:</strong> ${orders.length}</p>
        ${clientNames ? `<p><strong>Clientes:</strong> ${clientNames}</p>` : ''}
        <p><strong>Gerado em:</strong> ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
      </div>
      <table>
        <tr>
          <th>Produto</th><th>Embalagem</th><th>Peso</th>
          <th style="text-align:center">Qtd Total</th>
          <th style="text-align:right">Valor Total</th>
          <th style="text-align:center">Pedidos</th>
        </tr>
        ${rows}
        <tr class="total-row">
          <td colspan="3">TOTAL</td>
          <td style="text-align:center">${totalItems}</td>
          <td style="text-align:right">R$ ${grandTotal.toFixed(2)}</td>
          <td style="text-align:center">${orders.length}</td>
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
                  <th className="pb-2 font-semibold">Produto</th>
                  <th className="pb-2 font-semibold">Embalagem</th>
                  <th className="pb-2 font-semibold text-center">Qtd</th>
                  <th className="pb-2 font-semibold text-right">Valor</th>
                  <th className="pb-2 font-semibold text-center">Pedidos</th>
                </tr>
              </thead>
              <tbody>
                {consolidated.map((item, idx) => (
                  <tr key={idx} className="border-b hover:bg-muted/30">
                    <td className="py-2 font-medium">{item.product_name}</td>
                    <td className="py-2 text-muted-foreground text-xs">{item.packaging_type}{item.weight && ` • ${item.weight}`}</td>
                    <td className="py-2 text-center font-bold text-primary text-base">{item.total_qty}</td>
                    <td className="py-2 text-right">R$ {item.total_value.toFixed(2)}</td>
                    <td className="py-2 text-center text-muted-foreground">{item.orders_count}</td>
                  </tr>
                ))}
                <tr className="font-bold bg-muted/50">
                  <td className="py-2 pl-1">TOTAL</td>
                  <td />
                  <td className="py-2 text-center text-primary text-base">{totalItems}</td>
                  <td className="py-2 text-right">R$ {grandTotal.toFixed(2)}</td>
                  <td className="py-2 text-center">{orders.length}</td>
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