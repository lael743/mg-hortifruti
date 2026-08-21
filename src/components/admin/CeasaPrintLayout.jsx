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
 *  - productToBox: mapa productId -> box
 *  - company: CompanySettings
 *  - startDate, endDate (ISO date strings)
 *  - fmtDate: (str) => string formatada
 */
export default function CeasaPrintLayout({
  mode,
  groupedByClient = [],
  groupedByBox = { groups: [], noBox: [] },
  productToBox = {},
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
    pageBreakBefore: first ? 'auto' : 'always',
    breakBefore: first ? 'auto' : 'page',
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
            const box = r.productId ? productToBox[r.productId] : null;
            if (box) {
              if (!boxMap.has(box.id)) boxMap.set(box.id, { box, rows: [] });
              boxMap.get(box.id).rows.push(r);
            } else {
              noBox.push(r);
            }
          });
          const boxGroups = [...boxMap.values()].sort((a, b) => a.box.name.localeCompare(b.box.name, 'pt-BR'));
          return (
            <div key={i} style={pageStyle(i)}>
              {renderCompanyHeader()}
              <div style={{ marginBottom: 6 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1d4ed8' }}>{g.cliente || '—'}</div>
                <div style={{ fontSize: 10, color: '#475569' }}>
                  CNPJ: {g.cnpj || '—'} &nbsp;|&nbsp; Caminhão: {caminhaoLabel}
                </div>
              </div>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Produto</th>
                    <th style={{ ...thStyle, width: 50, textAlign: 'center' }}>Qtde</th>
                    <th style={{ ...thStyle, width: 70, textAlign: 'right' }}>Valor Un.</th>
                    <th style={{ ...thStyle, width: 80, textAlign: 'right' }}>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {boxGroups.map(({ box, rows: bRows }) => (
                    <React.Fragment key={box.id}>
                      <tr>
                        <td colSpan={4} style={{ ...tdStyle, fontWeight: 600, color: '#1d4ed8', fontSize: 10, paddingTop: 4 }}>
                          {box.name}
                        </td>
                      </tr>
                      {bRows.map((r, j) => (
                        <tr key={j}>
                          <td style={tdStyle}>{r.produto}</td>
                          <td style={{ ...tdStyle, textAlign: 'center' }}>{r.qtde}</td>
                          <td style={{ ...tdStyle, textAlign: 'right' }}>R$ {money(r.valorUn)}</td>
                          <td style={{ ...tdStyle, textAlign: 'right' }}>R$ {money(r.subtotal)}</td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                  {noBox.map((r, j) => (
                    <tr key={`nb${j}`}>
                      <td style={tdStyle}>{r.produto} <span style={{ color: '#b45309', fontSize: 9 }}>(sem box)</span></td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>{r.qtde}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>R$ {money(r.valorUn)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>R$ {money(r.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ marginTop: 4, fontSize: 11, fontWeight: 600, textAlign: 'right' }}>
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
          <div key={box.id} style={pageStyle(i)}>
            {renderCompanyHeader()}
            <div style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1d4ed8' }}>{box.name}</div>
              {box.cnpj && <div style={{ fontSize: 10, color: '#475569' }}>CNPJ: {box.cnpj}</div>}
            </div>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Cliente / Produto</th>
                  <th style={{ ...thStyle, width: 50, textAlign: 'center' }}>Qtde</th>
                  <th style={{ ...thStyle, width: 70, textAlign: 'right' }}>Valor Un.</th>
                  <th style={{ ...thStyle, width: 80, textAlign: 'right' }}>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {clientGroups.map((cg, j) => (
                  <React.Fragment key={j}>
                    <tr>
                      <td colSpan={4} style={{ ...tdStyle, fontWeight: 600, color: '#334155', fontSize: 10, paddingTop: 4 }}>
                        {cg.cliente} {cg.cnpj && <span style={{ color: '#64748b', fontWeight: 400 }}>({cg.cnpj})</span>}
                        {[...cg.caminhoes].filter(Boolean).length > 0 && <span style={{ color: '#64748b', fontWeight: 400 }}> — Caminhão: {[...cg.caminhoes].join(', ')}</span>}
                      </td>
                    </tr>
                    {cg.rows.map((r, k) => (
                      <tr key={k}>
                        <td style={{ ...tdStyle, paddingLeft: 14 }}>{r.produto}</td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>{r.qtde}</td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>{r.valorUn > 0 ? `R$ ${money(r.valorUn)}` : '—'}</td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>{r.subtotal > 0 ? `R$ ${money(r.subtotal)}` : '—'}</td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
            <div style={{ marginTop: 4, fontSize: 11, fontWeight: 600, textAlign: 'right' }}>
              Total do Box: {totalQty} un.
            </div>
          </div>
        );
      })}
    </div>
  );
}