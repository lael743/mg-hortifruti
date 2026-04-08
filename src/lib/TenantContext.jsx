import React, { createContext, useContext, useEffect, useState } from 'react';
import { getTenantFromSubdomain } from './tenantUtils';
import { base44 } from '@/api/base44Client';

const TenantContext = createContext();

export function TenantProvider({ children }) {
  const [tenantId, setTenantId] = useState(null);
  const [tenantData, setTenantData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTenant() {
      try {
        const subdomain = getTenantFromSubdomain();
        
        if (subdomain) {
          // Busca o tenant pelo subdomínio
          try {
            const tenants = await base44.entities.Tenant.filter({ subdomain, status: 'active' });
            if (tenants.length > 0) {
              const tenant = tenants[0];
              setTenantId(tenant.id);
              setTenantData(tenant);
            } else {
              console.warn(`Tenant com subdomínio '${subdomain}' não encontrado ou inativo`);
            }
          } catch (filterErr) {
            console.warn('Erro ao filtrar tenant:', filterErr);
            // Tenta listar todos e encontra manualmente
            const allTenants = await base44.entities.Tenant.list();
            const tenant = allTenants.find(t => t.subdomain === subdomain && t.status === 'active');
            if (tenant) {
              setTenantId(tenant.id);
              setTenantData(tenant);
            }
          }
        }
        // Se não há subdomínio, é super-admin (tenantId = null)
      } catch (e) {
        console.error('Erro ao carregar tenant:', e);
      } finally {
        setLoading(false);
      }
    }

    loadTenant();
  }, []);

  return (
    <TenantContext.Provider value={{ tenantId, tenantData, loading }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) {
    console.error('useTenant: contexto não disponível');
    return { tenantId: null, tenantData: null, loading: false };
  }
  return context;
}