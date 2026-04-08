# Arquitetura Multi-Tenant da Horta SaaS

## Visão Geral

A plataforma Horta implementa isolamento de dados multi-tenant através de:

1. **Campo `tenant_id`** em todas as entidades de negócio
2. **Row-Level Security (RLS)** na Base44
3. **Contexto TenantContext** para gerenciar tenant globalmente
4. **Hook `useTenantQuery`** para queries automáticas com filtro tenant_id
5. **Detecção de subdomínio** para rotear para o tenant correto

---

## Estrutura de Dados

### Entidades com `tenant_id`:
- **Tenant** - Registro do administrador/negócio
- **User** - Usuários (admin ou cliente) com tenant_id
- **Product** - Produtos do catálogo
- **Order** - Pedidos dos clientes
- **CompanySettings** - Configurações da empresa
- **UserCart** - Carrinho de compras
- **UserFavorites** - Produtos favoritos
- **PriceGroup** - Tabelas de preço
- **ChatMessage** - Mensagens de suporte

---

## Configuração de RLS na Base44

A RLS deve ser configurada no painel administrativo da Base44. Aqui estão as regras recomendadas:

### Regra para `admin` (Administrador de Tenant):
```
SELECT: WHERE tenant_id = auth.user.tenant_id
UPDATE: WHERE tenant_id = auth.user.tenant_id
DELETE: WHERE tenant_id = auth.user.tenant_id
CREATE: SET tenant_id = auth.user.tenant_id
```

### Regra para `user` (Cliente):
```
SELECT: WHERE tenant_id = auth.user.tenant_id AND (created_by = auth.email OR customer_email = auth.email)
UPDATE: WHERE created_by = auth.email
DELETE: WHERE created_by = auth.email
```

### Regra para `superadmin`:
Sem restrições de tenant_id (acesso a todos os dados)

---

## Como Usar no Frontend

### 1. Envolver a App com TenantProvider

**App.jsx:**
```jsx
import { TenantProvider } from './lib/TenantContext';

function App() {
  return (
    <AuthProvider>
      <TenantProvider>
        <QueryClientProvider client={queryClientInstance}>
          {/* resto da app */}
        </QueryClientProvider>
      </TenantProvider>
    </AuthProvider>
  );
}
```

### 2. Usar `useTenantQuery` para Queries Automáticas

**pages/Catalog.jsx:**
```jsx
import { useTenantQuery } from '@/lib/useTenantQuery';

export default function Catalog() {
  const { data: products } = useTenantQuery('Product', { active: true });
  // Automaticamente filtra por tenant_id
  
  return (
    // render products
  );
}
```

### 3. Usar `useTenant` para Acessar Dados do Tenant

```jsx
import { useTenant } from '@/lib/TenantContext';

export default function MyComponent() {
  const { tenantId, tenantData } = useTenant();
  
  return <p>Tenant: {tenantData?.name}</p>;
}
```

---

## Fluxo de Identificação do Tenant

1. **Detecta subdomínio** → `getTenantFromSubdomain()`
2. **Busca Tenant** → Query `Tenant.filter({ subdomain })`
3. **Armazena tenantId** → `TenantContext`
4. **Filtra automaticamente** → Todas as queries incluem `tenant_id`

**Exemplos de URLs:**
- `empresaA.horta.com.br` → `tenantId = "abc123"`
- `empresaB.horta.com.br` → `tenantId = "xyz789"`
- `horta.com.br` → `tenantId = null` (super-admin)

---

## Checklist de Implementação

- [x] Entidades com `tenant_id`
- [x] TenantContext criado
- [x] useTenantQuery hook criado
- [x] Detecção de subdomínio
- [ ] RLS configurada no painel Base44
- [ ] Catalog adaptado para useTenantQuery
- [ ] AdminProducts adaptado para useTenantQuery
- [ ] AdminOrders adaptado para useTenantQuery
- [ ] Testes de isolamento de dados
- [ ] Documentação de migração para clientes

---

## Segurança

⚠️ **CRÍTICO**: RLS deve estar habilitada na Base44 para garantir isolamento real. Sem RLS, mesmo que o frontend filtre, dados podem ser expostos via API direta.

Sempre configure RLS nas entidades antes de colocar em produção.