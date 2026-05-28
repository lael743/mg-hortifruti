/**
 * Utilitário reutilizável para imprimir a tabela de preços no mesmo formato do catálogo.
 * Usado tanto pelo cliente (Catalog.jsx) quanto pelo admin (ClientCard.jsx).
 */
export function printPriceTable({ products, priceGroup, customPrices, clientOrders, company, clientName }) {
  const activeProds = products.filter(p => p.active !== false).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  const discount = priceGroup?.discount_percent || 0;
  const isCustomTable = priceGroup?.type === 'custom';

  const customPriceMap = isCustomTable
    ? Object.fromEntries((customPrices || []).map(cp => [cp.product_id, cp.custom_price]))
    : {};

  // Build last-order qty map from client's orders
  const lastQtyMap = {};
  if (clientOrders && clientOrders.length > 0) {
    const sorted = [...clientOrders].sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    sorted.forEach(order => {
      (order.items || []).forEach(item => {
        if (!lastQtyMap[item.product_id]) {
          lastQtyMap[item.product_id] = item.quantity;
        }
      });
    });
  }

  const hasClientData = clientOrders && clientOrders.length > 0;

  const makeRow = (p) => {
    const basePrice = p.promo_active && p.promo_price ? p.promo_price : p.price || 0;
    const origPrice = p.price || 0;
    const finalPrice = isCustomTable
      ? (customPriceMap[p.id] !== undefined ? customPriceMap[p.id] : p.price || 0)
      : basePrice * (1 - discount / 100);
    const origFinal = isCustomTable ? origPrice : origPrice * (1 - discount / 100);
    const lastQty = lastQtyMap[p.id];
    const isPromo = p.promo_active && p.promo_price;
    const rowStyle = isPromo ? 'background:#fffbe6;' : '';
    const priceHtml = isPromo
      ? `<span style="text-decoration:line-through;color:#999;font-size:7px;">R$ ${origFinal.toFixed(2)}</span> <span style="color:#d97706;font-weight:bold;">R$ ${finalPrice.toFixed(2)}</span> <span style="background:#f59e0b;color:#fff;font-size:6px;padding:0 2px;border-radius:2px;font-weight:bold;">PROMO</span>`
      : `<span style="font-weight:bold;color:#1a5c2a;">R$ ${finalPrice.toFixed(2)}</span>`;
    const lastQtyHtml = lastQty
      ? `<span style="background:#dcfce7;color:#166534;border:1px solid #86efac;border-radius:3px;padding:0 3px;font-size:6.5px;font-weight:bold;">${String(lastQty).padStart(2, '0')}</span>`
      : `<span style="color:#ccc;font-size:6.5px;">--</span>`;
    const ultCol = hasClientData ? `<td style="padding:2px 4px;border:1px solid #ddd;text-align:center;">${lastQtyHtml}</td>` : '';

    // Calculate price per kg or unit
    const weightStr = p.weight || '';
    const kgMatch = weightStr.match(/([\d.,]+)\s*kg/i);
    const unMatch = weightStr.match(/([\d.,]+)\s*un/i);
    let pricePerUnitHtml = '<span style="color:#ccc;font-size:6.5px;">--</span>';
    if (kgMatch) {
      const kg = parseFloat(kgMatch[1].replace(',', '.'));
      if (kg > 0) {
        const perKg = finalPrice / kg;
        pricePerUnitHtml = `<span style="font-size:7px;color:#555;">R$ ${perKg.toFixed(2)}/kg</span>`;
      }
    } else if (unMatch) {
      const un = parseFloat(unMatch[1].replace(',', '.'));
      if (un > 0) {
        const perUn = finalPrice / un;
        pricePerUnitHtml = `<span style="font-size:7px;color:#555;">R$ ${perUn.toFixed(2)}/un</span>`;
      }
    }

    const cellStyle = "height:22px;max-height:22px;overflow:hidden;border:1px solid #ddd;padding:0 3px;";
    return `<tr style="${rowStyle}">
       <td style="${cellStyle}">
         <div style="font-weight:bold;font-size:10px;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:130px;">${p.name}</div>
         <div style="color:#666;font-size:7px;white-space:nowrap;">${p.packaging_type}${p.weight ? ' · ' + p.weight : ''}</div>
       </td>
       <td style="${cellStyle}text-align:center;white-space:nowrap;">${priceHtml}</td>
       <td style="${cellStyle}text-align:center;white-space:nowrap;">${pricePerUnitHtml}</td>
       ${ultCol}
       <td style="${cellStyle}width:32px;"><div style="border-bottom:1px solid #aaa;height:10px;margin-top:6px;"></div></td>
     </tr>`;
  };

  const half = Math.ceil(activeProds.length / 2);
  const left = activeProds.slice(0, half);
  const right = activeProds.slice(half);
  const maxRows = Math.max(left.length, right.length);

  const tableGroup = priceGroup
    ? `<p style="font-size:7px;color:#555;margin-bottom:2px;">Tabela: <b>${priceGroup.name}</b>${priceGroup.discount_percent ? ` (${priceGroup.discount_percent}% de desconto)` : ''}</p>`
    : '';

  const clientLine = clientName
    ? `<p style="font-size:7px;color:#555;margin-bottom:4px;">Cliente: <b>${clientName}</b></p>`
    : '';

  const theadRow = `<tr style="background:#2d7a3a;color:#fff;">
  <th style="padding:3px 4px;text-align:left;font-size:7px;">PRODUTO</th>
  <th style="padding:3px 4px;font-size:7px;">PREÇO</th>
  <th style="padding:3px 4px;font-size:7px;">R$/KG·UN</th>
  ${hasClientData ? `<th style="padding:3px 4px;font-size:7px;" title="Qtd última compra">ÚLT.</th>` : ''}
  <th style="padding:3px 4px;font-size:7px;">QTD</th>
  </tr>`;

  let tableRows = '';
  for (let i = 0; i < maxRows; i++) {
    const lp = left[i];
    const rp = right[i];
    const colSpan = hasClientData ? 5 : 4;
    const leftCells = lp ? makeRow(lp).replace(/^<tr[^>]*>/, '').replace(/<\/tr>$/, '') : `<td colspan="${colSpan}" style="border:1px solid #ddd;"></td>`;
    const rightCells = rp ? makeRow(rp).replace(/^<tr[^>]*>/, '').replace(/<\/tr>$/, '') : `<td colspan="${colSpan}" style="border:1px solid #ddd;"></td>`;
    const bg = (lp?.promo_active || rp?.promo_active) ? '' : (i % 2 === 0 ? 'background:#f9fafb;' : '');
    tableRows += `<tr style="${bg}">${leftCells}<td style="width:4px;background:#e5e7eb;"></td>${rightCells}</tr>`;
  }

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Tabela de Preços</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 7.5px; padding: 6px 8px; }
    h2 { font-size: 11px; margin-bottom: 2px; }
    table { width: 100%; border-collapse: collapse; }
    @media print { @page { margin: 3mm; size: A4; } body { padding: 0; } }
    tr { page-break-inside: avoid; }
  </style></head>
  <body>
    <h2>${company?.company_name || 'Tabela de Preços'} &nbsp;·&nbsp; <span style="font-size:9px;font-weight:normal">${new Date().toLocaleDateString('pt-BR')} &nbsp;·&nbsp; ${activeProds.length} produtos</span></h2>
    ${tableGroup}
    ${clientLine}
    ${hasClientData ? `<p style="font-size:6.5px;color:#888;margin-bottom:4px;">★ ÚLT. = quantidade da última compra &nbsp;|&nbsp; QTD = quantidade do novo pedido</p>` : `<p style="font-size:6.5px;color:#888;margin-bottom:4px;">QTD = quantidade do pedido</p>`}
    <table>
      <thead>${theadRow}<tr><td colspan="9" style="height:2px;"></td></tr></thead>
      <tbody>${tableRows}</tbody>
    </table>
  </body></html>`;

  const w = window.open('', '_blank');
  w.document.write(html);
  w.document.close();
}