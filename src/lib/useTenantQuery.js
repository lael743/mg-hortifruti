import { useTenant } from './TenantContext';
import { useQuery } from '@tanstack/react-query';

/**
 * Hook customizado que automaticamente filtra queries por tenant_id
 * @param {string} entityName - Nome da entidade (ex: 'Product', 'Order')
 * @param {object} filters - Filtros adicionais
 * @param {object} options - Opções do useQuery
 */
export function useTenantQuery(entityName, filters = {}, options = {}) {
  const { tenantId, loading: tenantLoading } = useTenant();
  const { base44 } = require('@/api/base44Client');

  return useQuery({
    queryKey: [entityName, tenantId, JSON.stringify(filters)],
    queryFn: async () => {
      if (!tenantId) return []; // Super-admin obtém todos, ou retorna vazio
      
      const mergedFilters = { tenant_id: tenantId, ...filters };
      return await base44.entities[entityName].filter(mergedFilters);
    },
    enabled: !tenantLoading && !!tenantId,
    ...options,
  });
}

/**
 * Para super-admin: query sem filtro de tenant_id
 */
export function useSuperAdminQuery(entityName, filters = {}, options = {}) {
  const { tenantId, loading: tenantLoading } = useTenant();
  const { base44 } = require('@/api/base44Client');

  return useQuery({
    queryKey: [`admin-${entityName}`, JSON.stringify(filters)],
    queryFn: async () => {
      return await base44.entities[entityName].filter(filters);
    },
    enabled: !tenantLoading && !tenantId, // Apenas super-admin
    ...options,
  });
}