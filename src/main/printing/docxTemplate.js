const zlib = require('zlib');

// Builds the editable Word (.docx) letterhead template without any extra dependency:
// a .docx is a ZIP of XML files, so a tiny "stored" ZIP writer is enough.
//
// Page = full A4. Word margins mirror what the invoice printer expects:
//   top margin    40 mm  -> header design area (logo, shop name, address)
//   bottom margin 25 mm  -> footer design area; its lowest 12 mm are left EMPTY because
//                           the ARWAAT credit line is stamped there on every printed page.
// The owner designs inside the header/footer, saves as PDF and uploads it in
// Settings -> Letterheads (top 40 / bottom 25 stay the defaults).

const MM = 56.6929; // twips per mm
const tw = (mm) => Math.round(mm * MM);

// ---------- minimal ZIP (method 0 = stored) ----------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  if (typeof zlib.crc32 === 'function') return zlib.crc32(buf) >>> 0;
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function zip(files) {
  const local = [];
  const central = [];
  let offset = 0;
  for (const { name, data } of files) {
    const nameBuf = Buffer.from(name, 'utf8');
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
    const crc = crc32(buf);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4); // version needed
    lh.writeUInt16LE(0x0800, 6); // UTF-8 names
    lh.writeUInt16LE(0, 8); // stored
    lh.writeUInt16LE(0, 10); // time
    lh.writeUInt16LE(0x21, 12); // date (1980-01-01)
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(buf.length, 18);
    lh.writeUInt32LE(buf.length, 22);
    lh.writeUInt16LE(nameBuf.length, 26);
    lh.writeUInt16LE(0, 28);
    local.push(lh, nameBuf, buf);

    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(20, 4);
    ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(0x0800, 8);
    ch.writeUInt16LE(0, 10);
    ch.writeUInt16LE(0, 12);
    ch.writeUInt16LE(0x21, 14);
    ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(buf.length, 20);
    ch.writeUInt32LE(buf.length, 24);
    ch.writeUInt16LE(nameBuf.length, 28);
    ch.writeUInt32LE(offset, 42);
    central.push(ch, nameBuf);
    offset += lh.length + nameBuf.length + buf.length;
  }
  const centralBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, centralBuf, end]);
}

// ---------- WordprocessingML ----------
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

function para(text, { bold = false, size = 20, color = '444444', align = 'left', fill, border, after = 60 } = {}) {
  const shd = fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${fill}"/>` : '';
  const bdr = border
    ? `<w:pBdr><w:top w:val="single" w:sz="8" w:space="4" w:color="${border}"/><w:left w:val="single" w:sz="8" w:space="4" w:color="${border}"/><w:bottom w:val="single" w:sz="8" w:space="4" w:color="${border}"/><w:right w:val="single" w:sz="8" w:space="4" w:color="${border}"/></w:pBdr>`
    : '';
  return `<w:p><w:pPr>${bdr}${shd}<w:spacing w:before="0" w:after="${after}"/><w:jc w:val="${align}"/></w:pPr><w:r><w:rPr>${bold ? '<w:b/>' : ''}<w:color w:val="${color}"/><w:sz w:val="${size}"/></w:rPr><w:t xml:space="preserve">${esc(text)}</w:t></w:r></w:p>`;
}

function buildLetterheadDocx() {
  const header = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr ${NS}>${
    para('HEADER AREA (top 40 mm)', { bold: true, size: 24, color: '1B4F9C', fill: 'EAF2FF', border: '3374CC', after: 40 }) +
    para('Replace this box with your logo, shop name, address and phone numbers. Delete this text before saving as PDF.', { size: 18, color: '334155', fill: 'EAF2FF', border: '3374CC', after: 0 })
  }</w:hdr>`;

  const footer = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr ${NS}>${
    para('FOOTER AREA (13 mm tall, sits 12 mm above the page edge)', { bold: true, size: 20, color: '1F6B30', fill: 'EAF6EC', border: '3FA055', after: 20 }) +
    para('Bank details, terms, return policy, signatures. Delete this text before saving as PDF.', { size: 16, color: '334155', fill: 'EAF6EC', border: '3FA055', after: 0 })
  }</w:ftr>`;

  const body = [
    para('INVOICE CONTENT AREA', { bold: true, size: 28, color: '64748B', align: 'center', after: 120 }),
    para('Leave this middle part of the page EMPTY (white). ARWAAT prints the bill here: customer, items, totals.', { size: 20, color: '64748B', align: 'center', after: 120 }),
    para('HOW TO USE THIS TEMPLATE', { bold: true, size: 20, color: '0F172A', after: 60 }),
    para('1. Design only inside the blue header and green footer boxes. Do not put anything in the middle.', { size: 18, color: '0F172A' }),
    para('2. The bottom 12 mm of the page is reserved: ARWAAT adds its credit line there automatically on every printed page.', { size: 18, color: '0F172A' }),
    para('3. Delete these instructions, then File > Save As > PDF (A4).', { size: 18, color: '0F172A' }),
    para('4. In ARWAAT: Settings > Letterheads > upload the PDF. Keep top margin 40 mm and bottom margin 25 mm.', { size: 18, color: '0F172A' }),
  ].join('');

  const sect = `<w:sectPr><w:headerReference w:type="default" r:id="rId1"/><w:footerReference w:type="default" r:id="rId2"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="${tw(40)}" w:right="${tw(20)}" w:bottom="${tw(25)}" w:left="${tw(20)}" w:header="${tw(8)}" w:footer="${tw(12)}" w:gutter="0"/></w:sectPr>`;

  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body>${body}${sect}</w:body></w:document>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
  const docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>`;

  return zip([
    { name: '[Content_Types].xml', data: contentTypes },
    { name: '_rels/.rels', data: rels },
    { name: 'word/document.xml', data: document },
    { name: 'word/_rels/document.xml.rels', data: docRels },
    { name: 'word/header1.xml', data: header },
    { name: 'word/footer1.xml', data: footer },
  ]);
}

module.exports = { buildLetterheadDocx };
