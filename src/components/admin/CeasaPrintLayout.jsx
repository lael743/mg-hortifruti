import React from 'react';

/**
 * Impressão única da "Relação de Vendas e Boxes CEASA".
 * Um Box por página, clientes agrupados dentro do Box.
 * Usa exclusivamente os dados da operação CEASA (CeasaReportItem).
 * Itens sem Box não são impressos.
 *
 * Props:
 *  - groups: [{ box, rows: [] }]
 *  - company: CompanySettings
 *  - startDate, endDate (ISO date strings)
 *  - fmtDate: (str) => string formatada
 */

const money = (n) => (n != null && !isNaN(n)) ? Number(n).toFixed(2).replace('.', ',') : '0,00';

const tableStyle = { width: '100%', borderCollapse: 'collapse', fontSize: 11 };

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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, borderBottom: '2px solid #1d4ed8', paddingBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {logoUrl && <img src={logoUrl} alt="" style={{ height: 34, width: 'auto', objectFit: 'contain' }} />}
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{companyName}</div>
                  {company?.cnpj && <div style={{ fontSize: 10, color: '#475569' }}>CNPJ: {company.cnpj}</div>}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>Relação de Vendas e Boxes CEASA</div>
                <div style={{ fontSize: 10, color: '#475569' }}>Período: {period}</div>
                <div style={{ fontSize: 10, color: '#475569' }}>Emissão: {emission}</div>
                <div style={{ fontSize: 10, color: '#475569' }}>Página {pageIdx + 1} de {totalPages}</div>
              </div>
            </div>

            {/* Barra de contexto do Box */}
            <div style={{ marginTop: 8, marginBottom: 6, background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 3, padding: '4px 6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Box: {box.name}</div>
              <div style={{ fontSize: 10, color: '#475569' }}>CNPJ: {box.cnpj || '—'}</div>
            </div>

            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: 78 }}>Caminhão</th>
                  <th style={{ ...thStyle, width: 92 }}>CNPJ</th>
                  <th style={thStyle}>Cliente</th>
                  <th style={thStyle}>Produto</th>
                  <th style={{ ...thStyle, width: 42, textAlign: 'center' }}>Qtde</th>
                  <th style={{ ...thStyle, width: 68, textAlign: 'right' }}>Valor Un.</th>
                  <th style={{ ...thStyle, width: 78, textAlign: 'right' }}>Valor Total</th>
                  <th style={{ ...thStyle, width: 100 }}>Observação</th>
                </tr>
              </thead>
              <tbody>
                {clientGroups.map((cg, ci) => {
                  const cQty = cg.rows.reduce((s, r) => s + r.qtde, 0);
                  const cValor = cg.rows.reduce((s, r) => s + r.subtotal, 0);
                  return (
                    <React.Fragment key={ci}>
                      <tr>
                        <td colSpan={8} style={{ ...tdStyle, background: '#f8fafc', fontWeight: 700, fontSize: 11 }}>
                          {cg.cliente}
                          {cg.cnpj ? <span style={{ fontWeight: 400, color: '#64748b' }}> — CNPJ: {cg.cnpj}</span> : null}
                        </td>
                      </tr>
                      {cg.rows.map((r, ri) => (
                        <tr key={ri}>
                          <td style={tdStyle}>{r.caminhao || '—'}</td>
                          <td style={tdStyle}>{r.cnpj || '—'}</td>
                          <td style={tdStyle}>{r.cliente || '—'}</td>
                          <td style={tdStyle}>{r.produto}</td>
                          <td style={{ ...tdStyle, textAlign: 'center' }}>{r.qtde}</td>
                          <td style={{ ...tdStyle, textAlign: 'right' }}>R$ {money(r.valorCeasa)}</td>
                          <td style={{ ...tdStyle, textAlign: 'right' }}>R$ {money(r.subtotal)}</td>
                          <td style={tdStyle}>{r.obs || '-'}</td>
                        </tr>
                      ))}
                      <tr>
                        <td colSpan={4} style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, background: '#f8fafc' }}>Total do Cliente</td>
                        <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 700, background: '#f8fafc' }}>{cQty}</td>
                        <td style={{ ...tdStyle, background: '#f8fafc' }} />
                        <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, background: '#f8fafc' }}>R$ {money(cValor)}</td>
                        <td style={{ ...tdStyle, background: '#f8fafc' }} />
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4} style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, fontSize: 12, background: '#e2e8f0', borderTop: '2px solid #1d4ed8' }}>TOTAL GERAL DO BOX</td>
                  <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 700, fontSize: 12, background: '#e2e8f0', borderTop: '2px solid #1d4ed8' }}>{boxQty}</td>
                  <td style={{ ...tdStyle, background: '#e2e8f0', borderTop: '2px solid #1d4ed8' }} />
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, fontSize: 12, background: '#e2e8f0', borderTop: '2px solid #1d4ed8' }}>R$ {money(boxValor)}</td>
                  <td style={{ ...tdStyle, background: '#e2e8f0', borderTop: '2px solid #1d4ed8' }} />
                </tr>
              </tfoot>
            </table>
          </div>
        );
      })}
    </div>
  );
}