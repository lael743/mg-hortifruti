/**
 * Totais exibidos no rodapé dos pedidos impressos (pedido individual e espelho por cliente).
 *
 * Volume = soma das quantidades.
 * Peso = soma de quantidade x peso da embalagem, com gramas convertidas para quilo.
 * Itens sem peso numérico (ex: "un") não entram no peso, por isso o peso só é
 * exibido quando o pedido tem algum peso conhecido.
 */

export const calcTotalVolume = (items) => {
  return (items || []).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
};

// Lê o peso da embalagem ("20kg", "1,5 kg", "500g", "500 g") e devolve em quilo
export const parseWeightKg = (weight) => {
  const match = String(weight || '').match(/([\d.,]+)\s*(kg|g)?/i);
  if (!match) return 0;
  const num = parseFloat(match[1].replace(',', '.'));
  if (!num) return 0;
  const unit = (match[2] || 'kg').toLowerCase();
  return unit === 'g' ? num / 1000 : num;
};

export const calcTotalWeight = (items) => {
  return (items || []).reduce((sum, item) => {
    return sum + parseWeightKg(item.weight) * (Number(item.quantity) || 0);
  }, 0);
};

export const formatWeight = (kg) => `${kg.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} kg`;

// Rótulo do rodapé: volume sempre; peso na linha de baixo quando houver peso conhecido
export const buildVolumeWeightLabel = (items) => {
  const volume = calcTotalVolume(items);
  const weight = calcTotalWeight(items);
  return `${volume} vol.${weight > 0 ? `<br/>${formatWeight(weight)}` : ''}`;
};