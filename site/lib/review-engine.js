const ACTION_BASE = new Set(`achieve accelerate administer advise analyze automate build coach collaborate collect communicate compound configure conduct consolidate coordinate create deliver design develop direct dispense document draft drive establish evaluate expand facilitate fill generate handle implement improve increase install investigate lead maintain manage mentor modernize monitor negotiate operate optimize organize orchestrate oversee perform plan prepare present process produce provide reconcile redesign reduce repair research resolve review safeguard save schedule secure standardize streamline strengthen supervise support test track train transform troubleshoot upgrade utilize validate verify win access answer assist assess audit calculate ensure help inventory`.split(/\s+/));

const IRREGULAR_PAST = new Set(`built drove led oversaw won grew cut ran made wrote taught sold bought brought found held kept left met paid read sent set spoke took`.split(/\s+/));
const FREQUENCY_PATTERN = /\b(?:daily|weekly|biweekly|monthly|quarterly|annually|annual|yearly|per\s+(?:shift|day|week|month|quarter|year)|each\s+(?:shift|day|week|month|quarter|year))\b/i;
const NUMBER_SCOPE_PATTERN = /(?:\$\s?\d|\b\d+(?:\.\d+)?\s?(?:%|percent|x|k|m|b|hours?|days?|weeks?|months?|years?|users?|clients?|sites?|locations?|projects?|cases?|records?|transactions?|people|staff|employees?|leaders?|teams?|workflows?|dashboards?|systems?|tools?|programs?|patients?|orders?|prescriptions?|preparations?|audits?|reviews?|reports?|assets?|items?|departments?|regions?|states?|facilities?)(?=\s|[.,;:)]|$))/i;
const BREADTH_PATTERN = /\b(?:enterprise[- ]wide|organization[- ]wide|company[- ]wide|department[- ]wide|regional|national|multi[- ]site|cross[- ]functional|multidisciplinary|portfolio|across\s+(?:the\s+)?(?:team|department|organization|company|region|sites?|locations?|functions?))\b/i;
const OUTCOME_PATTERN = /\b(?:achiev(?:ed|ing|ement|ements)|accelerat(?:ed|ing)|decreas(?:ed|ing)|deliver(?:ed|ing)|eliminat(?:ed|ing)|expand(?:ed|ing|sion)|generat(?:ed|ing)|grew|improv(?:ed|ing|ement|ements)|increas(?:ed|ing)|lower(?:ed|ing)|optimiz(?:ed|ing|ation)|prevent(?:ed|ing)|reduc(?:ed|ing|tion)|resolv(?:ed|ing)|sav(?:ed|ing|ings)|streamlin(?:ed|ing)|strengthen(?:ed|ing)|transform(?:ed|ing)|upgrad(?:ed|ing)|result(?:ed|ing)\s+in|led\s+to|enabled|enhanced|maintained\s+(?:compliance|readiness|availability)|met\s+(?:deadline|target|goal)|on[- ]time|within\s+(?:budget|deadline))\b/i;
const STANDARD_PATTERN = /\b(?:USP\s*<?\d+>?|ISO\s*\d+|FDA|GCP|ICH|OSHA|HIPAA|SOX|GAAP|GMP|cGMP|SOPs?|standard operating procedures?|policy|policies|regulation|regulations|regulatory|protocol|protocols|accreditation|audit criteria|quality standard)\b/i;
const TOOL_PATTERN = /\b(?:SQL|Excel|Tableau|Power BI|Python|RIVA|EXACTAMIX|Simplifi\s*797|CPR\+|Salesforce|SAP|Epic|Workday|Jira|ServiceNow|GitHub|Azure|AWS|software|platform|system|systems|database|dashboard|report writer|automation)\b/i;
const OWNERSHIP_PATTERN = /\b(?:led|lead|managed|manage|owned|owner|oversaw|supervised|supervise|directed|coordinated|coordinate|administered|administer|accountab(?:le|ility)|primary|project lead|team lead|chief|nco|commander|responsible for)\b/i;
const COMPLEXITY_PATTERN = /\b(?:hazardous|chemotherapy|investigational|sterile|controlled|sensitive|high[- ]risk|critical|regulated|compliance|patient safety|quality assurance|audit|emergency|confidential|protected|complex|multi[- ]disciplinary|cross[- ]functional)\b/i;
const AUDIENCE_PATTERN = /\b(?:leadership|executives?|senior leaders?|stakeholders?|customers?|clients?|patients?|prescribers?|pharmacists?|clinicians?|providers?|vendors?|regulators?|auditors?|cross[- ]functional teams?|multidisciplinary teams?|staff|employees?|soldiers?|students?)\b/i;
const VAGUE_PATTERN = /\b(?:responsible for|helped with|worked on|involved in|various|miscellaneous|other duties|as needed|assisted with|tasked with|duties included)\b/i;
const FIRST_PERSON = /\b(?:i|me|my|mine|we|our|ours)\b/i;
const CLICHE_PATTERN = /\b(?:results[- ]driven|hardworking|hard[- ]working|self[- ]starter|team player|go[- ]getter|dynamic professional|detail[- ]oriented professional|excellent communication skills|works well under pressure|fast learner)\b/i;

