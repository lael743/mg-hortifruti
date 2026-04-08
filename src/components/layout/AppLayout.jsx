import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import PendingApproval from './PendingApproval';
import { base44 } from '@/api/base44Client';

export default function AppLayout() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      const isAuth = await base44.auth.isAuthenticated();
      if (isAuth) {
        const me = await base44.auth.me();
        setUser(me);
      }
      setLoading(false);
    }
    loadUser();
  }, []);

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  // Non-admin logged-in users must be approved
  if (user && user.role !== 'admin') {
    const status = user.status || 'pending';
    if (status !== 'approved') {
      return <PendingApproval status={status} />;
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} />
      <Outlet context={{ user }} />
    </div>
  );
}