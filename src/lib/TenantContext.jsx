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
          const tenants = await base44.entities.Tenant.filter({ subdomain });
          if (tenants.length > 0) {
            const tenant = tenants[0];
            setTenantId(tenant.id);
            setTenantData(tenant);
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
    throw new Error('useTenant deve ser usado dentro de TenantProvider');
  }
  return context;
}