export function getTenantFromSubdomain() {
  const host = window.location.hostname;
  const parts = host.split('.');
  
  // localhost:5173 ou app.local = sem subdomain (super-admin)
  if (parts.length < 2 || host.includes('localhost') || host.includes('.local')) {
    return null; // Super-admin
  }
  
  // empresaA.horta.com.br = subdomain é "empresaA"
  if (parts[0] !== 'horta' && parts[0] !== 'www') {
    return parts[0];
  }
  
  return null; // Domínio principal = super-admin
}

export function buildTenantUrl(subdomain) {
  const host = window.location.hostname;
  const isLocalhost = host.includes('localhost');
  const protocol = window.location.protocol;
  
  if (isLocalhost) {
    return `${protocol}//localhost:5173`; // Local dev, sem suporte a subdomínios
  }
  
  const baseDomain = host.split('.').slice(1).join('.'); // Remove o primeiro subdomain
  return `${protocol}//${subdomain}.${baseDomain}`;
}

export function getCurrentTenantId(user) {
  // Se o usuário é super-admin (role === 'superadmin'), retorna null para indicar acesso a todos
  if (user?.role === 'superadmin') {
    return null;
  }
  
  // Senão, retorna o tenant_id do usuário
  return user?.tenant_id || null;
}