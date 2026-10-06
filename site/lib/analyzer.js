import { resumeToPlainText } from './model.js';

const STOPWORDS = new Set(`a an and are as at be been being but by can could did do does for from had has have having he her hers him his how i if in into is it its may might more most must no not of on or our ours should so than that the their theirs them then there these they this those to too up us very was we were what when where which who will with would you your yours including include includes preferred required minimum plus about across after before through using use used role work working job candidate candidates ability abilities responsibilities responsibility qualification qualifications experience experienced years year all under within while any each both other related applicable assigned overall various strong high level well comfortable quickly new current provide providing performs perform position duties duty successful success`.split(/\s+/));

const NOISE_TERMS = new Set(`employment misconduct applicant applicants employer employers opportunity equal consideration conditions authorization sponsorship e-verify race color religion sex sexual gender identity national origin disability veteran accommodation anti-discrimination community workforce salary compensation benefits insurance retirement perk perks category categories application applications university uc uci activities activity`.split(/\s+/));

const GENERIC_ROLE_WORDS = new Set(`coordinator specialist analyst manager officer assistant supervisor director lead leader staff team member members role position activities activity duties duty responsibilities responsibility studies study`.split(/\s+/));

const AMBIGUOUS_SINGLE = new Set(`quality assurance data research clinical regulatory monitoring reporting compliance subject activities review skills`.split(/\s+/));

const ACTION_VERBS = new Set(`achieved accelerated administered advised analyzed automated built launched coached collaborated consolidated created decreased delivered designed developed directed drove eliminated established expanded generated grew implemented improved increased led managed mentored modernized negotiated optimized orchestrated planned produced reduced redesigned resolved saved secured standardized streamlined strengthened supervised transformed upgraded validated won audited coordinated trained maintained monitored prepared supported reviewed verified facilitated oversaw conducted assessed ensured investigated documented reconciled evaluated`.split(/\s+/));

const PRONOUNS = /\b(i|me|my|mine|we|our|ours)\b/i;
const METRIC_PATTERN = /(?:\$\s?\d|\b\d+(?:\.\d+)?\s?(?:%|percent|x|k|m|b|hours?|days?|weeks?|months?|years?|users?|clients?|sites?|locations?|projects?|cases?|records?|transactions?|people|staff|employees?|leaders?|teams?|workflows?|dashboards?)(?=\s|[.,;:)]|$)|\b(?:increased|decreased|reduced|grew|saved|cut|improved|raised|lowered)\b[^.]{0,30}\b\d+)/i;

const REQUIREMENT_SIGNAL = /\b(required|requirements?|must|minimum|at least|certification|certified|license|licensed|degree|years? of|proficiency|expertise|preferred|working knowledge|strong understanding|experience with|experience reviewing|knowledge of)\b/i;
const PREFERRED_SIGNAL = /\b(preferred|ideally|desired|a plus|nice to have)\b/i;
const BOILERPLATE_SENTENCE = /\b(equal opportunity|without regard to|conditions of employment|reasonable accommodation|work authorization|e-verify|salary range|total rewards|benefits may include|consideration for work authorization|anti-discrimination|protected veteran|sexual orientation|gender identity|pre-placement health|background check|misconduct policy)\b/i;
const HIGH_VALUE = /\b(quality|assurance|compliance|regulatory|audit|auditing|monitor|monitoring|research|clinical|trial|trials|data|capa|corrective|preventive|gcp|ich|fda|pharmacy|drug|safety|integrity|validation|risk|governance|analysis|analytics|software|communication|planning|project|operations|security|finance|engineering|leadership|stakeholder|testing|documentation|reporting|protocol|consent|adverse|microsoft|office|excel|word|powerpoint)\b/i;

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

function canonicalPhrase(tokens) {
  const clean = [...tokens];
  while (clean.length > 1 && GENERIC_ROLE_WORDS.has(clean.at(-1))) clean.pop();
  while (clean.length > 1 && STOPWORDS.has(clean[0])) clean.shift();
  while (clean.length > 1 && STOPWORDS.has(clean.at(-1))) clean.pop();
  return clean.join(' ');
}

function meaningfulToken(token) {
  return token.length > 2 && !STOPWORDS.has(token) && !NOISE_TERMS.has(token) && !GENERIC_ROLE_WORDS.has(token);
}

function phraseAllowed(tokens) {
  if (tokens.some((token) => NOISE_TERMS.has(token))) return false;
  if (!meaningfulToken(tokens[0]) || !meaningfulToken(tokens.at(-1))) return false;
  const meaningful = tokens.filter(meaningfulToken);
  return meaningful.length >= Math.min(2, tokens.length);
}

function candidateScore(term, count, requirementBoost = 0) {
  const tokenCount = words(term).length;
  const phraseBonus = tokenCount > 1 ? 2.2 + (tokenCount - 2) * 0.65 : 0;
  const domainBoost = HIGH_VALUE.test(term) ? 2.2 : 0;
  return count + phraseBonus + requirementBoost + domainBoost;
}

