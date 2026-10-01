import { base44 } from '@/api/base44Client';
import { listAllPages } from '@/lib/pagination';
import {
  buildOrderIdMap,
  collectionOf,
  remapOrderReference,
  toRestorable,
} from '@/lib/backupMappings';

const MODULES = {
  products: 'Produtos',
  orders: 'Pedidos',
  clients: 'Clientes',
  priceGroups: 'Tabelas de Preço',
  settings: 'Configurações',
  ceasaOperations: 'Operações CEASA',
  receivables: 'Contas a Receber',
};

export async function exportBackup(module) {
  try {
    const timestamp = new Date().toISOString().split('T')[0];
    let data = {};
    const truncated = [];

    if (module === 'all' || module === 'products') {
      data.products = await base44.entities.Product.list();
    }
    if (module === 'all' || module === 'orders') {
      data.orders = await base44.entities.Order.list();
    }
    if (module === 'all' || module === 'clients') {
      data.clients = await base44.entities.User.list();
    }
    if (module === 'all' || module === 'priceGroups') {
      data.priceGroups = await base44.entities.PriceGroup.list();
    }
    if (module === 'all' || module === 'settings') {
      data.settings = await base44.entities.CompanySettings.list();
    }
    // Operações CEASA e contas a receber passam de uma página: leitura completa
    // por cursor, com aviso explícito caso o teto de segurança seja atingido.
    if (module === 'all' || module === 'ceasaOperations') {
      const result = await listAllPages(base44.entities.CeasaReportItem);
      data.ceasaOperations = result.items;
      if (result.truncated) truncated.push('Operações CEASA');
    }
    if (module === 'all' || module === 'receivables') {
      const result = await listAllPages(base44.entities.ContasAReceber);
      data.receivables = result.items;
      if (result.truncated) truncated.push('Contas a Receber');
    }

    if (truncated.length) data._truncated = truncated;

    const filename = module === 'all' 
      ? `backup-completo-${timestamp}.json`
      : `backup-${module}-${timestamp}.json`;

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    const warning = truncated.length ? ` Atenção: leitura parcial em ${truncated.join(', ')}.` : '';
    return { success: true, message: `Backup de ${MODULES[module] || module} exportado com sucesso.${warning}`, filename };
  } catch (error) {
    console.error('Export backup error:', error);
    return { success: false, message: 'Erro ao exportar backup', error };
  }
}

export async function importBackup(file, options = {}) {
  try {
    const text = await file.text();
    const data = JSON.parse(text);

    let results = {
      products: 0,
      orders: 0,
      priceGroups: 0,
      settings: 0,
      ceasaOperations: 0,
      receivables: 0,
      errors: [],
    };

    // Pedidos restaurados: mapa ID antigo → ID novo, para reapontar os
    // relacionamentos das contas a receber e das operações CEASA.
    let orderIdMap = new Map();

    // Importar Produtos
    if (data.products && data.products.length > 0) {
      try {
        const productsToCreate = data.products.map(({ id, created_date, updated_date, created_by, ...rest }) => rest);
        const chunks = chunkArray(productsToCreate, 50);
        
        for (const chunk of chunks) {
          await base44.entities.Product.bulkCreate(chunk);
        }
        results.products = productsToCreate.length;
      } catch (e) {
        results.errors.push(`Produtos: ${e.message}`);
      }
    }

    // Importar Pedidos
    if (data.orders && data.orders.length > 0) {
      try {
        const ordersToCreate = data.orders.map(({ id, created_date, updated_date, created_by, ...rest }) => rest);
        const chunks = chunkArray(ordersToCreate, 50);
        const createdOrders = [];
        
        for (const chunk of chunks) {
          const created = await base44.entities.Order.bulkCreate(chunk);
          createdOrders.push(...collectionOf(created));
        }
        results.orders = ordersToCreate.length;
        orderIdMap = buildOrderIdMap(data.orders, createdOrders);
      } catch (e) {
        results.errors.push(`Pedidos: ${e.message}`);
      }
    }

    // Importar Operações CEASA (dependem dos pedidos restaurados)
    if (data.ceasaOperations && data.ceasaOperations.length > 0) {
      try {
        const operationsToCreate = data.ceasaOperations.map((record) =>
          remapOrderReference(toRestorable(record), orderIdMap, { rebuildItemKey: true }));
        const chunks = chunkArray(operationsToCreate, 50);

        for (const chunk of chunks) {
          await base44.entities.CeasaReportItem.bulkCreate(chunk);
        }
        results.ceasaOperations = operationsToCreate.length;
      } catch (e) {
        results.errors.push(`Operações CEASA: ${e.message}`);
      }
    }

    // Importar Contas a Receber (dependem dos pedidos restaurados)
    if (data.receivables && data.receivables.length > 0) {
      try {
        const receivablesToCreate = data.receivables.map((record) =>
          remapOrderReference(toRestorable(record), orderIdMap));
        const chunks = chunkArray(receivablesToCreate, 50);

        for (const chunk of chunks) {
          await base44.entities.ContasAReceber.bulkCreate(chunk);
        }
        results.receivables = receivablesToCreate.length;
      } catch (e) {
        results.errors.push(`Contas a Receber: ${e.message}`);
      }
    }

    // Importar Tabelas de Preço
    if (data.priceGroups && data.priceGroups.length > 0) {
      try {
        const groupsToCreate = data.priceGroups.map(({ id, created_date, updated_date, created_by, ...rest }) => rest);
        
        for (const group of groupsToCreate) {
          await base44.entities.PriceGroup.create(group);
        }
        results.priceGroups = groupsToCreate.length;
      } catch (e) {
        results.errors.push(`Tabelas de Preço: ${e.message}`);
      }
    }

    // Importar Configurações
    if (data.settings && data.settings.length > 0) {
      try {
        for (const setting of data.settings) {
          const { id, created_date, updated_date, created_by, ...rest } = setting;
          if (id) {
            await base44.entities.CompanySettings.update(id, rest);
          } else {
            await base44.entities.CompanySettings.create(rest);
          }
        }
        results.settings = data.settings.length;
      } catch (e) {
        results.errors.push(`Configurações: ${e.message}`);
      }
    }

    return {
      success: results.errors.length === 0,
      message: `Backup importado: ${results.products} produtos, ${results.orders} pedidos, ${results.ceasaOperations} operações CEASA, ${results.receivables} contas a receber, ${results.priceGroups} tabelas, ${results.settings} configurações`,
      results,
    };
  } catch (error) {
    console.error('Import backup error:', error);
    return { success: false, message: 'Erro ao importar backup: formato inválido', error };
  }
}

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

export const MODULES_LIST = MODULES;