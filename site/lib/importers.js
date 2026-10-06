import { createBlankResume, createEducation, createExperience, normalizeResume } from './model.js';

const MAX_RESUME_BYTES = 12 * 1024 * 1024;
const DATE_RANGE = /\b((?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)?\s*\d{4})\s*(?:[-–—]|to)\s*((?:Present|Current|Now)|(?:(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)?\s*\d{4}))\b/i;
const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PHONE = /(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/;
const URLISH = /(?:https?:\/\/|www\.|linkedin\.com\/|github\.com\/)[^\s|]+/i;
const BULLET_PREFIX = /^[\s\u2022\u25E6\u25AA\u25CF▪◦*-]+/;

function cleanLine(value) {
  return String(value ?? '').replace(/\u00a0/g, ' ').replace(/[\t ]+/g, ' ').trim();
}

function decodeXml(value) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&amp;/g, '&');
}

function readU16(view, offset) { return view.getUint16(offset, true); }
function readU32(view, offset) { return view.getUint32(offset, true); }

async function inflateRaw(bytes) {
  if (typeof DecompressionStream !== 'function') throw new Error('This browser cannot decompress DOCX files locally.');
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function readZipEntry(buffer, wantedName) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  let eocd = -1;
  const min = Math.max(0, bytes.length - 65_557);
  for (let i = bytes.length - 22; i >= min; i -= 1) {
    if (readU32(view, i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('The DOCX package is not a valid ZIP container.');
  const entries = readU16(view, eocd + 10);
  let cursor = readU32(view, eocd + 16);
  const decoder = new TextDecoder();

  for (let index = 0; index < entries; index += 1) {
    if (readU32(view, cursor) !== 0x02014b50) throw new Error('The DOCX central directory is invalid.');
    const method = readU16(view, cursor + 10);
    const compressedSize = readU32(view, cursor + 20);
    const fileNameLength = readU16(view, cursor + 28);
    const extraLength = readU16(view, cursor + 30);
    const commentLength = readU16(view, cursor + 32);
    const localOffset = readU32(view, cursor + 42);
    const name = decoder.decode(bytes.slice(cursor + 46, cursor + 46 + fileNameLength));
    if (name === wantedName) {
      if (readU32(view, localOffset) !== 0x04034b50) throw new Error('The DOCX local file header is invalid.');
      const localNameLength = readU16(view, localOffset + 26);
      const localExtraLength = readU16(view, localOffset + 28);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;
      const compressed = bytes.slice(dataStart, dataStart + compressedSize);
      if (method === 0) return compressed;
      if (method === 8) return inflateRaw(compressed);
      throw new Error(`Unsupported DOCX compression method: ${method}`);
    }
    cursor += 46 + fileNameLength + extraLength + commentLength;
  }
  throw new Error(`DOCX entry not found: ${wantedName}`);
}

export async function extractDocxText(fileOrBuffer) {
  const buffer = fileOrBuffer instanceof ArrayBuffer ? fileOrBuffer : ArrayBuffer.isView(fileOrBuffer) ? fileOrBuffer.buffer.slice(fileOrBuffer.byteOffset, fileOrBuffer.byteOffset + fileOrBuffer.byteLength) : await fileOrBuffer.arrayBuffer();
  const xmlBytes = await readZipEntry(buffer, 'word/document.xml');
  const xml = new TextDecoder('utf-8').decode(xmlBytes);
  const paragraphs = [...xml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)].map(([paragraphXml]) => {
    const isBullet = /<w:numPr\b/.test(paragraphXml);
    const text = decodeXml(paragraphXml
      .replace(/<w:tab\b[^>]*\/>/g, '\t')
      .replace(/<w:(?:br|cr)\b[^>]*\/>/g, '\n')
      .replace(/<[^>]+>/g, ''));
    const cleaned = cleanLine(text);
    return cleaned ? `${isBullet ? '• ' : ''}${cleaned}` : '';
  });
  return normalizeExtractedText(paragraphs.join('\n'));
}

export async function extractPdfText(fileOrBuffer) {
  const data = fileOrBuffer instanceof ArrayBuffer ? fileOrBuffer : ArrayBuffer.isView(fileOrBuffer) ? fileOrBuffer.buffer.slice(fileOrBuffer.byteOffset, fileOrBuffer.byteOffset + fileOrBuffer.byteLength) : await fileOrBuffer.arrayBuffer();
  let pdfjs;
  try {
    pdfjs = await import('../vendor/pdf.mjs');
  } catch {
    throw new Error('PDF support is not available in this build. Try Word (.docx) or paste the resume text.');
  }
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdf.worker.mjs', import.meta.url).href;
  const task = pdfjs.getDocument({ data: new Uint8Array(data), isEvalSupported: false, useWorkerFetch: false });
  const doc = await task.promise;
  const pages = [];
  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();
    let text = '';
    for (const item of content.items) {
      if (!('str' in item)) continue;
      text += item.str;
      text += item.hasEOL ? '\n' : ' ';
    }
    pages.push(text.trim());
  }
  return normalizeExtractedText(pages.join('\n\n'));
}

export function normalizeExtractedText(text) {
  return String(text ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .filter((line) => !isPageArtifact(line))
    .join('\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function isPageArtifact(line) {
  const value = cleanLine(line);
  if (!value) return false;
  return /^(?:.{1,100}\s+[-–—]\s+)?page\s+\d+(?:\s+of\s+\d+)?$/i.test(value);
}

function stripEmploymentDuration(value) {
  return cleanLine(String(value ?? '').replace(/\(\s*\d+\s+years?(?:\s+\d+\s+months?)?\s*\+?\s*\)|\(\s*\d+\s+months?\s*\+?\s*\)/gi, ''));
}

function isSubroleDateLine(line) {
  return /^\d{1,2}\/\d{4}\s*(?:[-–—]|to)\s*\d{1,2}\/\d{4}\s+Position\s*:/i.test(cleanLine(line));
}

function collectAccomplishmentBullets(lines) {
  const bullets = [];
  let current = '';

  const flush = () => {
    const value = cleanLine(current);
    if (value) bullets.push(value);
    current = '';
  };

  for (const raw of lines) {
    const line = cleanLine(raw);
    if (!line) continue;

    if (isSubroleDateLine(line)) {
      flush();
      bullets.push(line);
      continue;
    }

    const startsBullet = BULLET_PREFIX.test(line);
    const value = cleanLine(line.replace(BULLET_PREFIX, ''));
    if (!value) continue;

    if (startsBullet) {
      flush();
      current = value;
    } else if (current) {
      current = `${current} ${value}`;
    } else {
      current = value;
    }
  }

  flush();
  return bullets;
}

function splitSkillItems(lines) {
  const text = lines.map(cleanLine).filter(Boolean).join(' ');
  const items = [];
  let current = '';
  let depth = 0;

  const flush = () => {
    const value = cleanLine(current);
    if (value.length > 1 && value.length < 80) items.push(value);
    current = '';
  };

  for (const character of text) {
    if (character === '(') depth += 1;
    if (character === ')' && depth > 0) depth -= 1;
    if (depth === 0 && [',', ';', '|', '•'].includes(character)) flush();
    else current += character;
  }
  flush();
  return items;
}

function headingKind(line) {
  const normalized = line.toLowerCase().replace(/[^a-z &/]/g, '').trim();
  const map = new Map([
    ['summary', 'summary'], ['professional summary', 'summary'], ['profile', 'summary'], ['professional profile', 'summary'],
    ['skills', 'skills'], ['core skills', 'skills'], ['core competencies', 'skills'], ['technical skills', 'skills'], ['areas of expertise', 'skills'],
    ['experience', 'experience'], ['work experience', 'experience'], ['professional experience', 'experience'], ['employment history', 'experience'], ['career experience', 'experience'],
    ['education', 'education'], ['academic background', 'education'],
    ['certifications', 'certifications'], ['certification', 'certifications'], ['licenses & certifications', 'certifications'], ['licenses and certifications', 'certifications'],
    ['licenses', 'certifications']
  ]);
  return map.get(normalized) ?? null;
}

function sectionize(text) {
  const sections = { header: [], summary: [], skills: [], experience: [], education: [], certifications: [], other: [] };
  let current = 'header';
  for (const raw of String(text).split('\n')) {
    const line = cleanLine(raw);
    const kind = headingKind(line);
    if (kind && line.length < 42) { current = kind; continue; }
    sections[current].push(line);
  }
  return sections;
}

function splitBlocks(lines) {
  const blocks = [];
  let current = [];
  for (const line of lines) {
    if (!line) {
      if (current.length) blocks.push(current.splice(0));
      continue;
    }
    current.push(line);
  }
  if (current.length) blocks.push(current);
  return blocks;
}

function parseDateRange(value) {
  const match = value.match(DATE_RANGE);
  if (!match) return null;
  return { start: cleanLine(match[1]), end: cleanLine(match[2]), current: /present|current|now/i.test(match[2]) };
}

function looksLikeExperienceLocation(value) {
  const line = cleanLine(value);
  return /\b(remote|hybrid|on[- ]?site)\b/i.test(line) || /,\s*[A-Z]{2}(?:\s+\d{5}(?:-\d{4})?)?$/i.test(line);
}

function hasCombinedRoleHeader(value) {
  return cleanLine(value).split(/\s+(?:—|–|\|)\s+/).filter(Boolean).length >= 2;
}

function experienceHeaderStart(lines, dateIndex, lowerBound) {
  const last = lines[dateIndex - 1] ?? '';
  const prior = lines[dateIndex - 2] ?? '';
  let lineCount = 2;

  if (looksLikeExperienceLocation(last)) lineCount = hasCombinedRoleHeader(prior) ? 2 : 3;
  else if (hasCombinedRoleHeader(last)) lineCount = 1;

  return Math.max(lowerBound, dateIndex - lineCount);
}

function parseExperiences(lines) {
  const useful = lines.map(cleanLine).filter(Boolean);
  const dateIndexes = useful
    .map((line, index) => DATE_RANGE.test(line) && !BULLET_PREFIX.test(line) && !isSubroleDateLine(line) ? index : -1)
    .filter((index) => index >= 0);
  if (!dateIndexes.length) return [];

  const headerStarts = dateIndexes.map((dateIndex, roleIndex) => {
    const lowerBound = roleIndex ? dateIndexes[roleIndex - 1] + 1 : 0;
    return experienceHeaderStart(useful, dateIndex, lowerBound);
  });

  return dateIndexes.map((dateIndex, roleIndex) => {
    const role = createExperience();
    const header = useful.slice(headerStarts[roleIndex], dateIndex).filter((line) => !BULLET_PREFIX.test(line));
    const dateLine = useful[dateIndex];
    const dates = parseDateRange(dateLine);
    if (dates) Object.assign(role, dates);

    const dateMatch = dateLine.match(DATE_RANGE);
    const locationFromDate = dateMatch
      ? stripEmploymentDuration(dateLine.replace(dateMatch[0], '')).replace(/^[|·, -]+|[|·, -]+$/g, '')
      : '';
    const combined = header[0] ?? '';
    const combinedParts = combined.split(/\s+(?:—|–|\|)\s+/).map(cleanLine).filter(Boolean);
    if (combinedParts.length >= 2) {
      role.title = combinedParts[0];
      role.company = combinedParts[1];
      role.location = locationFromDate || header[1] || '';
    } else {
      role.title = header[0] ?? '';
      role.company = header[1] ?? '';
      role.location = locationFromDate || header[2] || '';
    }

    const nextHeaderStart = roleIndex + 1 < headerStarts.length ? headerStarts[roleIndex + 1] : useful.length;
    const bulletLines = collectAccomplishmentBullets(useful.slice(dateIndex + 1, nextHeaderStart));
    role.bullets = bulletLines.length ? bulletLines : [''];
    return role;
  }).filter((role) => role.title || role.company || role.bullets.some(Boolean));
}

function looksLikeSchool(value) {
  return /\b(university|college|school|academy|institute|polytechnic|conservatory|coursera|edx|udemy|bootcamp)\b/i.test(value);
}

function looksLikeProgram(value) {
  return /\b(associate|bachelor|master|doctor|ph\.?d|diploma|certificate|certification|degree|b\.?s\.?|b\.?a\.?|m\.?s\.?|m\.?a\.?|mba|high school diploma)\b/i.test(value);
}

function educationDate(line) {
  const value = cleanLine(line);
  const range = value.match(/\b((?:19|20)\d{2})\s*(?:[-–—]|to)\s*((?:19|20)\d{2}|Present|Current|Expected(?:\s+(?:19|20)\d{2})?)\b/i);
  if (range) {
    const end = range[2];
    const year = end.match(/(?:19|20)\d{2}/)?.[0];
    return { matched: true, graduation: year || (/present|current/i.test(end) ? 'Present' : end) };
  }
  const years = value.match(/\b(?:19|20)\d{2}\b/g);
  return { matched: Boolean(years?.length), graduation: years?.at(-1) ?? '' };
}

function parseEducationBlock(block) {
  const item = createEducation();
  const useful = block.map(cleanLine).filter(Boolean);
  const dateIndex = useful.findIndex((line) => educationDate(line).matched);
  if (dateIndex >= 0) {
    item.graduation = educationDate(useful[dateIndex]).graduation;
    useful.splice(dateIndex, 1);
  }

  const locationIndex = useful.findIndex((line) => /,\s*[A-Z]{2}\b/.test(line) || /\bremote\b/i.test(line));
  if (locationIndex >= 0) item.location = useful.splice(locationIndex, 1)[0];

  const schoolIndex = useful.findIndex(looksLikeSchool);
  const programIndex = useful.findIndex((line, index) => index !== schoolIndex && looksLikeProgram(line));

  if (schoolIndex >= 0) item.school = useful[schoolIndex];
  if (programIndex >= 0) item.degree = useful[programIndex];

  const remaining = useful.filter((_, index) => index !== schoolIndex && index !== programIndex);
  if (!item.school && remaining.length) item.school = remaining.shift();
  if (!item.degree && remaining.length) item.degree = remaining.shift();

  if (!item.school && item.degree && useful.length >= 2) item.school = useful.find((line) => line !== item.degree) ?? '';
  if (!item.degree && item.school && useful.length >= 2) item.degree = useful.find((line) => line !== item.school) ?? '';
  return item;
}

function parseEducation(lines) {
  const useful = lines.map(cleanLine).filter(Boolean);
  const blocks = [];
  let pending = [];

  for (const line of useful) {
    pending.push(line);
    if (educationDate(line).matched) {
      blocks.push(pending);
      pending = [];
    }
  }
  if (pending.length) blocks.push(pending);

  return blocks
    .map(parseEducationBlock)
    .filter((item) => item.degree || item.school);
}

export function parseResumeText(text, source = {}) {
  const normalizedText = normalizeExtractedText(text);
  const sections = sectionize(normalizedText);
  const resume = createBlankResume();
  const header = sections.header.filter(Boolean);
  const emailLine = header.find((line) => EMAIL.test(line)) ?? normalizedText.match(EMAIL)?.[0] ?? '';
  const phoneLine = header.find((line) => PHONE.test(line)) ?? normalizedText.match(PHONE)?.[0] ?? '';
  const urls = header.flatMap((line) => line.match(new RegExp(URLISH.source, 'ig')) ?? []);
  const nameCandidate = header.find((line) => !EMAIL.test(line) && !PHONE.test(line) && !URLISH.test(line) && line.length <= 64 && line.split(/\s+/).length >= 2 && line.split(/\s+/).length <= 6) ?? '';
  const headlineCandidate = header.find((line) => line !== nameCandidate && !EMAIL.test(line) && !PHONE.test(line) && !URLISH.test(line) && line.length <= 100) ?? '';

  resume.profile.fullName = cleanLine(nameCandidate);
  resume.profile.email = emailLine.match(EMAIL)?.[0] ?? '';
  resume.profile.phone = phoneLine.match(PHONE)?.[0] ?? '';
  resume.profile.linkedin = urls.find((url) => /linkedin\.com/i.test(url)) ?? '';
  resume.profile.portfolio = urls.find((url) => !/linkedin\.com/i.test(url)) ?? '';
  resume.profile.headline = cleanLine(headlineCandidate);
  resume.profile.summary = sections.summary.filter(Boolean).join(' ');
  resume.skills = splitSkillItems(sections.skills);
  resume.certifications = sections.certifications.map((line) => cleanLine(line.replace(BULLET_PREFIX, ''))).filter(Boolean);
  const roles = parseExperiences(sections.experience);
  if (roles.length) resume.experiences = roles;
  const education = parseEducation(sections.education);
  if (education.length) resume.education = education;
  resume.importedSource = {
    fileName: source.fileName ?? '',
    format: source.format ?? 'text',
    importedAt: new Date().toISOString(),
    text: normalizedText
  };
  return normalizeResume(resume);
}

export async function importResumeFile(file) {
  if (!(file instanceof Blob)) throw new Error('Choose a resume file to import.');
  if (file.size > MAX_RESUME_BYTES) throw new Error('Resume files are limited to 12 MB for local processing.');
  const name = file.name ?? 'resume';
  const lower = name.toLowerCase();
  if (lower.endsWith('.json')) {
    const value = JSON.parse(await file.text());
    return { resume: normalizeResume(value), sourceText: value.importedSource?.text ?? '', kind: 'backup' };
  }
  let text;
  let format;
  if (lower.endsWith('.docx') || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    text = await extractDocxText(file);
    format = 'docx';
  } else if (lower.endsWith('.pdf') || file.type === 'application/pdf') {
    text = await extractPdfText(file);
    format = 'pdf';
  } else if (lower.endsWith('.txt') || file.type === 'text/plain') {
    text = normalizeExtractedText(await file.text());
    format = 'text';
  } else {
    throw new Error('Use a Word (.docx), PDF (.pdf), text (.txt), or BespokeCV backup (.json) file.');
  }
  if (text.length < 20) throw new Error('Very little readable text was found. Try another file format or paste the resume text.');
  return { resume: parseResumeText(text, { fileName: name, format }), sourceText: text, kind: format };
}
