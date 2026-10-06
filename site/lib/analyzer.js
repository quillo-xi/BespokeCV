import { resumeToPlainText } from './model.js';

const STOPWORDS = new Set(`a an and are as at be been being but by can could did do does for from had has have having he her hers him his how i if in into is it its may might more most must no not of on or our ours should so than that the their theirs them then there these they this those to too up us very was we were what when where which who will with would you your yours including include includes preferred required minimum plus about across after before through using use used role work working job candidate candidates ability abilities responsibilities responsibility qualification qualifications experience experienced years year`.split(/\s+/));

const ACTION_VERBS = new Set(`achieved accelerated administered advised analyzed automated built launched coached collaborated consolidated created decreased delivered designed developed directed drove eliminated established expanded generated grew implemented improved increased led managed mentored modernized negotiated optimized orchestrated planned produced reduced redesigned resolved saved secured standardized streamlined strengthened supervised transformed upgraded validated won audited coordinated trained maintained monitored prepared supported`.split(/\s+/));

const PRONOUNS = /\b(i|me|my|mine|we|our|ours)\b/i;
const METRIC_PATTERN = /(?:\$\s?\d|\b\d+(?:\.\d+)?\s?(?:%|percent|x|k|m|b|hours?|days?|weeks?|months?|years?|users?|clients?|sites?|locations?|projects?|cases?|records?|transactions?|people|staff|employees?|leaders?|teams?|workflows?|dashboards?)(?=\s|[.,;:)]|$)|\b(?:increased|decreased|reduced|grew|saved|cut|improved|raised|lowered)\b[^.]{0,30}\b\d+)/i;

function words(text) {
  return String(text ?? '').toLowerCase().replace(/[’']/g, '').match(/[a-z][a-z0-9+#]*(?:[./-][a-z0-9+#]+)*/g) ?? [];
}

export function extractKeywords(jobDescription, limit = 24) {
  const tokens = words(jobDescription).filter((word) => !STOPWORDS.has(word) && word.length > 2);
  const counts = new Map();
  for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1);

  const phrases = words(jobDescription);
  for (let index = 0; index < phrases.length - 1; index += 1) {
    const a = phrases[index];
    const b = phrases[index + 1];
    if (a.length > 2 && b.length > 2 && !STOPWORDS.has(a) && !STOPWORDS.has(b)) {
      const phrase = `${a} ${b}`;
      counts.set(phrase, (counts.get(phrase) ?? 0) + 1.75);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, limit)
    .map(([term, weight]) => ({ term, weight }));
}

export function extractRequirements(jobDescription, limit = 10) {
  const sentences = String(jobDescription ?? '')
    .split(/(?:\n+|(?<=[.!?])\s+)/)
    .map((value) => value.trim())
    .filter(Boolean);
  const signal = /\b(required|requirements?|must|minimum|at least|certification|certified|license|licensed|degree|years? of|proficiency|expertise|preferred)\b/i;
  return sentences.filter((sentence) => signal.test(sentence)).slice(0, limit);
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
  const text = resumeToPlainText(resume).toLowerCase();
  const bullets = nonEmptyBullets(resume);
  const jobKeywords = extractKeywords(resume.jobDescription);
  const requirements = extractRequirements(resume.jobDescription);

  const matchedKeywords = jobKeywords.filter(({ term }) => text.includes(term));
  const missingKeywords = jobKeywords.filter(({ term }) => !text.includes(term));
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
  if (resume.jobDescription.trim() && targetScore < 65) push('high', 'Improve job-language alignment', `Several high-signal terms from the job description are not yet represented. Start with: ${missingKeywords.slice(0, 6).map((item) => item.term).join(', ') || 'review the listed requirements'}. Only add terms that truthfully describe your background.`);
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
    recommendations
  };
}
