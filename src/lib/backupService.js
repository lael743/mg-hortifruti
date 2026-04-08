import { base44 } from '@/api/base44Client';

const MODULES = {
  products: 'Produtos',
  orders: 'Pedidos',
  clients: 'Clientes',
  priceGroups: 'Tabelas de Preço',
  settings: 'Configurações',
};

export async function exportBackup(module) {
  try {
    const timestamp = new Date().toISOString().split('T')[0];
    let data = {};

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

    return { success: true, message: `Backup de ${module} exportado com sucesso`, filename };
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
      clients: 0,
      priceGroups: 0,
      settings: 0,
      errors: [],
    };

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
        
        for (const chunk of chunks) {
          await base44.entities.Order.bulkCreate(chunk);
        }
        results.orders = ordersToCreate.length;
      } catch (e) {
        results.errors.push(`Pedidos: ${e.message}`);
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
      message: `Backup importado: ${results.products} produtos, ${results.orders} pedidos, ${results.priceGroups} tabelas, ${results.settings} configurações`,
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