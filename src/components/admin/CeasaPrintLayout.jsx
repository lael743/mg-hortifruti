import React from 'react';

/**
 * Impressão única da "Relação de Vendas e Boxes CEASA".
 *
 * Estrutura: uma página por Box.
 *   BOX
 *     ├── Cliente + CNPJ  (cabeçalho do grupo, aparece UMA vez)
 *     │     ├── tabela de produtos
 *     │     └── Total do Cliente
 *     └── TOTAL GERAL DO BOX
 *
 * Cliente e CNPJ NÃO são colunas da tabela — são informações do cabeçalho do
 * grupo. Usa exclusivamente os dados da operação CEASA (CeasaReportItem).
 * Itens sem Box não são impressos.
 *
 * Props:
 *  - groups: [{ box, rows: [] }]
 *  - company: CompanySettings
 *  - startDate, endDate (ISO date strings)
 *  - fmtDate: (str) => string formatada
 */

const money = (n) => (n != null && !isNaN(n)) ? Number(n).toFixed(2).replace('.', ',') : '0,00';

const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 11,
  tableLayout: 'fixed',
};

// Larguras fixas das 6 colunas — garantem o alinhamento entre a tabela de cada
// cliente e a linha de TOTAL GERAL DO BOX.
const colGroup = (
  <colgroup>
    <col style={{ width: 78 }} />
    <col />
    <col style={{ width: 45 }} />
    <col style={{ width: 70 }} />
    <col style={{ width: 80 }} />
    <col style={{ width: 100 }} />
  </colgroup>
);

const thStyle = {
  textAlign: 'left',
  borderBottom: '1px solid #94a3b8',
  background: '#e2e8f0',
  padding: '3px 5px',
  fontWeight: 700,
  fontSize: 10,
  textTransform: 'uppercase',
  color: '#1e293b',
  whiteSpace: 'nowrap',
};

const tdStyle = {
  borderBottom: '1px solid #e2e8f0',
  padding: '2px 5px',
  lineHeight: '1.2',
  verticalAlign: 'top',
  overflow: 'hidden',
};

const totalCellStyle = {
  ...tdStyle,
  fontWeight: 700,
  background: '#f8fafc',
};

const boxTotalCellStyle = {
  ...tdStyle,
  fontWeight: 700,
  fontSize: 12,
  background: '#e2e8f0',
  borderTop: '2px solid #1d4ed8',
};

export default function CeasaPrintLayout({ groups = [], company, startDate, endDate, fmtDate }) {
  const companyName = company?.company_name || '—';
  const logoUrl = company?.logo_url || '';
  const period = `${fmtDate(startDate)} até ${fmtDate(endDate)}`;
  const emission = new Date().toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  const totalPages = groups.length;

  return (
    <div>
      {groups.map(({ box, rows }, pageIdx) => {
        // Clientes agrupados dentro do Box
        const clientMap = new Map();
        rows.forEach(r => {
          const key = r.cnpj || r.cliente || '—';
          if (!clientMap.has(key)) clientMap.set(key, { cliente: r.cliente || '—', cnpj: r.cnpj || '', rows: [] });
          clientMap.get(key).rows.push(r);
        });
        const clientGroups = [...clientMap.values()].sort((a, b) => a.cliente.localeCompare(b.cliente, 'pt-BR'));

        const boxQty = rows.reduce((s, r) => s + r.qtde, 0);
        const boxValor = rows.reduce((s, r) => s + r.subtotal, 0);

        return (
          <div key={box.id} className="ceasa-box-page">
            {/* Cabeçalho */}
            <div style={{ borderBottom: '2px solid #1d4ed8', paddingBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {logoUrl && <img src={logoUrl} alt="" style={{ height: 32, width: 'auto', objectFit: 'contain' }} />}
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{companyName}</div>
                  {company?.cnpj && <div style={{ fontSize: 10, color: '#475569' }}>CNPJ: {company.cnpj}</div>}
                </div>
              </div>
              <div style={{ marginTop: 6, fontSize: 13, fontWeight: 700 }}>Relação de Vendas e Boxes CEASA</div>
              <div style={{ fontSize: 10, color: '#475569' }}>Período: {period}</div>
              <div style={{ fontSize: 10, color: '#475569' }}>Emissão: {emission}</div>
              <div style={{ fontSize: 10, color: '#475569' }}>Página {pageIdx + 1} de {totalPages}</div>
            </div>

            {/* Box */}
            <div style={{ marginTop: 8, marginBottom: 6, background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 3, padding: '4px 6px' }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Box: {box.name}</div>
              <div style={{ fontSize: 10, color: '#475569' }}>CNPJ: {box.cnpj || '—'}</div>
            </div>

            {/* Um bloco por cliente dentro do Box */}
            {clientGroups.map((cg, ci) => {
              const cQty = cg.rows.reduce((s, r) => s + r.qtde, 0);
              const cValor = cg.rows.reduce((s, r) => s + r.subtotal, 0);
              return (
                <div key={ci} style={{ marginTop: 6, pageBreakInside: 'avoid' }}>
                  {/* Cabeçalho do grupo — Cliente e CNPJ aparecem uma única vez */}
                  <div style={{ fontSize: 11, fontWeight: 700, background: '#eff6ff', borderLeft: '3px solid #1d4ed8', padding: '3px 5px' }}>
                    Cliente: {cg.cliente} | CNPJ: {cg.cnpj || '—'}
                  </div>

                  <table style={tableStyle}>
                    {colGroup}
                    <thead>
                      <tr>
                        <th style={thStyle}>Caminhão</th>
                        <th style={thStyle}>Produto</th>
                        <th style={{ ...thStyle, textAlign: 'center' }}>Qtde</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>Valor Un.</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>Valor Total</th>
                        <th style={thStyle}>Observação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cg.rows.map((r, ri) => (
                        <tr key={ri}>
                          <td style={tdStyle}>{r.caminhao || '—'}</td>
                          <td style={tdStyle}>{r.produto}</td>
                          <td style={{ ...tdStyle, textAlign: 'center' }}>{r.qtde}</td>
                          <td style={{ ...tdStyle, textAlign: 'right' }}>R$ {money(r.valorCeasa)}</td>
                          <td style={{ ...tdStyle, textAlign: 'right' }}>R$ {money(r.subtotal)}</td>
                          <td style={tdStyle}>{r.obs || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={2} style={{ ...totalCellStyle, textAlign: 'right' }}>Total do Cliente</td>
                        <td style={{ ...totalCellStyle, textAlign: 'center' }}>{cQty}</td>
                        <td style={totalCellStyle} />
                        <td style={{ ...totalCellStyle, textAlign: 'right' }}>R$ {money(cValor)}</td>
                        <td style={totalCellStyle} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              );
            })}

            {/* TOTAL GERAL DO BOX */}
            <table style={{ ...tableStyle, marginTop: 6 }}>
              {colGroup}
              <tbody>
                <tr>
                  <td colSpan={2} style={{ ...boxTotalCellStyle, textAlign: 'right' }}>TOTAL GERAL DO BOX</td>
                  <td style={{ ...boxTotalCellStyle, textAlign: 'center' }}>{boxQty}</td>
                  <td style={boxTotalCellStyle} />
                  <td style={{ ...boxTotalCellStyle, textAlign: 'right' }}>R$ {money(boxValor)}</td>
                  <td style={boxTotalCellStyle} />
                </tr>
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}