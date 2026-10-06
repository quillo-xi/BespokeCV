import { resumeToPlainText } from './model.js';

const STOPWORDS = new Set(`a an and are as at be been being but by can could did do does for from had has have having he her hers him his how i if in into is it its may might more most must no not of on or our ours should so than that the their theirs them then there these they this those to too up us very was we were what when where which who will with would you your yours including include includes preferred required minimum plus about across after before through using use used role work working job candidate candidates ability abilities responsibilities responsibility qualification qualifications experience experienced years year all under within while any each both other related applicable assigned overall various strong high level well comfortable quickly new current provide providing performs perform position duties duty successful success also ensure ensures ensuring knowledge understanding skilled skill skills`.split(/\s+/));

const NOISE_TERMS = new Set(`employment misconduct applicant applicants employer employers opportunity equal consideration conditions authorization sponsorship e-verify race color religion sex sexual gender identity national origin disability veteran accommodation anti-discrimination community workforce salary compensation benefits insurance retirement perk perks category categories application applications university uc uci activities activity subject subjects person persons`.split(/\s+/));

const AMBIGUOUS_SINGLE = new Set(`quality assurance data research clinical regulatory monitoring reporting compliance review software computer trial trials action actions process processes documentation submission findings subject certification certified license licensed licensure registration registered credential`.split(/\s+/));

const TECH_SINGLE_TERMS = new Set(`python sql tableau powerbi power-bi excel outlook powerpoint salesforce jira sap epic workday aws azure javascript typescript java c++ c# r matlab sas spss snowflake servicenow github git docker kubernetes terraform`.split(/\s+/));

const ACTION_VERBS = new Set(`achieved accelerated administered advised analyzed automated built launched coached collaborated consolidated created decreased delivered designed developed directed drove eliminated established expanded generated grew implemented improved increased led managed mentored modernized negotiated optimized orchestrated planned produced reduced redesigned resolved saved secured standardized streamlined strengthened supervised transformed upgraded validated won audited coordinated trained maintained monitored prepared supported reviewed verified facilitated oversaw conducted assessed ensured investigated documented reconciled evaluated operated performed calculated utilized assisted answered helped collected researched handled safeguarded filled compounded dispensed accessed processed tested drafted scheduled organized communicated troubleshot repaired configured installed reconciled tracked inventoried presented prepared maintained operates performs calculates utilizes assists answers helps collects researches handles safeguards fills compounds dispenses accesses processes tests drafts schedules organizes communicates repairs configures installs tracks inventories presents operate perform calculate utilize assist answer help collect research handle safeguard fill compound dispense access process test draft schedule organize communicate repair configure install track inventory present manage lead coordinate train supervise review verify facilitate conduct assess ensure investigate document evaluate resolve support advise analyze automate build coach collaborate consolidate create deliver design develop direct establish expand generate implement improve increase mentor modernize negotiate optimize orchestrate plan produce reduce redesign secure standardize streamline strengthen transform upgrade validate audit monitor prepare maintain`.split(/\s+/));

const PRONOUNS = /\b(i|me|my|mine|we|our|ours)\b/i;
const METRIC_PATTERN = /(?:\$\s?\d|\b\d+(?:\.\d+)?\s?(?:%|percent|x|k|m|b|hours?|days?|weeks?|months?|years?|users?|clients?|sites?|locations?|projects?|cases?|records?|transactions?|people|staff|employees?|leaders?|teams?|workflows?|dashboards?|systems?|tools?|programs?|categories?)(?=\s|[.,;:)]|$)|\b(?:daily|weekly|monthly|quarterly|annually|annual|per\s+(?:day|week|month|quarter|year|shift))\b|\b(?:increased|decreased|reduced|grew|saved|cut|improved|raised|lowered)\b[^.]{0,30}\b\d+)/i;

const REQUIREMENT_SIGNAL = /\b(required|requirements?|must|minimum|at least|certification|certified|license|licensed|degree|years? of|proficiency|expertise|preferred|working knowledge|strong understanding|experience with|experience reviewing|knowledge of)\b/i;
const PREFERRED_SIGNAL = /\b(preferred|ideally|desired|a plus|nice to have)\b/i;
const BOILERPLATE_SENTENCE = /\b(equal opportunity|without regard to|conditions of employment|reasonable accommodation|work authorization|e-verify|salary range|total rewards|benefits may include|consideration for work authorization|anti-discrimination|protected veteran|sexual orientation|gender identity|pre-placement health|background check|misconduct policy|legal right to work|vaccination policies|smoking and tobacco|drug free environment)\b/i;

