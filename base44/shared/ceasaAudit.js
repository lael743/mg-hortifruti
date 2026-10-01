/**
 * Conferência CEASA: detecção de divergências e plano de reconciliação
 * (módulo puro, sem SDK — coberto por tests/ceasaAudit.test.mjs).
 *
 * Somente leitura: este módulo descreve o estado da base. Nenhuma função aqui
 * escreve nada; a execução das ações é responsabilidade da função de backend
 * reconcileCeasa, e apenas com dry_run = false explícito.
 *
 * Categorias de divergência:
 *  1. operações ativas de pedido sem NF-e (requires_nfe !== true);
 *  2. operações ativas com valor CEASA zerado em item precificado;
 *  3. operações ativas apontando para Box inexistente;
 *  4. duplicidade ativa na mesma linha (order_id + line_id);
 *  5. item de pedido com NF-e sem operação ativa;
 *  6. conta a receber sem pedido de origem.
 */

const ACTIVE = (op) => op?.active !== false;

/**
 * Preço efetivo comercial do item — espelho de src/lib/ceasaValue.js.
 */
export function effectiveUnitPrice(item) {
  const candidates = [item?.final_unit_price, item?.unit_price];
  for (const candidate of candidates) {
    const value = Number(candidate);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return 0;
}

function itemPriceOf(order, lineId) {
  const item = (order?.items || []).find(it => it.line_id && it.line_id === lineId);
  return item ? effectiveUnitPrice(item) : 0;
}

export const CATEGORIES = [
  {
    key: 'ops_sem_nfe',
    label: 'Operações ativas em pedido sem NF-e ou excluído',
    description: 'A operação continua ativa sem que o pedido participe da Gestão CEASA: o pedido deixou de exigir NF-e ou já foi excluído. A ação automática de reconciliação inativa APENAS as de pedido existente sem NF-e, preservando Box, valor, caminhão e observação; operações de pedido excluído dependem de decisão humana.',
  },
  {
    key: 'valor_zero',
    label: 'Valor CEASA zerado em item precificado',
    description: 'A operação tem valor CEASA 0 enquanto o item tem preço comercial. Nada é recalculado automaticamente: o operador decide e digita o valor na Gestão.',
  },
  {
    key: 'box_inexistente',
    label: 'Operação apontando para Box inexistente',
    description: 'O cadastro do Box foi excluído. A Gestão e a impressão passam a usar o nome histórico gravado na operação; reapontar para outro Box é decisão do operador.',
  },
  {
    key: 'duplicidade_ativa',
    label: 'Duplicidade ativa na mesma linha',
    description: 'Mais de uma operação ativa para o mesmo order_id + line_id. A sincronização mantém a canônica e inativa as demais.',
  },
  {
    key: 'item_sem_operacao',
    label: 'Item de pedido com NF-e sem operação ativa',
    description: 'Item que deveria participar da Gestão CEASA e não tem operação ativa. A sincronização do pedido recria a operação.',
  },
  {
    key: 'conta_sem_pedido',
    label: 'Conta a receber sem pedido de origem',
    description: 'Pedido excluído antes da correção deixou a conta a receber vinculada. Decisão do financeiro: cancelar ou manter.',
  },
];

/**
 * Ordem de exibição: primeiro o que a reconciliação pode corrigir (ação
 * automática), depois o mais recente. Sem isso, as ocorrências corrigíveis
 * ficavam depois das informativas, fora da prévia de 20 linhas da tela.
 */
function sortRows(rows) {
  return [...rows].sort((a, b) => {
    if (!!b.actionable !== !!a.actionable) return b.actionable ? 1 : -1;
    return String(b.criado_em || '').localeCompare(String(a.criado_em || ''));
  });
}

function baseRow(op, order) {
  return {
    operation_id: op?.id || null,
    order_id: op?.order_id || null,
    order_number: order?.order_number ?? null,
    cliente: order?.nfe_company_name || op?.client_name || order?.customer_name || '',
    produto: op?.product_name || '',
    box: op?.box_name || '',
    valor_ceasa: op?.ceasa_value ?? null,
    caminhao: op?.caminhao || '',
    criado_em: String(op?.created_date || '').slice(0, 10),
    actionable: false,
    detalhe: '',
  };
}

/**
 * Monta o relatório de divergências.
 * Devolve { generated_at, counts, categories: [{ key, label, description, rows }] }.
 */
export function buildCeasaAudit({ orders = [], operations = [], boxes = [], receivables = [] } = {}) {
  const orderById = new Map(orders.filter(Boolean).map(order => [order.id, order]));
  const boxIds = new Set(boxes.filter(Boolean).map(box => box.id));
  const activeOps = operations.filter(ACTIVE);

  // 1. Pedido sem NF-e com operação ativa (não-cancelado só faz sentido como alerta)
  const opsSemNfe = activeOps
    .filter(op => {
      const order = orderById.get(op.order_id);
      return !order || order.requires_nfe !== true;
    })
    .map(op => {
      const order = orderById.get(op.order_id);
      const pedidoExiste = !!order;
      return {
        ...baseRow(op, order),
        actionable: pedidoExiste,
        detalhe: pedidoExiste
          ? 'Pedido sem NF-e — operação deve ficar inativa'
          : 'Pedido de origem não existe mais',
      };
    });

  // 2. Valor CEASA zerado em item precificado
  const valorZero = activeOps
    .filter(op => {
      const order = orderById.get(op.order_id);
      if (!order) return false;
      if (Number(op.ceasa_value) !== 0) return false;
      return itemPriceOf(order, op.line_id) > 0;
    })
    .map(op => {
      const order = orderById.get(op.order_id);
      return {
        ...baseRow(op, order),
        detalhe: `Item precificado em R$ ${itemPriceOf(order, op.line_id).toFixed(2)} — valor CEASA zerado`,
      };
    });

  // 3. Box inexistente
  const boxInexistente = activeOps
    .filter(op => op.box_id && !boxIds.has(op.box_id))
    .map(op => ({
      ...baseRow(op, orderById.get(op.order_id)),
      detalhe: `Box "${op.box_name || op.box_id}" não existe mais no cadastro`,
    }));

  // 4. Duplicidade ativa na mesma linha
  const groups = new Map();
  activeOps.forEach(op => {
    if (!op.order_id || !op.line_id) return;
    const key = `${op.order_id}:${op.line_id}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(op);
  });
  const duplicidadeAtiva = [];
  groups.forEach(ops => {
    if (ops.length < 2) return;
    ops.forEach(op => duplicidadeAtiva.push({
      ...baseRow(op, orderById.get(op.order_id)),
      detalhe: `${ops.length} operações ativas nesta linha`,
    }));
  });

  // 5. Item de pedido com NF-e sem operação ativa
  const activeByLine = new Set(activeOps.map(op => `${op.order_id}:${op.line_id}`));
  const itemSemOperacao = [];
  orders
    .filter(order => order?.requires_nfe === true && order.status !== 'Cancelado')
    .forEach(order => {
      (order.items || []).forEach(item => {
        if (item.is_bonus) return;
        if (!item.line_id) {
          itemSemOperacao.push({
            operation_id: null,
            order_id: order.id,
            order_number: order.order_number ?? null,
            cliente: order.nfe_company_name || order.customer_name || '',
            produto: item.product_name || '',
            box: '',
            valor_ceasa: null,
            caminhao: '',
            criado_em: '',
            actionable: true,
            detalhe: 'Item sem identidade de linha (line_id) no pedido',
          });
          return;
        }
        if (activeByLine.has(`${order.id}:${item.line_id}`)) return;
        itemSemOperacao.push({
          operation_id: null,
          order_id: order.id,
          order_number: order.order_number ?? null,
          cliente: order.nfe_company_name || order.customer_name || '',
          produto: item.product_name || '',
          box: '',
          valor_ceasa: null,
          caminhao: '',
          criado_em: '',
          actionable: true,
          detalhe: 'Sem operação ativa — a sincronização do pedido recria a operação',
        });
      });
    });

  // 6. Conta a receber sem pedido de origem
  const contaSemPedido = receivables
    .filter(conta => conta?.order_id && !orderById.has(conta.order_id))
    .map(conta => ({
      operation_id: null,
      order_id: conta.order_id,
      order_number: conta.order_number ?? null,
      cliente: conta.customer_name || conta.customer_email || '',
      produto: '',
      box: '',
      valor_ceasa: conta.total_amount ?? null,
      caminhao: '',
      criado_em: String(conta.created_date || '').slice(0, 10),
      actionable: false,
      detalhe: `Conta a receber de R$ ${Number(conta.total_amount || 0).toFixed(2)} sem pedido (${conta.status || 'sem status'})`,
    }))
    .sort((a, b) => String(b.criado_em).localeCompare(String(a.criado_em)));

  const rowsByKey = {
    ops_sem_nfe: opsSemNfe,
    valor_zero: valorZero,
    box_inexistente: boxInexistente,
    duplicidade_ativa: duplicidadeAtiva,
    item_sem_operacao: itemSemOperacao,
    conta_sem_pedido: contaSemPedido,
  };

  const categories = CATEGORIES.map(category => ({
    ...category,
    rows: sortRows(rowsByKey[category.key] || []),
  }));

  const counts = {};
  categories.forEach(category => { counts[category.key] = category.rows.length; });
  counts.total = categories.reduce((sum, category) => sum + category.rows.length, 0);

  return {
    generated_at: new Date().toISOString(),
    scanned: {
      orders: orders.length,
      operations: operations.length,
      active_operations: activeOps.length,
      boxes: boxes.length,
      receivables: receivables.length,
    },
    counts,
    categories,
  };
}

/**
 * Plano de reconciliação.
 *
 * Ação automática permitida: inativar operações ativas cujo pedido existe e está
 * sem NF-e. Tudo o mais é informativo — depende de decisão humana e nunca é
 * gravado por rotina. Nenhuma linha de pedido, total comercial ou lançamento
 * financeiro é tocada.
 */
export function buildReconcilePlan(audit) {
  const semNfe = audit?.categories?.find(category => category.key === 'ops_sem_nfe')?.rows || [];
  const deactivate = semNfe
    .filter(row => row.actionable && row.operation_id)
    .map(row => ({ id: row.operation_id, active: false, order_id: row.order_id }));

  return {
    deactivate,
    counts: {
      deactivate: deactivate.length,
      informational:
        (audit?.counts?.valor_zero || 0) +
        (audit?.counts?.box_inexistente || 0) +
        (audit?.counts?.duplicidade_ativa || 0) +
        (audit?.counts?.item_sem_operacao || 0) +
        (audit?.counts?.conta_sem_pedido || 0),
    },
  };
}