function significantSentenceList(jobDescription) {
  return String(jobDescription ?? '')
    .split(/(?:\n+|(?<=[.!?;])\s+)/)
    .map((value) => value.replace(/^[-•*]\s*/, '').trim())
    .filter((value) => value && !BOILERPLATE_SENTENCE.test(value));
}

export function extractKeywords(jobDescription, limit = 24) {
  const candidates = new Map();
  const add = (term, rawWeight, requirementBoost = 0) => {
    const normalized = canonicalPhrase(words(term));
    if (!normalized || NOISE_TERMS.has(normalized) || BOILERPLATE_SENTENCE.test(normalized)) return;
    const tokenCount = words(normalized).length;
    if (tokenCount === 1 && !meaningfulToken(normalized)) return;
    const current = candidates.get(normalized) ?? { count: 0, boost: 0 };
    current.count += rawWeight;
    current.boost = Math.max(current.boost, requirementBoost);
    candidates.set(normalized, current);
  };

  for (const sentence of significantSentenceList(jobDescription)) {
    const tokens = words(sentence);
    const requirementBoost = REQUIREMENT_SIGNAL.test(sentence) ? 2.4 : 0;

    for (const token of tokens) {
      if (meaningfulToken(token)) add(token, 1, requirementBoost * 0.35);
    }

    for (let size = 2; size <= 4; size += 1) {
      for (let index = 0; index <= tokens.length - size; index += 1) {
        const slice = tokens.slice(index, index + size);
        if (!phraseAllowed(slice)) continue;
        add(slice.join(' '), 1, requirementBoost);
      }
    }
  }

  let ranked = [...candidates.entries()]
    .map(([term, meta]) => ({ term, weight: candidateScore(term, meta.count, meta.boost), count: meta.count }))
    .filter((item) => {
      const tokenCount = words(item.term).length;
      if (tokenCount > 1) return true;
      return item.count >= 2 || HIGH_VALUE.test(item.term);
    })
    .sort((a, b) => b.weight - a.weight || words(b.term).length - words(a.term).length || b.term.length - a.term.length);

  const phraseTerms = ranked.filter((item) => words(item.term).length > 1);
  ranked = ranked.filter((item) => {
    if (words(item.term).length > 1) return true;
    const containingPhrase = phraseTerms.find((phrase) => words(phrase.term).includes(item.term));
    if (!containingPhrase) return true;
    if (AMBIGUOUS_SINGLE.has(item.term)) return false;
    return item.count >= 2;
  });

  const selected = [];
  for (const item of ranked) {
    if (selected.some((existing) => existing.term === item.term)) continue;
    const nestedIndex = selected.findIndex((existing) => {
      const existingTerm = ` ${existing.term} `;
      const candidateTerm = ` ${item.term} `;
      return existingTerm.includes(candidateTerm) || candidateTerm.includes(existingTerm);
    });

    if (nestedIndex >= 0) {
      const existing = selected[nestedIndex];
      const existingTokens = words(existing.term).length;
      const itemTokens = words(item.term).length;

      if (itemTokens === 1 && !AMBIGUOUS_SINGLE.has(item.term) && item.count >= 2) {
        selected.push(item);
        if (selected.length >= limit) break;
        continue;
      }

      if (itemTokens >= 2 && itemTokens < existingTokens && item.count >= existing.count * 0.9) {
        selected[nestedIndex] = item;
        continue;
      }

      if (item.weight > existing.weight * 1.28 && itemTokens >= existingTokens) selected[nestedIndex] = item;
      continue;
    }

    selected.push(item);
    if (selected.length >= limit) break;
  }

  return selected.map(({ term, weight }) => ({ term, weight }));
}

export function extractRequirementSignals(jobDescription, limit = 18) {
  const results = [];
  for (const sentence of significantSentenceList(jobDescription)) {
    if (!REQUIREMENT_SIGNAL.test(sentence)) continue;
    const type = PREFERRED_SIGNAL.test(sentence) ? 'preferred' : 'required';
    if (results.some((item) => item.text.toLowerCase() === sentence.toLowerCase())) continue;
    results.push({ text: sentence, type });
    if (results.length >= limit) break;
  }
  return results;
}

export function extractRequirements(jobDescription, limit = 10) {
  return extractRequirementSignals(jobDescription, limit).map((item) => item.text);
}

function normalizedStems(text) {
  return words(text).filter((word) => !STOPWORDS.has(word) && !NOISE_TERMS.has(word)).map(stem);
}

export function textSupportsTerm(text, term) {
  const haystack = normalizedStems(text);
  const needle = normalizedStems(term);
  if (!needle.length) return false;
  if (needle.length === 1) return haystack.includes(needle[0]);
  for (let index = 0; index <= haystack.length - needle.length; index += 1) {
    if (needle.every((token, offset) => haystack[index + offset] === token)) return true;
  }
  return false;
}

function bounded(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function nonEmptyBullets(resume) {
  return resume.experiences.flatMap((role) => role.bullets ?? []).map((bullet) => bullet.trim()).filter(Boolean);
}

function startsWithActionVerb(bullet) {
  const first = words(bullet)[0];
  return Boolean(first && ACTION_VERBS.has(first));
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
  const jobKeywords = extractKeywords(resume.jobDescription);
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
    recommendations
  };
}
