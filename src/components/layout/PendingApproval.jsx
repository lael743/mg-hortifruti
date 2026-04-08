import React from 'react';
import { Clock, LogOut, Leaf } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';

export default function PendingApproval({ status }) {
  const isRejected = status === 'rejected';
  const { data: settings = [] } = useQuery({
    queryKey: ['company-settings'],
    queryFn: () => base44.entities.CompanySettings.list(),
  });
  const company = settings[0];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center">
            <Leaf className="w-8 h-8 text-primary-foreground" />
          </div>
        </div>

        <div>
          <h1 className="text-2xl font-bold">{company?.company_name || 'Horta'}</h1>
          <p className="text-muted-foreground text-sm mt-1">Portal de Atacado</p>
        </div>

        <div className={`rounded-2xl p-8 border ${isRejected ? 'bg-red-50 border-red-100' : 'bg-card border-border'}`}>
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${isRejected ? 'bg-red-100' : 'bg-yellow-50'}`}>
            <Clock className={`w-8 h-8 ${isRejected ? 'text-red-500' : 'text-yellow-500'}`} />
          </div>

          {isRejected ? (
            <>
              <h2 className="text-xl font-bold text-red-700 mb-2">Acesso não aprovado</h2>
              <p className="text-red-600 text-sm leading-relaxed">
                Seu cadastro não foi aprovado pelo administrador. Entre em contato para mais informações.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold mb-2">Cadastro em análise</h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Seu cadastro foi recebido e está aguardando aprovação da nossa equipe. Você receberá acesso ao catálogo assim que for aprovado.
              </p>
              <div className="mt-4 p-3 bg-primary/5 rounded-xl text-sm text-primary font-medium">
                ⏳ Aprovação em até 1 dia útil
              </div>
            </>
          )}
        </div>

        <Button
          variant="ghost"
          className="text-muted-foreground"
          onClick={() => base44.auth.logout()}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sair da conta
        </Button>
      </div>
    </div>
  );
}