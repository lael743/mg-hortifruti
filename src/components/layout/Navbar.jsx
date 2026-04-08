import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, Menu, User, LogOut, Package, LayoutDashboard, Leaf, TrendingUp, MessageCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { getCart, getCartCount } from '@/lib/cartStore';

export default function Navbar({ user }) {
  const [cartCount, setCartCount] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    const update = () => setCartCount(getCartCount(getCart()));
    update();
    window.addEventListener('cart-updated', update);
    return () => window.removeEventListener('cart-updated', update);
  }, []);

  const { data: settings = [] } = useQuery({
    queryKey: ['company-settings'],
    queryFn: () => base44.entities.CompanySettings.list(),
    enabled: !!user,
  });
  const company = settings[0];
  const adminWhatsApp = company?.whatsapp;

  const navLinks = user ? [
    { label: 'Catálogo', path: '/' },
    { label: 'Meus Pedidos', path: '/orders' },
    ...(!isAdmin ? [{ label: 'Financeiro', path: '/financial' }] : []),
  ] : [];

  if (isAdmin) {
    navLinks.push({ label: 'Painel Admin', path: '/admin' });
  }

  return (
    <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-xl border-b border-border">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          {company?.logo_url ? (
            <img src={company.logo_url} alt="logo" className="h-9 w-auto object-contain rounded" />
          ) : (
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
              <Leaf className="w-5 h-5 text-primary-foreground" />
            </div>
          )}
          <span className="font-bold text-lg tracking-tight hidden sm:block">
            {company?.company_name || <><span>HortiFruti</span><span className="text-primary">B2B</span></>}
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map(link => (
            <Link key={link.path} to={link.path}>
              <Button variant="ghost" size="sm" className="text-sm font-medium">{link.label}</Button>
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {/* WhatsApp admin shortcut for clients */}
          {user && !isAdmin && adminWhatsApp && (
            <a
              href={`https://wa.me/${adminWhatsApp.replace(/\D/g, '')}?text=Olá! Sou ${user.company_name || user.full_name || user.email} e preciso de ajuda.`}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex"
            >
              <button className="flex items-center gap-1.5 text-xs bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-full font-medium transition-colors">
                <MessageCircle className="w-3.5 h-3.5" />WhatsApp
              </button>
            </a>
          )}

          {user && (
            <Link to="/cart" className="relative">
              <Button variant="ghost" size="icon" className="relative">
                <ShoppingCart className="w-5 h-5" />
                {cartCount > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-[10px] bg-accent text-accent-foreground">
                    {cartCount}
                  </Badge>
                )}
              </Button>
            </Link>
          )}

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <User className="w-5 h-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <div className="px-3 py-2 border-b">
                  <p className="text-sm font-medium truncate">{user.full_name || user.email}</p>
                  <p className="text-xs text-muted-foreground">{isAdmin ? 'Administrador' : 'Cliente'}</p>
                </div>
                <DropdownMenuItem onClick={() => navigate('/orders')}>
                  <Package className="w-4 h-4 mr-2" />Meus Pedidos
                </DropdownMenuItem>
                {!isAdmin && (
                  <DropdownMenuItem onClick={() => navigate('/financial')}>
                    <TrendingUp className="w-4 h-4 mr-2" />Financeiro
                  </DropdownMenuItem>
                )}
                {isAdmin && (
                  <DropdownMenuItem onClick={() => navigate('/admin')}>
                    <LayoutDashboard className="w-4 h-4 mr-2" />Painel Admin
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => base44.auth.logout()}>
                  <LogOut className="w-4 h-4 mr-2" />Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button size="sm" className="bg-primary text-primary-foreground" onClick={() => base44.auth.redirectToLogin()}>
              Entrar
            </Button>
          )}

          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <nav className="flex flex-col gap-2 mt-8">
                {navLinks.map(link => (
                  <Link key={link.path} to={link.path} onClick={() => setMobileOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start">{link.label}</Button>
                  </Link>
                ))}
                {user && (
                  <Button variant="ghost" className="w-full justify-start text-destructive" onClick={() => base44.auth.logout()}>
                    <LogOut className="w-4 h-4 mr-2" />Sair
                  </Button>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}