function words(text) {
  return String(text ?? '').toLowerCase().replace(/[’']/g, '').match(/[a-z][a-z0-9+#]*(?:[./-][a-z0-9+#]+)*/g) ?? [];
}

function firstActionToken(text) {
  const value = String(text ?? '').trim();
  const labeled = value.match(/^[^;:]{1,36}[;:]\s*(.+)$/);
  const tokens = words(labeled ? labeled[1] : value);
  return tokens[0] ?? '';
}

function baseVerb(token) {
  const value = String(token ?? '').toLowerCase();
  if (!value) return '';
  if (ACTION_BASE.has(value)) return value;
  if (IRREGULAR_PAST.has(value)) return value;

  const candidates = [];
  if (value.endsWith('ies') && value.length > 4) candidates.push(`${value.slice(0, -3)}y`);
  if (value.endsWith('ied') && value.length > 4) candidates.push(`${value.slice(0, -3)}y`);
  if (value.endsWith('ing') && value.length > 5) {
    candidates.push(value.slice(0, -3));
    candidates.push(`${value.slice(0, -3)}e`);
  }
  if (value.endsWith('ed') && value.length > 4) {
    candidates.push(value.slice(0, -2));
    candidates.push(value.slice(0, -1));
  }
  if (value.endsWith('es') && value.length > 4) candidates.push(value.slice(0, -2));
  if (value.endsWith('s') && value.length > 3) candidates.push(value.slice(0, -1));
  return candidates.find((candidate) => ACTION_BASE.has(candidate)) ?? '';
}

function actionOpening(text) {
  return Boolean(baseVerb(firstActionToken(text)));
}

function tenseOfAction(text) {
  const token = firstActionToken(text);
  if (!token || !baseVerb(token)) return 'unknown';
  if (IRREGULAR_PAST.has(token) || /ed$/.test(token)) return 'past';
  return 'present';
}

function signal(type, label, detail) {
  return { type, label, detail };
}

function evidenceSignals(text) {
  const value = String(text ?? '');
  const signals = [];
  if (NUMBER_SCOPE_PATTERN.test(value)) signals.push(signal('scale', 'Scale / quantity', 'Includes a concrete count, amount, percentage, duration, or portfolio size.'));
  else if (BREADTH_PATTERN.test(value)) signals.push(signal('scope', 'Scope / breadth', 'Shows organizational, geographic, or cross-functional breadth.'));
  if (FREQUENCY_PATTERN.test(value)) signals.push(signal('frequency', 'Frequency', 'Shows how often the work occurred.'));
  if (OUTCOME_PATTERN.test(value)) signals.push(signal('outcome', 'Result / outcome', 'Shows what changed or what the work achieved.'));
  if (STANDARD_PATTERN.test(value)) signals.push(signal('standard', 'Standard / rule', 'Names a governing standard, policy, protocol, or regulatory context.'));
  if (TOOL_PATTERN.test(value)) signals.push(signal('tool', 'Tool / system', 'Names a recognizable tool, platform, system, or method.'));
  if (OWNERSHIP_PATTERN.test(value)) signals.push(signal('ownership', 'Ownership / leadership', 'Shows ownership, leadership, coordination, or accountability.'));
  if (COMPLEXITY_PATTERN.test(value)) signals.push(signal('complexity', 'Complexity / risk', 'Shows specialized, regulated, high-risk, or sensitive work.'));
  if (AUDIENCE_PATTERN.test(value)) signals.push(signal('audience', 'Audience / collaboration', 'Shows who the work served, influenced, or coordinated with.'));
  return signals;
}

function evidenceScore(text, signals, hasAction) {
  let score = hasAction ? 16 : 0;
  const types = new Set(signals.map((item) => item.type));
  if (types.has('scale')) score += 16;
  if (types.has('scope')) score += 12;
  if (types.has('frequency')) score += 10;
  if (types.has('outcome')) score += 20;
  if (types.has('standard')) score += 10;
  if (types.has('tool')) score += 8;
  if (types.has('ownership')) score += 12;
  if (types.has('complexity')) score += 10;
  if (types.has('audience')) score += 6;

  const length = words(text).length;
  if (length >= 7 && length <= 34) score += 6;
  else if (length >= 5 && length <= 42) score += 3;

  return Math.min(100, score);
}

function nextQuestions(text, signals) {
  const types = new Set(signals.map((item) => item.type));
  const value = String(text ?? '').toLowerCase();
  const questions = [];

  if (!types.has('scope') && !types.has('scale') && !types.has('frequency')) {
    if (/train|teach|coach|educat|onboard/.test(value)) questions.push('How many people, sessions, teams, or locations did this cover, and how often?');
    else if (/audit|review|monitor|inspect|test|quality|compliance/.test(value)) questions.push('What was the review volume, site count, record count, or cadence?');
    else if (/prepare|compound|fill|dispens|prescription|order/.test(value)) questions.push('What volume or frequency best describes this work per shift, day, or week?');
    else if (/manage|lead|supervis|coordinate|project|team/.test(value)) questions.push('What team size, project count, site count, budget, or cadence shows the scope?');
    else questions.push('What scale, frequency, volume, portfolio size, or breadth would help a reader understand this work?');
  }

  if (!types.has('outcome')) {
    if (/support|assist|help|coordinate|manage|lead|improv|process|workflow/.test(value)) questions.push('What changed because of this work—speed, quality, reliability, adoption, readiness, cost, or risk?');
    else questions.push('What result, decision, service outcome, quality effect, or purpose came from this work?');
  }

  if (!types.has('standard') && /quality|compliance|audit|sterile|clinical|safety|regulated|procedure|policy/.test(value)) {
    questions.push('Was there a policy, protocol, regulation, accreditation rule, or standard that would make the context clearer?');
  }

  return questions.slice(0, 2);
}

export function assessBullet(text, options = {}) {
  const value = String(text ?? '').trim();
  const signals = evidenceSignals(value);
  const hasAction = actionOpening(value);
  const score = evidenceScore(value, signals, hasAction);
  const tokenCount = words(value).length;
  const concerns = [];

  if (!hasAction) concerns.push('weak-opening');
  if (VAGUE_PATTERN.test(value)) concerns.push('vague-language');
  if (FIRST_PERSON.test(value)) concerns.push('first-person');
  if (tokenCount > 42) concerns.push('long');
  if (tokenCount > 0 && tokenCount < 5) concerns.push('thin');

  const tense = tenseOfAction(value);
  if (options.currentRole === false && tense === 'present') concerns.push('past-role-present-tense');

  return {
    text: value,
    actionOpening: hasAction,
    actionVerb: firstActionToken(value),
    tense,
    signals,
    signalTypes: signals.map((item) => item.type),
    evidenceScore: score,
    level: score >= 58 ? 'strong' : score >= 36 ? 'solid' : 'thin',
    meaningfulEvidence: signals.length >= 2 || signals.some((item) => ['scale','scope','outcome','standard','complexity','ownership'].includes(item.type)),
    measurable: signals.some((item) => ['scale','frequency'].includes(item.type)),
    concerns,
    questions: nextQuestions(value, signals)
  };
}

function safeRewrite(text) {
  const original = String(text ?? '').trim();
  if (!original) return '';

  let match = original.match(/^responsible\s+for\s+(?:the\s+)?accountability\s+and\s+safeguarding\s+of\s+(.+)/i);
  if (match) return `Safeguarded and maintained accountability for ${match[1].replace(/[.]+$/, '')}.`;

  match = original.match(/^provide\s+(?:full[- ]time\s+)?support\s+to\s+develop\s+and\s+administer\s+(.+?)(?:,?\s+and\s+provide\s+(.+))?\.?$/i);
  if (match) {
    const primary = match[1].replace(/[.,;]+$/, '');
    const secondary = match[2]?.replace(/[.]+$/, '');
    return secondary
      ? `Supported the development and administration of ${primary} and provided ${secondary}.`
      : `Supported the development and administration of ${primary}.`;
  }

  match = original.match(/^project\s+lead\s*[;:—-]\s*managed\s+(.+?)\s+(?:which\s+)?led\s+to\s+(.+)/i);
  if (match) return `Led ${match[1].replace(/[;,]+$/, '')} as project lead, resulting in ${match[2].replace(/[.]+$/, '')}.`;

  match = original.match(/^assist(?:ed|s)?\s+(?:the\s+)?(.+)/i);
  if (match) return `Supported ${match[1].replace(/[.]+$/, '')}.`;

  match = original.match(/^help(?:ed|s)?\s+(.+)/i);
  if (match) return `Supported ${match[1].replace(/[.]+$/, '')}.`;

  return '';
}

function normalizedContentWords(text) {
  return new Set(words(text).filter((word) => word.length > 3 && !['with','from','that','this','were','have','into','including','using'].includes(word)));
}

function similarity(a, b) {
  const left = normalizedContentWords(a);
  const right = normalizedContentWords(b);
  if (!left.size || !right.size) return 0;
  const intersection = [...left].filter((word) => right.has(word)).length;
  const union = new Set([...left, ...right]).size;
  return union ? intersection / union : 0;
}

function parseYear(value) {
  const years = String(value ?? '').match(/(?:19|20)\d{2}/g);
  return years?.length ? Number(years.at(-1)) : null;
}

function buildConsistencyIssues(resume, records) {
  const issues = [];

  resume.experiences.forEach((role, roleIndex) => {
    const startYear = parseYear(role.start);
    const endYear = parseYear(role.end);
    if (role.current && role.end?.trim() && !/^present$/i.test(role.end.trim())) {
      issues.push({ severity: 'medium', kind: 'date', roleIndex, title: 'Current role has an end date', detail: `${role.title || 'This role'} is marked current but also has an end date. Keep one convention.` });
    }
    if (!role.current && /^present$/i.test(role.end?.trim() ?? '')) {
      issues.push({ severity: 'medium', kind: 'date', roleIndex, title: 'Past role ends in Present', detail: `${role.title || 'This role'} is not marked current but its end date says Present.` });
    }
    if (startYear && endYear && endYear < startYear) {
      issues.push({ severity: 'high', kind: 'date', roleIndex, title: 'Date order needs review', detail: `${role.title || 'This role'} ends before it starts based on the entered years.` });
    }

    if (!role.current) {
      const presentTense = records.filter((item) => item.roleIndex === roleIndex && item.assessment.concerns.includes('past-role-present-tense'));
      if (presentTense.length >= 2) {
        issues.push({ severity: 'low', kind: 'tense', roleIndex, title: 'Past-role tense is inconsistent', detail: `${presentTense.length} bullets in ${role.title || 'this past role'} begin in present tense. Past tense usually scans more consistently for finished roles.` });
      }
    }
  });

  const openerCounts = new Map();
  for (const item of records) {
    const opener = baseVerb(item.assessment.actionVerb);
    if (!opener) continue;
    openerCounts.set(opener, (openerCounts.get(opener) ?? 0) + 1);
  }
  const repeated = [...openerCounts.entries()].sort((a,b) => b[1]-a[1]).find(([,count]) => count >= 4 && count / Math.max(records.length,1) >= 0.22);
  if (repeated) {
    issues.push({ severity: 'low', kind: 'repetition', title: 'Repeated bullet openings', detail: `“${repeated[0]}” opens ${repeated[1]} bullets. Vary the lead verb when the work is genuinely different.` });
  }

  outer: for (let i=0;i<records.length;i+=1) {
    for (let j=i+1;j<records.length;j+=1) {
      if (similarity(records[i].bullet, records[j].bullet) >= 0.78) {
        issues.push({ severity: 'medium', kind: 'duplicate', title: 'Two bullets are very similar', detail: `Review “${records[i].roleLabel}” and “${records[j].roleLabel}” for duplicated content; keep the version that best shows distinct value.` });
        break outer;
      }
    }
  }

  const skills = (resume.skills ?? []).map((item) => String(item ?? '').trim()).filter(Boolean);
  const seenSkills = new Set();
  const duplicateSkills = new Set();
  for (const skill of skills) {
    const key = skill.toLowerCase().replace(/[^a-z0-9+#]/g,'');
    if (seenSkills.has(key)) duplicateSkills.add(skill);
    seenSkills.add(key);
  }
  if (duplicateSkills.size) {
    issues.push({ severity: 'low', kind: 'skills', title: 'Duplicate skills', detail: `Remove repeated skill entries: ${[...duplicateSkills].join(', ')}.` });
  }

  if (CLICHE_PATTERN.test(resume.profile?.summary ?? '')) {
    issues.push({ severity: 'low', kind: 'summary', title: 'Summary uses generic self-description', detail: 'Replace broad labels such as “results-driven” or “team player” with role, scope, specialty, or concrete evidence.' });
  }

  return issues;
}

function strengthSummary(records) {
  const strong = records.filter((item) => item.assessment.level === 'strong');
  const solid = records.filter((item) => item.assessment.level === 'solid');
  const signals = new Map();
  for (const item of records) {
    for (const signal of item.assessment.signals) signals.set(signal.label, (signals.get(signal.label) ?? 0) + 1);
  }
  const topSignals = [...signals.entries()].sort((a,b) => b[1]-a[1]).slice(0,3);
  const strengths = [];
  if (strong.length) strengths.push(`${strong.length} bullet${strong.length===1?'':'s'} already show strong evidence and context.`);
  else if (solid.length) strengths.push(`${solid.length} bullet${solid.length===1?'':'s'} have a solid foundation to build on.`);
  if (topSignals.length) strengths.push(`Most visible evidence types: ${topSignals.map(([label,count]) => `${label.toLowerCase()} (${count})`).join(', ')}.`);
  return strengths;
}

export function analyzeResumeQuality(resume) {
  const records = (resume.experiences ?? []).flatMap((role, roleIndex) =>
    (role.bullets ?? []).map((bullet, bulletIndex) => {
      const assessment = assessBullet(bullet, { currentRole: Boolean(role.current) });
      return {
        roleIndex,
        bulletIndex,
        roleLabel: [role.title, role.company].filter(Boolean).join(' — ') || `Position ${roleIndex + 1}`,
        bullet: String(bullet ?? '').trim(),
        assessment
      };
    })
  ).filter((item) => item.bullet);

  const total = records.length;
  const count = (fn) => records.filter(fn).length;
  const averageEvidence = total ? Math.round(records.reduce((sum,item) => sum + item.assessment.evidenceScore,0) / total) : 0;
  const consistencyIssues = buildConsistencyIssues(resume, records);

  const signalCounts = {
    meaningfulEvidence: count((item) => item.assessment.meaningfulEvidence),
    measurable: count((item) => item.assessment.measurable),
    outcomes: count((item) => item.assessment.signalTypes.includes('outcome')),
    scope: count((item) => item.assessment.signalTypes.some((type) => ['scale','scope','frequency'].includes(type))),
    standards: count((item) => item.assessment.signalTypes.includes('standard')),
    tools: count((item) => item.assessment.signalTypes.includes('tool')),
    ownership: count((item) => item.assessment.signalTypes.includes('ownership')),
    complexity: count((item) => item.assessment.signalTypes.includes('complexity')),
    actionOpenings: count((item) => item.assessment.actionOpening),
    strong: count((item) => item.assessment.level === 'strong'),
    thin: count((item) => item.assessment.level === 'thin')
  };

  const opportunities = [];
  if (total && signalCounts.meaningfulEvidence / total < 0.55) opportunities.push({ severity: 'high', title: 'Add more context to task-only bullets', detail: 'Several bullets say what you did but not enough about scope, complexity, standards, ownership, audience, or outcome.' });
  if (total && signalCounts.outcomes / total < 0.25) opportunities.push({ severity: 'medium', title: 'Show more outcomes where they exist', detail: 'Not every bullet needs a metric, but more bullets can explain what changed, what the work enabled, or why it mattered.' });
  if (total && signalCounts.actionOpenings / total < 0.75) opportunities.push({ severity: 'medium', title: 'Make bullet openings more direct', detail: 'Lead most bullets with the work itself instead of “responsible for,” role labels, or indirect phrasing.' });
  if (consistencyIssues.some((item) => item.severity === 'high' || item.severity === 'medium')) opportunities.push({ severity: 'medium', title: 'Resolve consistency issues', detail: 'Dates, duplicate content, or role-level consistency need a quick pass before submission.' });

  return {
    total,
    averageEvidence,
    records,
    signalCounts,
    consistencyIssues,
    strengths: strengthSummary(records),
    opportunities
  };
}

function coachingExample(record) {
  const { bullet, assessment } = record;
  const rewrite = safeRewrite(bullet);

  if (rewrite && rewrite !== bullet) {
    return {
      ...record,
      kind: 'rewrite',
      title: assessment.meaningfulEvidence ? 'Make the evidence easier to see' : 'Make the action easier to see',
      before: bullet,
      after: rewrite,
      criteria: assessment.signals.map((item) => item.label),
      questions: assessment.questions,
      note: 'This rewrite changes presentation, not the underlying facts.'
    };
  }

  if (assessment.level === 'strong') {
    return {
      ...record,
      kind: 'model',
      title: 'Use this as a model',
      before: bullet,
      after: bullet,
      criteria: assessment.signals.map((item) => item.label),
      questions: [],
      note: 'This bullet already combines a clear action with meaningful context or evidence.'
    };
  }

  return {
    ...record,
    kind: 'develop',
    title: 'Build this bullet with one more useful detail',
    before: bullet,
    after: bullet,
    criteria: assessment.signals.map((item) => item.label),
    questions: assessment.questions,
    note: assessment.meaningfulEvidence
      ? 'The foundation is useful; one more result or scope detail could make it more persuasive.'
      : 'Add context that helps the reader understand scale, complexity, ownership, standards, audience, or outcome.'
  };
}

export function buildEvidenceExamples(resume, limit = 4) {
  const quality = analyzeResumeQuality(resume);
  if (!quality.records.length) return [];

  const selected = [];
  const used = new Set();
  const add = (record) => {
    const key = `${record.roleIndex}:${record.bulletIndex}`;
    if (used.has(key)) return;
    used.add(key);
    selected.push(coachingExample(record));
  };

  const safeRewriteRecord = quality.records.find((item) => safeRewrite(item.bullet));
  if (safeRewriteRecord) add(safeRewriteRecord);

  const thin = quality.records
    .filter((item) => item.assessment.level === 'thin')
    .sort((a,b) => a.assessment.evidenceScore - b.assessment.evidenceScore);
  if (thin[0]) add(thin[0]);

  const solid = quality.records
    .filter((item) => item.assessment.level === 'solid')
    .sort((a,b) => a.assessment.evidenceScore - b.assessment.evidenceScore);
  if (solid[0]) add(solid[0]);

  const strong = quality.records
    .filter((item) => item.assessment.level === 'strong')
    .sort((a,b) => b.assessment.evidenceScore - a.assessment.evidenceScore);
  if (strong[0]) add(strong[0]);

  for (const record of [...thin, ...solid, ...strong]) {
    if (selected.length >= limit) break;
    add(record);
  }

  return selected.slice(0, limit);
}
