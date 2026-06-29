import React, { useEffect, useRef } from 'react';

// Gera payload PIX estático (BR Code) conforme padrão BACEN
function buildPixPayload(pixKey, amount, merchantName, merchantCity) {
  const name = (merchantName || 'Pagamento').slice(0, 25).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9 ]/g, '').trim();
  const city = (merchantCity || 'BRASIL').slice(0, 15).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9 ]/g, '').toUpperCase().trim();
  const amountStr = amount.toFixed(2);

  const field = (id, val) => {
    const len = String(val.length).padStart(2, '0');
    return `${id}${len}${val}`;
  };

  const gui = field('00', 'BR.GOV.BCB.PIX');
  const keyField = field('01', pixKey);
  const merchantAccount = field('26', gui + keyField);

  const mcc = field('52', '0000');
  const currency = field('53', '986');
  const amountField = field('54', amountStr);
  const country = field('58', 'BR');
  const nameField = field('59', name);
  const cityField = field('60', city);
  const txid = field('62', field('05', '***'));

  const payload = `000201${merchantAccount}${mcc}${currency}${amountField}${country}${nameField}${cityField}${txid}6304`;

  // CRC16-CCITT
  let crc = 0xFFFF;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? (crc << 1) ^ 0x1021 : crc << 1;
    }
  }
  crc = (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
  return payload + crc;
}

// QR Code simples via canvas usando qrcode.js API alternativa via img com API pública
export default function PixQrCode({ pixKey, amount, merchantName, merchantCity }) {
  if (!pixKey || !amount || amount <= 0) return null;

  const payload = buildPixPayload(pixKey, amount, merchantName, merchantCity);
  // Usa API pública do QR Server para gerar o QR code
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(payload)}`;

  return (
    <div className="flex flex-col items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-xl">
      <p className="text-xs font-semibold text-green-800 uppercase tracking-wide">Pagar com PIX</p>
      <img
        src={qrUrl}
        alt="QR Code PIX"
        className="w-40 h-40 rounded-lg"
        onError={e => { e.target.style.display = 'none'; }}
      />
      <p className="text-sm font-bold text-green-900">R$ {amount.toFixed(2)}</p>
      <div className="w-full">
        <p className="text-[10px] text-green-700 text-center mb-1">Ou copie a chave PIX:</p>
        <div className="flex items-center gap-1 bg-white border border-green-200 rounded-lg px-2 py-1">
          <span className="text-xs text-green-900 flex-1 truncate">{pixKey}</span>
          <button
            onClick={() => { navigator.clipboard.writeText(pixKey); }}
            className="text-[10px] text-green-700 font-semibold hover:text-green-900 whitespace-nowrap"
          >
            Copiar
          </button>
        </div>
      </div>
    </div>
  );
}