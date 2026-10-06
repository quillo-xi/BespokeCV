import { resumeToPlainText } from './model.js';

const enc = new TextEncoder();

function xmlEscape(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(value) {
  return [value & 0xff, (value >>> 8) & 0xff];
}

function u32(value) {
  return [value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff];
}

function concat(parts) {
  const size = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function zipStore(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of entries) {
    const name = enc.encode(entry.name);
    const data = typeof entry.data === 'string' ? enc.encode(entry.data) : entry.data;
    const checksum = crc32(data);
    const local = new Uint8Array([
      ...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0),
      ...u32(checksum), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0), ...name
    ]);
    localParts.push(local, data);

    const central = new Uint8Array([
      ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0),
      ...u32(checksum), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0), ...u16(0),
      ...u16(0), ...u16(0), ...u32(0), ...u32(offset), ...name
    ]);
    centralParts.push(central);
    offset += local.length + data.length;
  }

  const local = concat(localParts);
  const central = concat(centralParts);
  const end = new Uint8Array([
    ...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(entries.length), ...u16(entries.length),
    ...u32(central.length), ...u32(local.length), ...u16(0)
  ]);
  return concat([local, central, end]);
}

function run(text, { bold = false, size = 21 } = {}) {
  return `<w:r><w:rPr>${bold ? '<w:b/>' : ''}<w:sz w:val="${size}"/><w:szCs w:val="${size}"/><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/></w:rPr><w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r>`;
}

function paragraph(text = '', options = {}) {
  const { style = '', bold = false, size = 21, after = 80, before = 0, keepNext = false } = options;
  const props = [
    style ? `<w:pStyle w:val="${style}"/>` : '',
    `<w:spacing w:before="${before}" w:after="${after}" w:line="240" w:lineRule="auto"/>`,
    keepNext ? '<w:keepNext/>' : ''
  ].join('');
  return `<w:p><w:pPr>${props}</w:pPr>${run(text, { bold, size })}</w:p>`;
}

function bullet(text) {
  return `<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr><w:spacing w:after="60" w:line="240" w:lineRule="auto"/></w:pPr>${run(text)}</w:p>`;
}

function heading(text) {
  return paragraph(text.toUpperCase(), { style: 'SectionHeading', bold: true, size: 20, before: 180, after: 70, keepNext: true });
}

function docXml(resume) {
  const p = resume.profile;
  const body = [];
  body.push(paragraph(p.fullName || 'Your Name', { style: 'Name', bold: true, size: 34, after: 50 }));
  body.push(paragraph([p.cityState, p.phone, p.email].filter(Boolean).join(' | '), { size: 19, after: 20 }));
  if (p.linkedin || p.portfolio) body.push(paragraph([p.linkedin, p.portfolio].filter(Boolean).join(' | '), { size: 19, after: 55 }));
  if (p.headline) body.push(paragraph(p.headline, { bold: true, size: 22, after: 110 }));

  body.push(heading('Summary'));
  body.push(paragraph(p.summary));

  if (resume.skills.some(Boolean)) {
    body.push(heading('Skills'));
    body.push(paragraph(resume.skills.filter(Boolean).join(' | ')));
  }

  body.push(heading('Work Experience'));
  for (const role of resume.experiences) {
    if (![role.title, role.company, ...role.bullets].some((value) => String(value ?? '').trim())) continue;
    body.push(paragraph([role.title, role.company].filter(Boolean).join(' — '), { bold: true, keepNext: true, after: 30 }));
    body.push(paragraph([
      role.location,
      [role.start, role.current ? 'Present' : role.end].filter(Boolean).join(' – ')
    ].filter(Boolean).join(' | '), { size: 19, after: 60, keepNext: true }));
    for (const item of role.bullets.filter(Boolean)) body.push(bullet(item));
  }

  if (resume.education.some((item) => item.school || item.degree)) {
    body.push(heading('Education'));
    for (const item of resume.education) {
      if (!item.school && !item.degree) continue;
      body.push(paragraph([item.degree, item.school].filter(Boolean).join(' — '), { bold: true, after: 25 }));
      body.push(paragraph([item.location, item.graduation].filter(Boolean).join(' | '), { size: 19, after: 65 }));
    }
  }

  if (resume.certifications.some(Boolean)) {
    body.push(heading('Certifications'));
    for (const item of resume.certifications.filter(Boolean)) body.push(paragraph(item, { after: 35 }));
  }

  body.push(`<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1152" w:right="1152" w:bottom="1152" w:left="1152" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>`);

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body.join('')}</w:body></w:document>`;
}

const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`;

const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`;

const documentRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/></Relationships>`;

const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="21"/><w:szCs w:val="21"/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Name"><w:name w:val="Name"/><w:basedOn w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="SectionHeading"><w:name w:val="Section Heading"/><w:basedOn w:val="Normal"/></w:style></w:styles>`;

const numbering = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:tabs><w:tab w:val="num" w:pos="360"/></w:tabs><w:ind w:left="360" w:hanging="180"/></w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/></w:rPr></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>`;

export function createDocxBytes(resume) {
  const now = new Date().toISOString();
  const core = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xmlEscape(resume.profile.fullName || 'Resume')}</dc:title><dc:creator>BespokeCV</dc:creator><cp:lastModifiedBy>BespokeCV</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`;
  const app = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>BespokeCV</Application><AppVersion>0.1</AppVersion></Properties>`;
  return zipStore([
    { name: '[Content_Types].xml', data: contentTypes },
    { name: '_rels/.rels', data: rootRels },
    { name: 'docProps/core.xml', data: core },
    { name: 'docProps/app.xml', data: app },
    { name: 'word/document.xml', data: docXml(resume) },
    { name: 'word/styles.xml', data: styles },
    { name: 'word/numbering.xml', data: numbering },
    { name: 'word/_rels/document.xml.rels', data: documentRels }
  ]);
}

export function createDocxBlob(resume) {
  return new Blob([createDocxBytes(resume)], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

export function docxDebugText(resume) {
  return resumeToPlainText(resume);
}
