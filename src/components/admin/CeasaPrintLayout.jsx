import React from 'react';

/**
 * Layout de impressão compacto para relatórios Ceasa.
 * Cada cliente (ou box) sai em página separada, com cabeçalho da empresa
 * e linhas curtas para caber muitos produtos por página.
 *
 * Props:
 *  - mode: 'client' | 'box'
 *  - groupedByClient: [{ cliente, cnpj, caminhoes:Set, rows:[] }]
 *  - groupedByBox: { groups: [{ box, rows:[] }], noBox: [] }
 *  - company: CompanySettings
 *  - startDate, endDate (ISO date strings)
 *  - fmtDate: (str) => string formatada
 */
export default function CeasaPrintLayout({
  mode,
  groupedByClient = [],
  groupedByBox = { groups: [], noBox: [] },
  company,
  startDate,
  endDate,
  fmtDate,
}) {
  const companyName = company?.company_name || '—';
  const companyCnpj = company?.cnpj || '';
  const companyAddress = [company?.address, company?.city, company?.state].filter(Boolean).join(' - ');
  const companyWhats = company?.whatsapp || '';
  const period = `${fmtDate(startDate)} até ${fmtDate(endDate)}`;

  const headerStyle = {
    borderBottom: '2px solid #1d4ed8',
    paddingBottom: 6,
    marginBottom: 8,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  };

  const pageStyle = (first) => ({
    marginBottom: 8,
  });

  const tableStyle = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 11,
  };
  const thStyle = {
    textAlign: 'left',
    borderBottom: '1px solid #cbd5e1',
    padding: '2px 4px',
    fontWeight: 600,
    fontSize: 10,
    textTransform: 'uppercase',
    color: '#475569',
  };
  const tdStyle = {
    borderBottom: '1px solid #f1f5f9',
    padding: '1px 4px',
    lineHeight: '1.15',
  };

  const money = (n) => (n != null && !isNaN(n)) ? Number(n).toFixed(2).replace('.', ',') : '0,00';

  const renderCompanyHeader = () => (
    <div style={headerStyle}>
      <div>
        <div style={{ fontSize: 15, fontWeight: 700 }}>{companyName}</div>
        {companyCnpj && <div style={{ fontSize: 10, color: '#475569' }}>CNPJ: {companyCnpj}</div>}
        {companyAddress && <div style={{ fontSize: 10, color: '#475569' }}>{companyAddress}</div>}
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>Relação de Vendas Ceasa</div>
        <div style={{ fontSize: 10, color: '#475569' }}>{period}</div>
        {companyWhats && <div style={{ fontSize: 10, color: '#475569' }}>WhatsApp: {companyWhats}</div>}
      </div>
    </div>
  );

  // === Modo Cliente ===
  if (mode === 'client') {
    return (
      <div>
        {groupedByClient.map((g, i) => {
          const caminhaoLabel = [...g.caminhoes].filter(Boolean).join(', ') || '—';
          const totalQty = g.rows.reduce((s, r) => s + r.qtde, 0);
          const totalValor = g.rows.reduce((s, r) => s + r.subtotal, 0);
          // agrupa por box
          const boxMap = new Map();
          const noBox = [];
          g.rows.forEach(r => {
            const box = r.box || null;
            if (box) {
              if (!boxMap.has(box.id)) boxMap.set(box.id, { box, rows: [] });
              boxMap.get(box.id).rows.push(r);
            } else {
              noBox.push(r);
            }
          });
          const boxGroups = [...boxMap.values()].sort((a, b) => a.box.name.localeCompare(b.box.name, 'pt-BR'));
          return (
            <div key={i} className="ceasa-box-page" style={pageStyle(i)}>
              {renderCompanyHeader()}
              <div style={{ marginTop: 10, marginBottom: 6, borderBottom: '1px solid #cbd5e1', paddingBottom: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1d4ed8' }}>Cliente: {g.cliente || '—'}</div>
                <div style={{ fontSize: 10, color: '#475569' }}>
                  CNPJ: {g.cnpj || '—'} &nbsp;|&nbsp; Caminhão: {caminhaoLabel}
                </div>
              </div>
              {boxGroups.map(({ box, rows: bRows }) => {
                const boxQty = bRows.reduce((s, r) => s + r.qtde, 0);
                const boxValor = bRows.reduce((s, r) => s + r.subtotal, 0);
                return (
                  <div key={box.id} style={{ marginTop: 6, pageBreakInside: 'avoid' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#1d4ed8', background: '#eff6ff', padding: '2px 6px', borderRadius: 3, marginBottom: 2 }}>
                      Box ({box.name}) — {boxQty} un.
                    </div>
                    <table style={tableStyle}>
                      <thead>
                        <tr>
                          <th style={thStyle}>Produto</th>
                          <th style={{ ...thStyle, width: 70, textAlign: 'right' }}>Valor Un.</th>
                          <th style={{ ...thStyle, width: 50, textAlign: 'center' }}>Qtde</th>
                          <th style={{ ...thStyle, width: 80, textAlign: 'right' }}>Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bRows.map((r, j) => (
                          <tr key={j}>
                            <td style={tdStyle}>{r.produto}</td>
                            <td style={{ ...tdStyle, textAlign: 'right' }}>R$ {money(r.valorUn)}</td>
                            <td style={{ ...tdStyle, textAlign: 'center' }}>{r.qtde}</td>
                            <td style={{ ...tdStyle, textAlign: 'right' }}>R$ {money(r.subtotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {boxValor > 0 && (
                      <div style={{ fontSize: 10, textAlign: 'right', color: '#475569', marginTop: 1 }}>Subtotal Box: R$ {money(boxValor)}</div>
                    )}
                  </div>
                );
              })}
              {noBox.length > 0 && (
                <div style={{ marginTop: 6, pageBreakInside: 'avoid' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#b45309', background: '#fffbeb', padding: '2px 6px', borderRadius: 3, marginBottom: 2 }}>
                    Sem Box associado
                  </div>
                  <table style={tableStyle}>
                    <thead>
                      <tr>
                        <th style={thStyle}>Produto</th>
                        <th style={{ ...thStyle, width: 70, textAlign: 'right' }}>Valor Un.</th>
                        <th style={{ ...thStyle, width: 50, textAlign: 'center' }}>Qtde</th>
                        <th style={{ ...thStyle, width: 80, textAlign: 'right' }}>Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {noBox.map((r, j) => (
                        <tr key={j}>
                          <td style={tdStyle}>{r.produto}</td>
                          <td style={{ ...tdStyle, textAlign: 'right' }}>R$ {money(r.valorUn)}</td>
                          <td style={{ ...tdStyle, textAlign: 'center' }}>{r.qtde}</td>
                          <td style={{ ...tdStyle, textAlign: 'right' }}>R$ {money(r.subtotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div style={{ marginTop: 6, fontSize: 12, fontWeight: 700, textAlign: 'right', borderTop: '1px solid #1d4ed8', paddingTop: 4 }}>
                Total: {totalQty} un. — R$ {money(totalValor)}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // === Modo Box ===
  return (
    <div>
      {groupedByBox.groups.map(({ box, rows }, i) => {
        const totalQty = rows.reduce((s, r) => s + r.qtde, 0);
        // agrupa por cliente dentro do box
        const clientMap = new Map();
        rows.forEach(r => {
          const key = r.cnpj || r.cliente || '—';
          if (!clientMap.has(key)) clientMap.set(key, { cliente: r.cliente || '—', cnpj: r.cnpj || '', caminhoes: new Set(), rows: [] });
          const cg = clientMap.get(key);
          cg.rows.push(r);
          if (r.caminhao) cg.caminhoes.add(r.caminhao);
        });
        const clientGroups = [...clientMap.values()].sort((a, b) => a.cliente.localeCompare(b.cliente, 'pt-BR'));
        return (
          <div key={box.id} className="ceasa-box-page" style={pageStyle(i)}>
            {renderCompanyHeader()}
            <div style={{ marginTop: 10, marginBottom: 6, borderBottom: '1px solid #cbd5e1', paddingBottom: 4 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1d4ed8' }}>Box: {box.name}</div>
              {box.cnpj && <div style={{ fontSize: 10, color: '#475569' }}>CNPJ: {box.cnpj}</div>}
            </div>
            {clientGroups.map((cg, j) => {
              const caminhaoLabel = [...cg.caminhoes].filter(Boolean).join(', ');
              const clientQty = cg.rows.reduce((s, r) => s + r.qtde, 0);
              const clientValor = cg.rows.reduce((s, r) => s + r.subtotal, 0);
              return (
                <div key={j} style={{ marginTop: 6, pageBreakInside: 'avoid' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#334155', background: '#f8fafc', padding: '2px 6px', borderRadius: 3, marginBottom: 2 }}>
                    {cg.cliente}
                    {cg.cnpj && <span style={{ color: '#64748b', fontWeight: 400 }}> — CNPJ: {cg.cnpj}</span>}
                    {caminhaoLabel && <span style={{ color: '#64748b', fontWeight: 400 }}> — Caminhão: {caminhaoLabel}</span>}
                  </div>
                  <table style={tableStyle}>
                    <thead>
                      <tr>
                        <th style={thStyle}>Produto</th>
                        <th style={{ ...thStyle, width: 70, textAlign: 'right' }}>Valor Un.</th>
                        <th style={{ ...thStyle, width: 50, textAlign: 'center' }}>Qtde</th>
                        <th style={{ ...thStyle, width: 80, textAlign: 'right' }}>Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cg.rows.map((r, k) => (
                        <tr key={k}>
                          <td style={tdStyle}>{r.produto}</td>
                          <td style={{ ...tdStyle, textAlign: 'right' }}>{r.valorUn > 0 ? `R$ ${money(r.valorUn)}` : '—'}</td>
                          <td style={{ ...tdStyle, textAlign: 'center' }}>{r.qtde}</td>
                          <td style={{ ...tdStyle, textAlign: 'right' }}>{r.subtotal > 0 ? `R$ ${money(r.subtotal)}` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {clientValor > 0 && (
                    <div style={{ fontSize: 10, textAlign: 'right', color: '#475569', marginTop: 1 }}>Subtotal: R$ {money(clientValor)}</div>
                  )}
                </div>
              );
            })}
            <div style={{ marginTop: 6, fontSize: 12, fontWeight: 700, textAlign: 'right', borderTop: '1px solid #1d4ed8', paddingTop: 4 }}>
              Total do Box: {totalQty} un.
            </div>
          </div>
        );
      })}
    </div>
  );
}