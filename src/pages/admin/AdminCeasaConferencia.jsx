import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import ConferenciaCategoryCard from '@/components/admin/ConferenciaCategoryCard';
import { csvCell } from '@/lib/ceasaCsv';

/**
 * Conferência CEASA — painel SOMENTE LEITURA.
 *
 * Evidencia as divergências entre pedidos e operações CEASA e permite simular a
 * reconciliação (o backend roda com dry_run e não grava nada). Nenhuma ação de
 * escrita existe nesta tela: a execução efetiva é decidida em etapa separada.
 */
export default function AdminCeasaConferencia() {
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['ceasa-conferencia'],
    queryFn: async () => {
      const response = await base44.functions.invoke('reconcileCeasa', { dry_run: true });
      return response.data;
    },
  });

  const categories = data?.categories || [];

  const exportCsv = () => {
    const header = ['Categoria', 'Pedido', 'Cliente', 'Produto', 'Box', 'Valor CEASA', 'Caminhão', 'Criado em', 'Detalhe'];
    const lines = [header.map(csvCell).join(';')];
    categories.forEach(category => {
      (category.rows || []).forEach(row => {
        lines.push([
          category.label,
          row.order_number ?? '',
          row.cliente || '',
          row.produto || '',
          row.box || '',
          row.valor_ceasa == null ? '' : Number(row.valor_ceasa).toFixed(2).replace('.', ','),
          row.caminhao || '',
          row.criado_em || '',
          row.detalhe || '',
        ].map(csvCell).join(';'));
      });
    });
    const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'conferencia-ceasa.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Relatório exportado!');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold">Conferência Ceasa</h2>
          <p className="text-sm text-muted-foreground">
            Divergências entre pedidos e operações CEASA. Painel somente leitura — a simulação não grava nada.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1" onClick={exportCsv} disabled={!data || categories.length === 0}>
            <Download className="w-4 h-4" /> Exportar CSV
          </Button>
          <Button size="sm" className="gap-1" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Simular reconciliação
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Card className="p-10 text-center text-muted-foreground">
          <Loader2 className="w-6 h-6 mx-auto animate-spin mb-2" /> Lendo pedidos e operações CEASA...
        </Card>
      ) : error ? (
        <Card className="p-8 text-center">
          <p className="text-destructive font-medium">Não foi possível carregar a conferência.</p>
          <p className="text-sm text-muted-foreground mt-1">{error.message}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>Tentar novamente</Button>
        </Card>
      ) : (
        <>
          <Card className="p-4 flex flex-wrap items-center gap-3">
            <Badge variant="secondary">{data?.scanned?.orders ?? 0} pedidos</Badge>
            <Badge variant="secondary">{data?.scanned?.active_operations ?? 0} operações ativas</Badge>
            <Badge variant={data?.counts?.total > 0 ? 'destructive' : 'secondary'}>
              {data?.counts?.total ?? 0} divergências
            </Badge>
            <Badge className="bg-primary text-primary-foreground">
              {data?.plan?.counts?.deactivate ?? 0} corrigíveis automaticamente
            </Badge>
            <span className="text-xs text-muted-foreground">
              Gerado em {data?.generated_at ? new Date(data.generated_at).toLocaleString('pt-BR') : '—'}
            </span>
            {data?.truncated && (
              <p className="w-full text-xs font-medium text-amber-700">
                A leitura atingiu o teto de segurança — parte dos registros pode não estar aqui.
              </p>
            )}
          </Card>

          <Card className="p-3 flex items-start gap-2 bg-muted/30">
            <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              Nada é gravado aqui. A reconcialiação automática disponível inativa operações ativas de pedidos
              sem NF-e, preservando Box, valor CEASA, caminhão e observação. Valores CEASA zerados não são
              recalculados: são destacados na Gestão para o operador digitar.
            </p>
          </Card>

          {categories.map(category => (
            <ConferenciaCategoryCard key={category.key} category={category} />
          ))}
        </>
      )}
    </div>
  );
}