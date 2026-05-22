import React, { useMemo } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TrendingUp, FileDown, DollarSign, ShoppingBag, CheckCircle2, Clock } from 'lucide-react';
import ProductRecommendations from '../components/catalog/ProductRecommendations';

const statusColors = {
  Pendente:  'bg-yellow-100 text-yellow-800 border-yellow-200',
  Confirmado:'bg-blue-100 text-blue-800 border-blue-200',
  Entregue:  'bg-green-100 text-green-800 border-green-200',
  Cancelado: 'bg-red-100 text-red-800 border-red-200',
};

export default function ClientFinancial() {
  const { user } = useOutletContext();
  const navigate = useNavigate();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['my-orders-fin', user?.email],
    queryFn: () => base44.entities.Order.filter({ customer_email: user.email }, '-created_date'),
    enabled: !!user,
  });

  const { data: settings = [] } = useQuery({
    queryKey: ['company-settings'],
    queryFn: () => base44.entities.CompanySettings.list(),
  });
  const company = settings[0] || {};

  const { data: allProducts = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list(),
  });

  const { data: allOrders = [] } = useQuery({
    queryKey: ['all-orders-reco'],
    queryFn: () => base44.entities.Order.list(),
    enabled: !!user,
  });

  const stats = useMemo(() => {
    const active = orders.filter(o => o.status !== 'Cancelado');
    const entregue = orders.filter(o => o.status === 'Entregue');
    const pendente = orders.filter(o => o.status === 'Pendente');
    return {
      total: active.reduce((s, o) => s + (o.total || 0), 0),
      totalEntregue: entregue.reduce((s, o) => s + (o.total || 0), 0),
      count: active.length,
      pendentes: pendente.length,
    };
  }, [orders]);

  const handleExportPDF = () => {
    const rows = orders.map(o => `
      <tr>
        <td>${format(new Date(o.created_date), 'dd/MM/yyyy')}</td>
        <td>#${o.order_number || o.id.slice(-6)}</td>
        <td>${o.items?.length || 0} itens</td>
        <td>${o.status}</td>
        <td style="text-align:right">
          <strong>R$ ${o.total?.toFixed(2)}</strong>
          ${o.discount_amount > 0 ? `<br/><span style="font-size:10px;color:#16a34a;">🏷️ Desc. R$ ${o.discount_amount.toFixed(2)}</span>` : ''}
        </td>
      </tr>
    `).join('');

    const w = window.open('', '_blank');
    w.document.write(`
      <html><head><title>Relatório Financeiro</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 32px; color: #222; }
        h1 { font-size: 22px; margin-bottom: 4px; }
        .sub { color: #666; font-size: 13px; margin-bottom: 24px; }
        .stats { display: flex; gap: 24px; margin-bottom: 24px; }
        .stat { background: #f5f5f5; padding: 16px 24px; border-radius: 8px; }
        .stat label { font-size: 11px; color: #888; display: block; margin-bottom: 4px; }
        .stat span { font-size: 20px; font-weight: bold; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #eee; font-size: 13px; }
        th { background: #f8f8f8; font-weight: 600; }
        .footer { margin-top: 32px; font-size: 11px; color: #aaa; border-top: 1px solid #eee; padding-top: 12px; }
      </style></head><body>
      <h1>Relatório Financeiro</h1>
      <div class="sub">
        ${user?.company_name || user?.full_name || user?.email} &nbsp;|&nbsp;
        ${user?.cnpj_cpf ? `CNPJ/CPF: ${user.cnpj_cpf} &nbsp;|&nbsp;` : ''}
        Emitido em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}
      </div>
      <div class="stats">
        <div class="stat"><label>Total Faturado</label><span>R$ ${stats.total.toFixed(2)}</span></div>
        <div class="stat"><label>Total Entregue</label><span>R$ ${stats.totalEntregue.toFixed(2)}</span></div>
        <div class="stat"><label>Pedidos Realizados</label><span>${stats.count}</span></div>
        <div class="stat"><label>Pendentes</label><span>${stats.pendentes}</span></div>
      </div>
      <table>
        <tr><th>Data</th><th>Pedido #</th><th>Itens</th><th>Status</th><th style="text-align:right">Valor</th></tr>
        ${rows}
      </table>
      <div class="footer">
        ${company.company_name ? `${company.company_name}` : ''}
        ${company.cnpj ? ` &nbsp;|&nbsp; CNPJ: ${company.cnpj}` : ''}
        ${company.whatsapp ? ` &nbsp;|&nbsp; WhatsApp: ${company.whatsapp}` : ''}
        ${company.report_footer ? `<br/>${company.report_footer}` : ''}
      </div>
      </body></html>
    `);
    w.document.close();
    w.print();
  };

  if (!user) { navigate('/'); return null; }

  return (
    <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Financeiro</h1>
        <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={orders.length === 0}>
          <FileDown className="w-4 h-4 mr-1" />Exportar PDF
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Faturado', value: `R$ ${stats.total.toFixed(2)}`, icon: DollarSign, color: 'text-primary' },
          { label: 'Total Entregue', value: `R$ ${stats.totalEntregue.toFixed(2)}`, icon: CheckCircle2, color: 'text-green-600' },
          { label: 'Pedidos', value: stats.count, icon: ShoppingBag, color: 'text-blue-600' },
          { label: 'Pendentes', value: stats.pendentes, icon: Clock, color: 'text-yellow-600' },
        ].map(s => (
          <Card key={s.label} className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <s.icon className={`w-4 h-4 ${s.color}`} />
              <span className="text-xs text-muted-foreground">{s.label}</span>
            </div>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
          </Card>
        ))}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-3">{Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p>Nenhum pedido encontrado.</p>
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-4 py-3 font-semibold">Data</th>
                  <th className="text-left px-4 py-3 font-semibold">Pedido</th>
                  <th className="text-left px-4 py-3 font-semibold hidden sm:table-cell">Itens</th>
                  <th className="text-left px-4 py-3 font-semibold">Status</th>
                  <th className="text-right px-4 py-3 font-semibold">Valor</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(order => (
                  <tr key={order.id} className="border-b hover:bg-muted/20 cursor-pointer" onClick={() => navigate(`/orders/${order.id}`)}>
                    <td className="px-4 py-3 text-muted-foreground">
                      {format(new Date(order.created_date), 'dd/MM/yyyy', { locale: ptBR })}
                    </td>
                    <td className="px-4 py-3 font-mono text-sm font-bold">#{order.order_number || order.id.slice(-6)}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{order.items?.length || 0}</td>
                    <td className="px-4 py-3">
                      <Badge className={`${statusColors[order.status]} border text-[10px]`}>{order.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-primary">
                      R$ {order.total?.toFixed(2)}
                      {order.discount_amount > 0 && (
                        <span className="block text-[10px] text-green-600 font-normal">
                          🏷️ -{order.discount_type === 'percent' ? `${order.discount_value}%` : `R$ ${order.discount_amount.toFixed(2)}`}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-muted/40">
                  <td colSpan={3} className="px-4 py-3 font-semibold text-sm hidden sm:table-cell">Total Geral</td>
                  <td colSpan={1} className="px-4 py-3 font-semibold text-sm sm:hidden">Total</td>
                  <td />
                  <td className="px-4 py-3 text-right font-extrabold text-primary text-base">
                    R$ {stats.total.toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}

      {/* Recommendations */}
      {orders.length > 0 && (
        <ProductRecommendations
          allProducts={allProducts}
          myOrders={orders}
          allOrders={allOrders}
          isLoggedIn={true}
          priceGroup={null}
          maxPerSection={4}
        />
      )}

      {/* WhatsApp Admin Button */}
      {company.whatsapp && (
        <Card className="p-4 bg-green-50 border-green-200">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-sm text-green-800">Dúvidas sobre pagamentos?</p>
              <p className="text-xs text-green-700 mt-0.5">Fale diretamente com nossa equipe comercial</p>
            </div>
            <a
              href={`https://wa.me/${company.whatsapp.replace(/\D/g, '')}?text=Olá! Sou ${user?.company_name || user?.full_name || user?.email} e tenho uma dúvida sobre meus pagamentos.`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button className="bg-green-600 hover:bg-green-700 text-white shrink-0">
                💬 WhatsApp
              </Button>
            </a>
          </div>
        </Card>
      )}
    </main>
  );
}