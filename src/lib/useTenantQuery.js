import { useTenant } from './TenantContext';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

/**
 * Hook customizado que automaticamente filtra queries por tenant_id
 * @param {string} entityName - Nome da entidade (ex: 'Product', 'Order')
 * @param {object} filters - Filtros adicionais
 * @param {object} options - Opções do useQuery
 */
export function useTenantQuery(entityName, filters = {}, options = {}) {
  const { tenantId, loading: tenantLoading } = useTenant();

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

  return useQuery({
    queryKey: [`admin-${entityName}`, JSON.stringify(filters)],
    queryFn: async () => {
      return await base44.entities[entityName].filter(filters);
    },
    enabled: !tenantLoading && !tenantId, // Apenas super-admin
    ...options,
  });
}

/**
 * Query que funciona com ou sem tenant (fallback para listar tudo se não há tenant)
 */
export function useProductsQuery(filters = {}, options = {}) {
  const { tenantId, loading: tenantLoading } = useTenant();

  return useQuery({
    queryKey: ['Product', tenantId, JSON.stringify(filters)],
    queryFn: async () => {
      if (tenantId) {
        // Com tenant: filtra por tenant_id
        const mergedFilters = { tenant_id: tenantId, ...filters };
        return await base44.entities.Product.filter(mergedFilters);
      } else {
        // Sem tenant (super-admin ou preview): lista todos
        return await base44.entities.Product.list();
      }
    },
    enabled: !tenantLoading,
    ...options,
  });
}