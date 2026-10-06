const MAX_JOB_BYTES = 2 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 12_000;
const ALLOWED_TYPES = ['text/html', 'application/xhtml+xml', 'text/plain', 'application/json', 'application/ld+json'];

function restrictedProvider(hostname) {
  const host = hostname.toLowerCase();
  if (host === 'linkedin.com' || host.endsWith('.linkedin.com')) return 'LinkedIn';
  if (/(^|\.)indeed\.[a-z.]+$/i.test(host)) return 'Indeed';
  return null;
}

function isBlockedHostname(hostname) {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.home') || host.endsWith('.lan')) return true;
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) {
    const parts = host.split('.').map(Number);
    if (parts.some((part) => part < 0 || part > 255)) return true;
    if (parts[0] === 10 || parts[0] === 127 || parts[0] === 0) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] >= 224) return true;
  }
  if (host.includes(':')) return true; // Conservative: reject all IPv6 literals.
  return false;
}

export function validateJobUrl(input) {
  const raw = String(input ?? '').trim();
  if (!raw) return { ok: false, reason: 'Enter a job-posting URL.' };
  let url;
  try { url = new URL(raw); }
  catch { return { ok: false, reason: 'Enter a complete, valid URL.' }; }
  if (url.protocol !== 'https:') return { ok: false, reason: 'Only HTTPS job-posting URLs are accepted.' };
  if (url.username || url.password) return { ok: false, reason: 'URLs containing embedded credentials are not accepted.' };
  if (url.port && url.port !== '443') return { ok: false, reason: 'Non-standard network ports are not accepted.' };
  if (isBlockedHostname(url.hostname)) return { ok: false, reason: 'Local, private-network, and IP-literal addresses are blocked.' };
  if (url.href.length > 2_048) return { ok: false, reason: 'The URL is unusually long and was rejected.' };
  url.hash = '';
  const provider = restrictedProvider(url.hostname);
  if (provider) {
    return {
      ok: true,
      fetchAllowed: false,
      provider,
      url: url.href,
      reason: `${provider} restricts automated scraping. BespokeCV can validate and link to this posting, but will not bypass those restrictions. Paste the posting text instead.`
    };
  }
  return { ok: true, fetchAllowed: true, provider: null, url: url.href, reason: '' };
}

function jsonLdObjects(value, output = []) {
  if (!value || typeof value !== 'object') return output;
  if (Array.isArray(value)) { for (const item of value) jsonLdObjects(item, output); return output; }
  const type = value['@type'];
  if (type === 'JobPosting' || (Array.isArray(type) && type.includes('JobPosting'))) output.push(value);
  if (value['@graph']) jsonLdObjects(value['@graph'], output);
  for (const child of Object.values(value)) if (child && typeof child === 'object') jsonLdObjects(child, output);
  return output;
}

function htmlFragmentToText(html) {
  const doc = new DOMParser().parseFromString(`<main>${String(html ?? '')}</main>`, 'text/html');
  for (const el of doc.querySelectorAll('script,style,noscript,iframe,object,embed,form,svg,canvas')) el.remove();
  for (const el of doc.querySelectorAll('br,p,li,h1,h2,h3,h4,div,section')) el.append('\n');
  return doc.body.textContent.replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n\s*/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function extractFromJson(value) {
  const postings = jsonLdObjects(value);
  const posting = postings[0] ?? value;
  const title = posting.title ?? posting.name ?? '';
  const company = posting.hiringOrganization?.name ?? posting.company?.name ?? posting.company ?? '';
  const description = htmlFragmentToText(posting.description ?? posting.responsibilities ?? posting.qualifications ?? '');
  return { title: String(title || ''), company: String(company || ''), description };
}

function extractFromHtml(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const postings = [];
  for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
    try { jsonLdObjects(JSON.parse(script.textContent), postings); } catch { /* ignore malformed metadata */ }
  }
  if (postings.length) return extractFromJson(postings[0]);

  for (const el of doc.querySelectorAll('script,style,noscript,iframe,object,embed,form,svg,canvas,nav,header,footer')) el.remove();
  const selectors = ['[itemprop="description"]', '[class*="job-description" i]', '[id*="job-description" i]', '[class*="jobDescription" i]', '[id*="jobDescription" i]', 'article', 'main'];
  const candidates = selectors.flatMap((selector) => Array.from(doc.querySelectorAll(selector))).map((el) => htmlFragmentToText(el.innerHTML)).filter(Boolean);
  candidates.push(htmlFragmentToText(doc.body.innerHTML));
  candidates.sort((a, b) => b.length - a.length);
  const title = doc.querySelector('h1')?.textContent?.trim() || doc.querySelector('meta[property="og:title"]')?.content || doc.title || '';
  return { title, company: '', description: candidates[0] ?? '' };
}

export async function fetchJobPosting(input) {
  const validation = validateJobUrl(input);
  if (!validation.ok) throw new Error(validation.reason);
  if (!validation.fetchAllowed) return { ...validation, restricted: true, description: '', title: '', company: '' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(validation.url, {
      method: 'GET', mode: 'cors', credentials: 'omit', redirect: 'error', cache: 'no-store', referrerPolicy: 'no-referrer',
      headers: { Accept: 'text/html,application/xhtml+xml,application/ld+json,application/json,text/plain;q=0.9' },
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`The job page returned HTTP ${response.status}.`);
    const type = (response.headers.get('content-type') || '').split(';')[0].toLowerCase();
    if (!ALLOWED_TYPES.includes(type)) throw new Error(`Unsupported job-page content type: ${type || 'unknown'}.`);
    const declared = Number(response.headers.get('content-length') || 0);
    if (declared && declared > MAX_JOB_BYTES) throw new Error('The job page is larger than the 2 MB safety limit.');
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length > MAX_JOB_BYTES) throw new Error('The job page exceeded the 2 MB safety limit.');
    const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    const extracted = type.includes('json') ? extractFromJson(JSON.parse(text)) : type === 'text/plain' ? { title: '', company: '', description: text } : extractFromHtml(text);
    const description = String(extracted.description ?? '').replace(/\n{3,}/g, '\n\n').trim().slice(0, 60_000);
    if (description.length < 80) throw new Error('The page loaded, but BespokeCV could not identify enough job-description text. Paste the posting text instead.');
    return { ...validation, restricted: false, title: extracted.title.trim().slice(0, 300), company: extracted.company.trim().slice(0, 300), description };
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('The job page took too long to respond. Paste the posting text instead.');
    if (error instanceof TypeError) throw new Error('The site does not permit safe browser-to-browser reading (CORS). BespokeCV will not bypass that protection; paste the posting text instead.');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