const REQUIRED_SECTION_HEADING = /^(?:required|minimum|basic|essential|mandatory)(?:\s+(?:qualifications?|requirements?|education|experience|skills?|licenses?|certifications?|credentials?))?\s*:?$/i;
const PREFERRED_SECTION_HEADING = /^(?:preferred|desired|additional|nice[- ]to[- ]have)(?:\s+(?:qualifications?|requirements?|education|experience|skills?|licenses?|certifications?|credentials?))?\s*:?$/i;
const GENERIC_REQUIREMENT_HEADING = /^(?:qualifications?|requirements?|education\s+(?:and|&)\s+experience|licenses?\s+(?:and|&)\s+certifications?|certifications?\s+(?:and|&)\s+licenses?)\s*:?$/i;
const NON_REQUIREMENT_HEADING = /^(?:about(?:\s+the\s+job|\s+us|\s+the\s+company|\s+[a-z0-9 &'-]+)?|description|job description|responsibilities|key responsibilities|duties|essential functions|what you(?:'|’)ll do|why join[^.]*|benefits|compensation|salary|pay range|about the team|our culture)\s*:?\??$/i;
const STRONG_REQUIREMENT_SIGNAL = /\b(?:required|required to|must\s+(?:have|hold|possess|be|meet|obtain|maintain)|minimum\s+(?:of\s+)?|at\s+least|licen[cs](?:e|ed|ure)|certif(?:ication|ied)|registration|registered|degree|years?\s+of\s+experience|proficiency\s+in|experience\s+(?:with|in)|knowledge\s+of)\b/i;
const TIMING_PREFIX = /^(upon\s+hire|at\s+hire|at\s+time\s+of\s+hire|by\s+(?:the\s+)?date\s+of\s+hire|prior\s+to\s+hire|before\s+(?:hire|start(?:ing)?)|within\s+\d+\s+(?:days?|weeks?|months?)\s+(?:of|after)\s+(?:hire|start(?:ing)?))\s*[:\-–—]\s*/i;

function cleanRequirementText(value) {
  return String(value ?? '')
    .replace(/^[\s•▪◦*-]+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitRequirementLine(value) {
  const line = cleanRequirementText(value);
  if (!line) return [];
  return line.split(/(?<=[.!?;])\s+/).map(cleanRequirementText).filter(Boolean);
}

function requirementSectionKind(value) {
  const line = cleanRequirementText(value);
  if (!line) return null;
  if (PREFERRED_SECTION_HEADING.test(line)) return 'preferred';
  if (REQUIRED_SECTION_HEADING.test(line) || GENERIC_REQUIREMENT_HEADING.test(line)) return 'required';
  if (NON_REQUIREMENT_HEADING.test(line)) return 'other';
  return null;
}

function normalizeRequirementCandidate(value, inheritedType = null) {
  let text = cleanRequirementText(value);
  if (!text) return null;

  let type = inheritedType === 'preferred' || PREFERRED_SIGNAL.test(text) ? 'preferred' : 'required';
  let timing = '';

  const timingMatch = text.match(TIMING_PREFIX);
  if (timingMatch) {
    timing = cleanRequirementText(timingMatch[1]);
    text = cleanRequirementText(text.slice(timingMatch[0].length));
  }

  const preferredPrefix = text.match(/^(?:preferred|desired|nice[- ]to[- ]have)\s*[:\-–—]\s*/i);
  if (preferredPrefix) {
    type = 'preferred';
    text = cleanRequirementText(text.slice(preferredPrefix[0].length));
  }

  const requiredPrefix = text.match(/^(?:required|minimum)\s*[:\-–—]\s*/i);
  if (requiredPrefix) {
    type = 'required';
    text = cleanRequirementText(text.slice(requiredPrefix[0].length));
  }

  const preferredSuffix = text.match(/\s+(?:is\s+)?preferred\.?$/i);
  if (preferredSuffix) {
    type = 'preferred';
    text = cleanRequirementText(text.slice(0, -preferredSuffix[0].length));
  }

  const requiredSuffix = text.match(/\s+(?:is\s+)?required\.?$/i);
  if (requiredSuffix) {
    type = 'required';
    text = cleanRequirementText(text.slice(0, -requiredSuffix[0].length));
  }

  if (!text || requirementSectionKind(text)) return null;
  return { text, type, timing };
}


const CONCEPT_PATTERNS = [
  concept('quality assurance', /\bquality assurance\b|\bQA\b/i, ['quality assurance', 'qa']),
  concept('quality control', /\bquality control\b|\bQC\b/i, ['quality control', 'qc']),
  concept('clinical research', /\bclinical research\b/i),
  concept('clinical trials', /\bclinical trials?\b/i, ['clinical trial', 'clinical trials']),
  concept('regulatory compliance', /\bregulatory compliance\b/i),
  concept('regulatory affairs', /\bregulatory affairs\b/i),
  concept('data compliance', /\bdata compliance\b/i),
  concept('data integrity', /\bdata integrity\b/i),
  concept('protocol compliance', /\bprotocol compliance\b/i),
  concept('clinical trial data', /\bclinical trial data\b/i),
  concept('clinical data monitoring', /\bclinical data monitoring\b/i),
  concept('clinical data reporting', /\bclinical (?:trial )?data[^.;\n]{0,28}\breport(?:ing|s|ed)?\b|\breport(?:ing|s|ed)?[^.;\n]{0,28}\bclinical (?:trial )?data\b/i, ['clinical data reporting', 'clinical trial data reporting', 'clinical trial data reporting findings']),
  concept('monitoring and auditing', /\bmonitor(?:ing|ed)?\b[^.;\n]{0,28}\baud(?:it|iting|ited)s?\b|\baud(?:it|iting|ited)s?\b[^.;\n]{0,28}\bmonitor(?:ing|ed)?\b/i, ['monitoring auditing', 'monitoring and auditing', 'monitoring or auditing']),
  concept('internal audits', /\binternal audits?\b/i),
  concept('external audits', /\bexternal audits?\b/i),
  concept('audit readiness', /\baudit[- ]ready\b|\baudit readiness\b/i),
  concept('CAPA', /\bCAPA\b|\bcorrective\s+(?:and|&)\s+preventive\s+actions?\b/i, ['capa', 'corrective and preventive action', 'corrective preventive action']),
  concept('GCP', /\bGCP\b|\bgood clinical practice(?:s)?\b/i, ['gcp', 'good clinical practice', 'good clinical practices']),
  concept('ICH guidelines', /\bICH(?:\s+guidelines?)?\b/i, ['ich', 'ich guideline', 'ich guidelines']),
  concept('FDA-regulated studies', /\bFDA[- ]regulated (?:studies|study|trials?)\b/i, ['fda regulated studies', 'fda regulated study', 'fda regulated trial', 'fda regulated trials']),
  concept('informed consent', /\binformed consent\b/i),
  concept('adverse event reporting', /\b(?:serious )?adverse events?\b[^.;\n]{0,24}\breport(?:ing|ed)?\b|\breport(?:ing|ed)?\b[^.;\n]{0,24}\b(?:serious )?adverse events?\b/i, ['adverse event reporting', 'serious adverse event reporting', 'adverse events', 'serious adverse events']),
  concept('investigational drug review', /\binvestigational drug(?: service)?[^.;\n]{0,24}\breview\b|\bpharmacy record review\b/i, ['investigational drug review', 'investigational drug service', 'pharmacy record review']),
  concept('electronic medical record review', /\belectronic medical record review\b|\bEMR review\b/i, ['electronic medical record review', 'emr review']),
  concept('subject eligibility', /\bsubject eligibility\b/i),
  concept('human-subject research', /\bhuman subjects?\b[^.;\n]{0,20}\b(?:research|clinical trials?)\b/i, ['human subject research', 'human subjects research', 'human subject clinical trials']),
  concept('SoCRA / ACRP certification', /\bSoCRA\b|\bACRP\b|\bSociety of Clinical Research (?:Associates|Administrators)\b|\bAssociation of Clinical Research Professionals?\b/i, ['socra', 'acrp', 'socra certification', 'acrp certification', 'society of clinical research associates', 'society of clinical research administrators', 'association of clinical research professionals']),
  concept('clinical research certification', /\bclinical (?:trial|research) professional certification\b|\bprofessional certification[^.;\n]{0,30}\bclinical research\b/i, ['clinical research certification', 'clinical trial professional certification']),
  concept('cancer research', /\bcancer[- ]related research\b|\bcancer research\b/i, ['cancer research', 'cancer related research']),
  concept('Microsoft Office', /\bMicrosoft Office\b/i, ['microsoft office']),
  concept('project management', /\bproject management\b/i),
  concept('program management', /\bprogram management\b/i),
  concept('product management', /\bproduct management\b/i),
  concept('stakeholder management', /\bstakeholder management\b/i),
  concept('vendor management', /\bvendor management\b/i),
  concept('change management', /\bchange management\b/i),
  concept('risk management', /\brisk management\b/i),
  concept('root cause analysis', /\broot cause analysis\b/i),
  concept('process improvement', /\bprocess improvement\b/i),
  concept('continuous improvement', /\bcontinuous improvement\b/i),
  concept('quality improvement', /\bquality improvement\b/i),
  concept('data analysis', /\bdata analysis\b/i),
  concept('data analytics', /\bdata analytics\b/i),
  concept('data visualization', /\bdata visualization\b/i),
  concept('business intelligence', /\bbusiness intelligence\b/i),
  concept('machine learning', /\bmachine learning\b/i),
  concept('artificial intelligence', /\bartificial intelligence\b/i),
  concept('software engineering', /\bsoftware engineering\b/i),
  concept('software development', /\bsoftware development\b/i),
  concept('cloud computing', /\bcloud computing\b/i),
  concept('information security', /\binformation security\b/i),
  concept('cybersecurity', /\bcybersecurity\b/i),
  concept('customer service', /\bcustomer service\b/i),
  concept('supply chain', /\bsupply chain\b/i),
  concept('human resources', /\bhuman resources\b/i),
  concept('talent acquisition', /\btalent acquisition\b/i),
  concept('financial analysis', /\bfinancial analysis\b/i),
  concept('strategic planning', /\bstrategic planning\b/i),
  concept('standard operating procedures', /\bstandard operating procedures?\b|\bSOPs?\b/i, ['standard operating procedures', 'standard operating procedure', 'sop', 'sops']),
  concept('interpersonal skills', /\binterpersonal skills?\b/i),
  concept('communication skills', /\bcommunication skills?\b/i),
  concept('presentation skills', /\bpresentation skills?\b/i),
  concept('organizational skills', /\borganizational skills?\b/i),
  concept('planning skills', /\bplanning skills?\b/i),
  concept('problem solving', /\bproblem[- ]solving\b|\bsolve complex problems?\b/i, ['problem solving', 'problem-solving']),
  concept('attention to detail', /\battention to detail\b/i),
  concept('confidentiality', /\bconfidentiality\b/i),
  concept('multitasking', /\bmultitask(?:ing)?\b/i)
];

const ALIASES = new Map(CONCEPT_PATTERNS.map((item) => [item.term.toLowerCase(), item.aliases]));

function concept(term, pattern, aliases = [term]) {
  return { term, pattern, aliases };
}

function words(text) {
  return String(text ?? '').toLowerCase().replace(/[’']/g, '').match(/[a-z][a-z0-9+#]*(?:[./-][a-z0-9+#]+)*/g) ?? [];
}

function stem(word) {
  let value = word.toLowerCase();
  if (value.length > 5 && value.endsWith('ies')) return `${value.slice(0, -3)}y`;
  if (value.length > 5 && value.endsWith('ing')) value = value.slice(0, -3);
  else if (value.length > 4 && value.endsWith('ed')) value = value.slice(0, -2);
  else if (value.length > 4 && value.endsWith('es')) value = value.slice(0, -2);
  else if (value.length > 3 && value.endsWith('s')) value = value.slice(0, -1);
  return value;
}

function meaningfulToken(token) {
  return token.length > 2 && !STOPWORDS.has(token) && !NOISE_TERMS.has(token);
}

function significantSentenceList(jobDescription) {
  return String(jobDescription ?? '')
    .split(/(?:\n+|(?<=[.!?;])\s+)/)
    .map((value) => value.replace(/^[-•*]\s*/, '').trim())
    .filter((value) => value && !BOILERPLATE_SENTENCE.test(value));
}

function addCandidate(map, term, weight, count = 1, source = 'derived') {
  const normalized = term.trim();
  if (!normalized) return;
  const key = normalized.toLowerCase();
  const current = map.get(key) ?? { term: normalized, weight: 0, count: 0, source };
  current.weight += weight;
  current.count += count;
  if (source === 'canonical') current.source = 'canonical';
  map.set(key, current);
}

function phraseKey(tokens) {
  return tokens.map(stem).join(' ');
}

function containsConcept(existing, candidate) {
  const left = ` ${phraseKey(words(existing))} `;
  const right = ` ${phraseKey(words(candidate))} `;
  return left.includes(right) || right.includes(left);
}

export function extractKeywords(jobDescription, limit = 24) {
  const sentences = significantSentenceList(jobDescription);
  const candidates = new Map();
  const singleCounts = new Map();
  const bigramCounts = new Map();

  for (const sentence of sentences) {
    const requirementBoost = REQUIREMENT_SIGNAL.test(sentence) ? 2.2 : 0;

    for (const item of CONCEPT_PATTERNS) {
      if (item.pattern.test(sentence)) addCandidate(candidates, item.term, 4.5 + requirementBoost, 1, 'canonical');
    }

    const tokens = words(sentence);
    for (const token of tokens) {
      if (!meaningfulToken(token)) continue;
      singleCounts.set(token, (singleCounts.get(token) ?? 0) + 1);
    }

    for (let index = 0; index < tokens.length - 1; index += 1) {
      const pair = tokens.slice(index, index + 2);
      if (!pair.every(meaningfulToken)) continue;
      const key = pair.join(' ');
      bigramCounts.set(key, (bigramCounts.get(key) ?? 0) + 1);
    }
  }

  for (const [term, count] of bigramCounts) {
    if (count < 2) continue;
    addCandidate(candidates, term, 1.8 * count, count, 'derived');
  }

  for (const [term, count] of singleCounts) {
    if (count < 2 && !TECH_SINGLE_TERMS.has(term)) continue;
    if (AMBIGUOUS_SINGLE.has(term)) continue;
    addCandidate(candidates, term, count + (TECH_SINGLE_TERMS.has(term) ? 2.5 : 0), count, 'single');
  }

  let ranked = [...candidates.values()]
    .filter((item) => !NOISE_TERMS.has(item.term.toLowerCase()))
    .sort((a, b) => b.weight - a.weight || b.count - a.count || words(b.term).length - words(a.term).length);

  const canonical = ranked.filter((item) => item.source === 'canonical');
  ranked = ranked.filter((item) => {
    if (item.source === 'canonical') return true;
    if (words(item.term).length === 1) {
      return !canonical.some((existing) =>
        AMBIGUOUS_SINGLE.has(item.term.toLowerCase()) &&
        words(existing.term).map(stem).includes(stem(item.term))
      );
    }
    return !canonical.some((existing) => containsConcept(existing.term, item.term));
  });

  const selected = [];
  for (const item of ranked) {
    const nestedIndex = selected.findIndex((existing) => containsConcept(existing.term, item.term));
    if (nestedIndex >= 0) {
      const existing = selected[nestedIndex];
      if (item.source === 'canonical' && existing.source === 'canonical') {
        selected.push(item);
        if (selected.length >= limit) break;
        continue;
      }
      if (item.source === 'canonical' && existing.source !== 'canonical') selected[nestedIndex] = item;
      continue;
    }
    selected.push(item);
    if (selected.length >= limit) break;
  }

  return selected.map(({ term, weight }) => ({ term, weight }));
}

export function resolveTargetConcepts(jobDescription, overrides = {}, limit = 24) {
  const excluded = new Set((Array.isArray(overrides.excluded) ? overrides.excluded : []).map((term) => String(term).trim().toLowerCase()).filter(Boolean));
  const added = (Array.isArray(overrides.added) ? overrides.added : [])
    .map((term) => String(term).replace(/\s+/g, ' ').trim())
    .filter((term) => term.length >= 2 && term.length <= 80);

  const automatic = extractKeywords(jobDescription, Math.max(limit + excluded.size + added.length, 32))
    .filter((item) => !excluded.has(item.term.toLowerCase()))
    .map((item) => ({ ...item, source: 'automatic' }));

  const byTerm = new Map(automatic.map((item) => [item.term.toLowerCase(), item]));
  for (const term of added) {
    const key = term.toLowerCase();
    if (excluded.has(key)) continue;
    const existing = byTerm.get(key);
    byTerm.set(key, existing ? { ...existing, source: 'manual' } : { term, weight: 6.5, source: 'manual' });
  }

  return [...byTerm.values()]
    .sort((a, b) => (b.source === 'manual') - (a.source === 'manual') || b.weight - a.weight)
    .slice(0, limit);
}

export function extractRequirementSignals(jobDescription, limit = 18) {
  const results = [];
  let section = 'other';

  const rawLines = String(jobDescription ?? '').split(/\n+/);
  for (const rawLine of rawLines) {
    const cleanedLine = cleanRequirementText(rawLine);
    if (!cleanedLine) continue;

    const sectionKind = requirementSectionKind(cleanedLine);
    if (sectionKind) {
      section = sectionKind;
      continue;
    }

    for (const sentence of splitRequirementLine(cleanedLine)) {
      if (BOILERPLATE_SENTENCE.test(sentence)) continue;

      const inRequirementSection = section === 'required' || section === 'preferred';
      const explicit = STRONG_REQUIREMENT_SIGNAL.test(sentence) || PREFERRED_SIGNAL.test(sentence);
      if (!inRequirementSection && !explicit) continue;

      const item = normalizeRequirementCandidate(sentence, inRequirementSection ? section : null);
      if (!item) continue;

      const key = item.text.toLowerCase();
      if (results.some((existing) => existing.text.toLowerCase() === key)) continue;
      results.push(item);
      if (results.length >= limit) return results;
    }
  }

  return results;
}

export function extractRequirements(jobDescription, limit = 10) {
  return extractRequirementSignals(jobDescription, limit).map((item) => item.text);
}

function normalizedStems(text) {
  return words(text).filter((word) => !STOPWORDS.has(word) && !NOISE_TERMS.has(word)).map(stem);
}

function supportsSequence(text, phrase) {
  const haystack = normalizedStems(text);
  const needle = normalizedStems(phrase);
  if (!needle.length) return false;
  if (needle.length === 1) return haystack.includes(needle[0]);
  for (let index = 0; index <= haystack.length - needle.length; index += 1) {
    if (needle.every((token, offset) => haystack[index + offset] === token)) return true;
  }
  return false;
}

export function textSupportsTerm(text, term) {
  const aliases = ALIASES.get(String(term).toLowerCase()) ?? [term];
  return aliases.some((alias) => supportsSequence(text, alias));
}

function bounded(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function nonEmptyBullets(resume) {
  return resume.experiences.flatMap((role) => role.bullets ?? []).map((bullet) => bullet.trim()).filter(Boolean);
}

function startsWithActionVerb(bullet) {
  const tokens = words(bullet);
  const first = tokens[0];
  if (first && ACTION_VERBS.has(first)) return true;

  const labeledLead = String(bullet ?? '').match(/^[^;:]{1,36}[;:]\s*(.+)$/);
  if (labeledLead) {
    const next = words(labeledLead[1])[0];
    if (next && ACTION_VERBS.has(next)) return true;
  }
  return false;
}

function bulletRecords(resume) {
  return resume.experiences.flatMap((role, roleIndex) =>
    (role.bullets ?? []).map((bullet, bulletIndex) => ({
      roleIndex,
      bulletIndex,
      roleLabel: [role.title, role.company].filter(Boolean).join(' — ') || `Position ${roleIndex + 1}`,
      bullet: String(bullet ?? '').trim()
    }))
  ).filter((item) => item.bullet);
}

function sentenceCase(value) {
  const text = String(value ?? '').trim();
  return text ? text[0].toUpperCase() + text.slice(1) : '';
}

function stripTerminalPeriod(value) {
  return String(value ?? '').trim().replace(/[.]+$/, '');
}

function rewriteActionOpening(bullet) {
  const original = String(bullet ?? '').trim();
  if (!original) return '';

  let match = original.match(/^responsible\s+for\s+(?:the\s+)?accountability\s+and\s+safeguarding\s+of\s+(.+)/i);
  if (match) return `Safeguarded and maintained accountability for ${stripTerminalPeriod(match[1])}.`;

  match = original.match(/^responsible\s+for\s+(.+)/i);
  if (match) return `Managed ${stripTerminalPeriod(match[1]).replace(/^the\s+/i, '')}.`;

  match = original.match(/^project\s+lead\s*[;:—-]\s*(.+)/i);
  if (match) {
    const rest = stripTerminalPeriod(match[1]);
    return `${sentenceCase(rest)} as project lead.`;
  }

  match = original.match(/^provide\s+(?:full[- ]time\s+)?support\s+to\s+(.+)/i);
  if (match) return `Supported ${stripTerminalPeriod(match[1])}.`;

  match = original.match(/^help(?:ed|s)?\s+(.+)/i);
  if (match) return `Supported ${stripTerminalPeriod(match[1])}.`;

  match = original.match(/^assist(?:ed|s)?\s+(.+)/i);
  if (match) return `Supported ${stripTerminalPeriod(match[1])}.`;

  match = original.match(/^answer(?:ed|s)?\s+(.+)/i);
  if (match) return `Handled ${stripTerminalPeriod(match[1])}.`;

  return '';
}

function enumerationItems(value) {
  const text = stripTerminalPeriod(value)
    .replace(/\s+(?:and|&)\s+/gi, ', ')
    .replace(/;+/g, ',');
  const items = text.split(/\s*,\s*/).map((item) => item.trim()).filter(Boolean);
  if (items.length < 2 || items.length > 6) return [];
  if (items.some((item) => words(item).length > 7)) return [];
  return items;
}

function rewriteWithDerivedMeasure(bullet) {
  const original = String(bullet ?? '').trim();
  if (!original || METRIC_PATTERN.test(original)) return null;

  const including = original.match(/\bincluding\s+([^.;]+)([.;]?)$/i);
  if (including) {
    const items = enumerationItems(including[1]);
    if (items.length >= 2) {
      const prefix = original.slice(0, including.index).trim().replace(/[,:;\s]+$/, '');
      const list = stripTerminalPeriod(including[1]);
      return {
        text: `${prefix}, covering ${items.length} named categories: ${list}.`,
        derived: `The number ${items.length} comes from the items already listed in the original bullet.`
      };
    }
  }

  return null;
}

function measurementQuestion(bullet) {
  const text = String(bullet ?? '').toLowerCase();
  if (/train|teach|coach|educat|onboard/.test(text)) return 'How many people, sessions, teams, or locations were involved, and how often did you do this?';
  if (/audit|review|monitor|inspect|test|quality|compliance/.test(text)) return 'How many records, tests, reviews, sites, or checks were involved, and how often?';
  if (/prepare|compound|fill|dispens|prescription|order/.test(text)) return 'What verified volume or frequency fits this work—for example, preparations, prescriptions, or orders per shift, day, or week?';
  if (/report|data|query|dashboard|document|record/.test(text)) return 'How often was this produced or reviewed, how many records/reports were involved, or who used the result?';
  if (/manage|lead|supervis|coordinate|project|team/.test(text)) return 'What was the size of the team, project count, site count, budget, or cadence you can add?';
  if (/save|improv|reduce|increase|decrease|streamlin|expand|enhance/.test(text)) return 'What before/after result can you verify—time, cost, error rate, throughput, quality, or percentage change?';
  if (/inventory|equipment|asset|accountab|safeguard/.test(text)) return 'What verified inventory value, asset count, item count, or review frequency can you include?';
  return 'What count, frequency, time, money, volume, quality, risk, or percentage detail can you verify for this work?';
}

function buildEvidenceExamples(resume) {
  const records = bulletRecords(resume);
  if (!records.length) return [];

  const examples = [];
  const used = new Set();
  const add = (item) => {
    const key = `${item.roleIndex}:${item.bulletIndex}:${item.kind}`;
    if (used.has(key)) return;
    used.add(key);
    examples.push(item);
  };

  const combined = records.find((item) =>
    METRIC_PATTERN.test(item.bullet) &&
    !startsWithActionVerb(item.bullet) &&
    rewriteActionOpening(item.bullet)
  );
  if (combined) {
    add({
      ...combined,
      kind: 'combined',
      title: 'Turn existing measurable scope into a stronger accomplishment',
      before: combined.bullet,
      after: rewriteActionOpening(combined.bullet),
      criteria: ['Action opening', 'Measurable signal'],
      note: 'The measurable detail was already present; the rewrite makes the action easier to see.'
    });
  }

  const measurable = records.find((item) => !METRIC_PATTERN.test(item.bullet) && rewriteWithDerivedMeasure(item.bullet));
  if (measurable) {
    const rewrite = rewriteWithDerivedMeasure(measurable.bullet);
    add({
      ...measurable,
      kind: 'measure',
      title: 'Make existing scope measurable',
      before: measurable.bullet,
      after: rewrite.text,
      criteria: ['Measurable signal'],
      note: rewrite.derived
    });
  }

  const weakAction = records.find((item) =>
    !startsWithActionVerb(item.bullet) &&
    !used.has(`${item.roleIndex}:${item.bulletIndex}:combined`) &&
    rewriteActionOpening(item.bullet)
  );
  if (weakAction) {
    add({
      ...weakAction,
      kind: 'action',
      title: 'Lead with the action',
      before: weakAction.bullet,
      after: rewriteActionOpening(weakAction.bullet),
      criteria: ['Action opening'],
      note: 'This keeps the original meaning while moving the work itself to the front.'
    });
  }

  const strong = records.find((item) => startsWithActionVerb(item.bullet) && METRIC_PATTERN.test(item.bullet));
  if (strong && examples.length < 3) {
    add({
      ...strong,
      kind: 'strong',
      title: 'A bullet already doing both well',
      before: strong.bullet,
      after: strong.bullet,
      criteria: ['Action opening', 'Measurable signal'],
      note: 'Use this structure as a model for other bullets where similar detail is available.'
    });
  }

  if (!examples.some((item) => item.criteria.includes('Measurable signal'))) {
    const candidate = records.find((item) => !METRIC_PATTERN.test(item.bullet)) ?? records[0];
    const actionRewrite = rewriteActionOpening(candidate.bullet);
    add({
      ...candidate,
      kind: 'measure-prompt',
      title: 'Add one concrete measure',
      before: candidate.bullet,
      after: actionRewrite || candidate.bullet,
      criteria: actionRewrite ? ['Action opening'] : [],
      prompt: measurementQuestion(candidate.bullet),
      note: 'The resume does not provide a safe number to insert here, so the next step is to add a detail you can confirm.'
    });
  }

  return examples.slice(0, 3);
}

function summaryScore(summary) {
  const count = words(summary).length;
  if (count === 0) return 0;
  if (count >= 35 && count <= 85) return 100;
  if (count >= 20 && count <= 110) return 75;
  return 45;
}

function bulletLengthScore(bullet) {
  const count = words(bullet).length;
  if (count >= 8 && count <= 32) return 100;
  if (count >= 5 && count <= 40) return 70;
  return 35;
}

export function analyzeResume(resume) {
  const text = resumeToPlainText(resume);
  const bullets = nonEmptyBullets(resume);
  const jobKeywords = resolveTargetConcepts(resume.jobDescription, resume.targetConceptOverrides);
  const requirements = extractRequirements(resume.jobDescription);

  const matchedKeywords = jobKeywords.filter(({ term }) => textSupportsTerm(text, term));
  const missingKeywords = jobKeywords.filter(({ term }) => !textSupportsTerm(text, term));
  const totalKeywordWeight = jobKeywords.reduce((sum, item) => sum + item.weight, 0) || 1;
  const matchedWeight = matchedKeywords.reduce((sum, item) => sum + item.weight, 0);
  const targetScore = resume.jobDescription.trim() ? bounded((matchedWeight / totalKeywordWeight) * 100) : 0;

  const metricCount = bullets.filter((bullet) => METRIC_PATTERN.test(bullet)).length;
  const actionCount = bullets.filter(startsWithActionVerb).length;
  const cleanBulletCount = bullets.filter((bullet) => !PRONOUNS.test(bullet)).length;
  const lengthScore = bullets.length ? bullets.reduce((sum, bullet) => sum + bulletLengthScore(bullet), 0) / bullets.length : 0;

  const evidenceScore = bounded(
    (bullets.length ? (metricCount / bullets.length) * 35 : 0) +
    (bullets.length ? (actionCount / bullets.length) * 25 : 0) +
    (bullets.length ? (cleanBulletCount / bullets.length) * 15 : 0) +
    lengthScore * 0.15 +
    summaryScore(resume.profile.summary) * 0.10
  );

  const profile = resume.profile;
  const parseChecks = [
    Boolean(profile.fullName.trim()),
    Boolean(profile.email.trim()),
    Boolean(profile.phone.trim()),
    resume.experiences.some((role) => role.title.trim() && role.company.trim()),
    resume.education.some((item) => item.school.trim() || item.degree.trim()),
    resume.skills.some(Boolean)
  ];
  const parseScore = bounded((parseChecks.filter(Boolean).length / parseChecks.length) * 100);

  const scanChecks = [
    Boolean(profile.headline.trim()),
    summaryScore(profile.summary) >= 75,
    resume.skills.filter(Boolean).length >= 6,
    resume.skills.filter(Boolean).length <= 18,
    bullets.length >= 3,
    resume.experiences.every((role) => role.bullets.filter(Boolean).length <= 6),
    !PRONOUNS.test(profile.summary)
  ];
  const scanScore = bounded((scanChecks.filter(Boolean).length / scanChecks.length) * 100);

  const recommendations = [];
  const push = (severity, title, detail) => recommendations.push({ severity, title, detail });

  if (!profile.fullName.trim() || !profile.email.trim() || !profile.phone.trim()) push('high', 'Complete core contact information', 'Name, email, and phone should be easy for both parsers and people to identify.');
  if (!profile.headline.trim()) push('medium', 'Add a target-aligned headline', 'Use a recognizable role title or specialty immediately below your name.');
  if (summaryScore(profile.summary) < 75) push('medium', 'Tighten the professional summary', 'Aim for roughly 35–85 words focused on role fit, scope, and differentiated evidence.');
  if (bullets.length && metricCount / bullets.length < 0.35) push('high', 'Increase quantified evidence', 'Where truthful, add scale, frequency, money, time, quality, risk, volume, or percentage outcomes to more accomplishment bullets.');
  if (bullets.length && actionCount / bullets.length < 0.65) push('medium', 'Strengthen bullet openings', 'Lead most bullets with a specific action verb, then explain the scope and result.');
  if (bullets.some((bullet) => PRONOUNS.test(bullet))) push('low', 'Remove first-person pronouns from bullets', 'Resume bullets are usually stronger and more concise without I, me, my, we, or our.');
  if (resume.jobDescription.trim() && targetScore < 65) push('high', 'Improve job-language alignment', `Several high-signal concepts from the job description are not yet represented. Start with: ${missingKeywords.slice(0, 6).map((item) => item.term).join(', ') || 'review the listed requirements'}. Only add language that truthfully describes your background.`);
  if (!resume.jobDescription.trim()) push('medium', 'Add the target job description', 'Target matching stays intentionally unscored until you paste the actual posting.');
  if (resume.skills.filter(Boolean).length < 6) push('medium', 'Build a focused skills section', 'Use recognizable tools, methods, credentials, and domain skills that are relevant to the target role.');
  if (resume.skills.filter(Boolean).length > 18) push('low', 'Trim the skills list', 'A focused set is easier to scan and reduces the appearance of keyword stuffing.');
  if (!recommendations.length) push('low', 'Strong baseline', 'No major rule-based issues were found. Perform a final truthfulness, spelling, and role-specific review before submitting.');

  const effectiveTarget = resume.jobDescription.trim() ? targetScore : 50;
  const overall = bounded(parseScore * 0.25 + evidenceScore * 0.30 + effectiveTarget * 0.30 + scanScore * 0.15);

  return {
    overall,
    parseScore,
    evidenceScore,
    targetScore,
    scanScore,
    metricCount,
    actionCount,
    bulletCount: bullets.length,
    matchedKeywords,
    missingKeywords,
    requirements,
    requirementSignals: extractRequirementSignals(resume.jobDescription),
    evidenceExamples: buildEvidenceExamples(resume),
    recommendations
  };
}
