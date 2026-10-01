import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { buildCeasaAudit, buildReconcilePlan } from '../../shared/ceasaAudit.js';
import { fetchAllPages } from '../../shared/pagination.js';

/**
 * Conferência e reconciliação CEASA — admin-only.
 *
 * SOMENTE LEITURA por padrão: `dry_run` é verdadeiro sempre que o parâmetro não
 * vier explicitamente como `false`. No modo simulação a função devolve o
 * relatório de divergências e o plano do que seria alterado, sem gravar nada.
 *
 * Execução efetiva (aprovada em etapa separada) faz UMA única coisa: inativar as
 * operações ativas de pedidos que não exigem mais NF-e, preservando Box, valor
 * CEASA, caminhão e observação. Nenhuma linha de pedido, total comercial ou
 * lançamento financeiro é tocada; nenhum valor CEASA é recalculado.
 */
const PAGE_SIZE = 500;
const MAX_PAGES = 40;
const ROW_LIMIT = 200;

async function listAll(entityApi) {
    return fetchAllPages((cursor) => {
        const options = { sort: '-created_date', limit: PAGE_SIZE };
        if (cursor) options.cursor = cursor;
        return entityApi.list(options);
    }, MAX_PAGES);
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Forbidden' }, { status: 403 });
        }

        const payload = await req.json().catch(() => ({}));
        const dryRun = payload.dry_run !== false;

        const service = base44.asServiceRole;
        const [orders, operations, boxes, receivables] = await Promise.all([
            listAll(service.entities.Order),
            listAll(service.entities.CeasaReportItem),
            listAll(service.entities.CeasaBox),
            listAll(service.entities.ContasAReceber),
        ]);

        const audit = buildCeasaAudit({
            orders: orders.items,
            operations: operations.items,
            boxes: boxes.items,
            receivables: receivables.items,
        });
        const plan = buildReconcilePlan(audit);

        const truncated = orders.truncated || operations.truncated || boxes.truncated || receivables.truncated;

        const categories = audit.categories.map((category) => ({
            key: category.key,
            label: category.label,
            description: category.description,
            count: category.rows.length,
            rows: category.rows.slice(0, ROW_LIMIT),
            rows_truncated: category.rows.length > ROW_LIMIT,
        }));

        console.log('[reconcileCeasa]', JSON.stringify({
            dry_run: dryRun,
            user: user.email,
            counts: audit.counts,
            actionable: plan.counts.deactivate,
        }));

        if (dryRun) {
            return Response.json({
                success: true,
                dry_run: true,
                executed: false,
                generated_at: audit.generated_at,
                scanned: audit.scanned,
                counts: audit.counts,
                categories,
                plan: { counts: plan.counts },
                truncated,
            });
        }

        const patches = plan.deactivate.map(({ id }) => ({ id, active: false }));
        let deactivated = 0;
        for (let i = 0; i < patches.length; i += 100) {
            const batch = patches.slice(i, i + 100);
            await service.entities.CeasaReportItem.bulkUpdate(batch);
            deactivated += batch.length;
        }

        return Response.json({
            success: true,
            dry_run: false,
            executed: true,
            generated_at: audit.generated_at,
            deactivated,
            counts: audit.counts,
        });
    } catch (error) {
        console.error('Erro na conferência/reconciliação CEASA:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});