import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Download, Upload, Database, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { exportBackup, importBackup, MODULES_LIST } from '@/lib/backupService';
import { toast } from 'sonner';

export default function AdminBackup() {
  const [exporting, setExporting] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const handleExport = async (module) => {
    setExporting(module);
    const result = await exportBackup(module);
    setExporting(null);
    toast.success(result.message);
  };

  const handleImportChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportResult(null);
    
    const result = await importBackup(file);
    
    if (result.success) {
      toast.success(result.message);
      setImportResult({ success: true, data: result.results });
    } else {
      toast.error(result.message);
      setImportResult({ success: false, message: result.message });
    }
    
    setImporting(false);
    e.target.value = '';
  };

  return (
    <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Database className="w-8 h-8" />
          Backup e Restauração
        </h1>
        <p className="text-muted-foreground mt-2">Exporte e importe dados dos diferentes módulos do sistema</p>
      </div>

      {/* Export Section */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Exportar Backup</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(MODULES_LIST).map(([key, label]) => (
            <Card key={key} className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">{label}</h3>
                  <p className="text-xs text-muted-foreground mt-1">Exportar dados de {label.toLowerCase()}</p>
                </div>
                <Button
                  onClick={() => handleExport(key)}
                  disabled={exporting === key}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  {exporting === key ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  {exporting === key ? 'Exportando...' : 'Exportar'}
                </Button>
              </div>
            </Card>
          ))}

          {/* Export All */}
          <Card className="p-4 bg-primary/5 border-primary/20 md:col-span-2">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">Backup Completo</h3>
                <p className="text-xs text-muted-foreground mt-1">Exportar todos os dados do sistema</p>
              </div>
              <Button
                onClick={() => handleExport('all')}
                disabled={exporting === 'all'}
                className="gap-2"
                size="sm"
              >
                {exporting === 'all' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                {exporting === 'all' ? 'Exportando...' : 'Backup Completo'}
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* Import Section */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Importar Backup</h2>
        
        <Card className="p-6">
          <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
            <Upload className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
            <h3 className="font-medium mb-1">Selecionar arquivo de backup</h3>
            <p className="text-sm text-muted-foreground mb-4">Arraste um arquivo JSON aqui ou clique para selecionar</p>
            
            <input
              type="file"
              accept=".json"
              onChange={handleImportChange}
              disabled={importing}
              className="hidden"
              id="backup-file"
            />
            
            <Button
              onClick={() => document.getElementById('backup-file').click()}
              disabled={importing}
              variant="outline"
              className="gap-2"
            >
              {importing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              {importing ? 'Importando...' : 'Selecionar arquivo'}
            </Button>
          </div>

          {/* Import Result */}
          {importResult && (
            <div className="mt-6 pt-6 border-t">
              {importResult.success ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-medium text-green-900">Importação bem-sucedida</h4>
                      <ul className="text-sm text-green-800 mt-2 space-y-1">
                        {importResult.data.products > 0 && <li>✓ {importResult.data.products} produtos importados</li>}
                        {importResult.data.orders > 0 && <li>✓ {importResult.data.orders} pedidos importados</li>}
                        {importResult.data.ceasaOperations > 0 && <li>✓ {importResult.data.ceasaOperations} operações CEASA importadas</li>}
                        {importResult.data.receivables > 0 && <li>✓ {importResult.data.receivables} contas a receber importadas</li>}
                        {importResult.data.priceGroups > 0 && <li>✓ {importResult.data.priceGroups} tabelas importadas</li>}
                        {importResult.data.settings > 0 && <li>✓ {importResult.data.settings} configurações atualizadas</li>}
                      </ul>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-medium text-red-900">Erro na importação</h4>
                      <p className="text-sm text-red-800 mt-1">{importResult.message}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900">
          <p className="font-medium mb-2">⚠️ Importante</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Faça backup regularmente dos seus dados</li>
            <li>Certifique-se de que o arquivo JSON está no formato correto</li>
            <li>A importação não sobrescreve dados existentes, apenas adiciona novos registros</li>
            <li>Recomenda-se fazer backup antes de operações críticas</li>
          </ul>
        </div>
      </div>
    </main>
  );
}