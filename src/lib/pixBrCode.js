// Gerador de QR Code PIX padrão EMV-QRCPS-MPM do Banco Central do Brasil

function field(id, value) {
  const len = String(value.length).padStart(2, '0');
  return `${id}${len}${value}`;
}

function normalize(str) {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .trim()
    .substring(0, 25);
}

function crc16(str) {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) crc = (crc << 1) ^ 0x1021;
      else crc <<= 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function generatePixBrCode({ chave, valor, nome, cidade, txid = '***' }) {
  const nomeSanitized = normalize(nome || 'BENEFICIARIO');
  const cidadeSanitized = normalize(cidade || 'CIDADE');

  // Merchant Account Information (ID 26)
  const gui = field('00', 'BR.GOV.BCB.PIX');
  const chaveField = field('01', chave);
  const mai = field('26', gui + chaveField);

  // Additional Data Field (ID 62) - txid
  const txidField = field('05', txid);
  const adf = field('62', txidField);

  const valorStr = valor > 0 ? valor.toFixed(2) : '';

  let payload =
    field('00', '01') +           // Payload Format Indicator
    field('01', '12') +           // Point of Initiation Method (static)
    mai +                          // Merchant Account Information
    field('52', '0000') +         // Merchant Category Code
    field('53', '986') +          // Transaction Currency (BRL)
    (valorStr ? field('54', valorStr) : '') + // Transaction Amount
    field('58', 'BR') +           // Country Code
    field('59', nomeSanitized) +  // Merchant Name
    field('60', cidadeSanitized) + // Merchant City
    adf +                          // Additional Data Field
    '6304';                        // CRC placeholder

  const crc = crc16(payload);
  return payload + crc;
}