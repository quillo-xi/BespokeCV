import { extractKeywords, extractRequirementSignals, textSupportsTerm } from './analyzer.js';
import { resumeToPlainText } from './model.js';

function listJoin(items) {
  const values = items.filter(Boolean);
  if (values.length <= 1) return values[0] ?? '';
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(', ')}, and ${values.at(-1)}`;
}

function inferTargetTitle(resume) {
  if (resume.jobSourceTitle?.trim()) return resume.jobSourceTitle.trim();
  const lines = String(resume.jobDescription ?? '').split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const candidate = lines.find((line) =>
    line.length >= 4 &&
    line.length <= 90 &&
    !/[.!?]$/.test(line) &&
    !/^(required|preferred|responsibilities|qualifications|job description|about|who we are|what it takes)/i.test(line)
  );
  return candidate ?? 'Target role';
}

function evidenceEntries(resume) {
  const entries = [];
  const add = (kind, label, text) => {
    const value = String(text ?? '').trim();
    if (value) entries.push({ kind, label, text: value });
  };

  add('headline', 'Professional headline', resume.profile.headline);
  add('summary', 'Professional summary', resume.profile.summary);
  for (const skill of resume.skills) add('skill', 'Skills', skill);
  resume.experiences.forEach((role) => {
    const roleLabel = [role.title, role.company].filter(Boolean).join(' — ') || 'Work experience';
    add('role', roleLabel, [role.title, role.company, role.location].filter(Boolean).join(' '));
    role.bullets.forEach((bullet) => add('bullet', roleLabel, bullet));
  });
  resume.education.forEach((item) => add('education', item.school || 'Education', [item.degree, item.school].filter(Boolean).join(' ')));
  resume.certifications.forEach((item) => add('certification', 'Certification', item));
  return entries;
}

function evidenceForTerm(entries, term) {
  return entries.filter((entry) => textSupportsTerm(entry.text, term)).slice(0, 3);
}

function requirementStatus(resume, entries, requirement) {
  const keyTerms = extractKeywords(requirement.text, 6);
  const supported = keyTerms.filter((item) => evidenceForTerm(entries, item.term).length);
  const ratio = keyTerms.length ? supported.length / keyTerms.length : 0;
  const text = requirement.text.toLowerCase();

  if (/bachelor|b\.a\.|b\.s\.|degree/.test(text)) {
    const educationText = resume.education.map((item) => item.degree).join(' ');
    const degreeMatch = /bachelor|b\.a\.|b\.s\./i.test(educationText);
    if (degreeMatch) return { status: 'supported', keyTerms, supported };
    if (/equivalent experience/.test(text) && resume.experiences.some((role) => role.title || role.company)) {
      return { status: 'review', keyTerms, supported };
    }
  }

  if (/\b\d+\s*[-–—]\s*\d+\s+years?|at least\s+\d+\s+years?|\d+\+?\s+years?/.test(text)) {
    return { status: supported.length ? 'review' : 'review', keyTerms, supported };
  }

  if (ratio >= 0.5 || supported.length >= 2) return { status: 'supported', keyTerms, supported };
  if (supported.length) return { status: 'review', keyTerms, supported };
  return { status: 'gap', keyTerms, supported };
}

function coachingExample(text) {
  const value = text.toLowerCase();
  if (/capa|corrective|preventive/.test(value)) {
    return 'If accurate, add evidence such as: “Tracked corrective and preventive actions from finding through implementation and effectiveness verification across [scope].”';
  }
  if (/audit|auditing|monitor/.test(value)) {
    return 'If accurate, add evidence such as: “Audited/monitored [process, study, or program] against [standard], documented findings, and followed corrective actions through closure.”';
  }
  if (/gcp|ich|clinical research|clinical trial/.test(value)) {
    return 'If accurate, specify direct clinical-research, GCP/ICH, protocol, informed-consent, or trial-monitoring experience and the scope in which it was applied.';
  }
  if (/regulatory|compliance|federal regulation|policy/.test(value)) {
    return 'If accurate, identify the governing standard or regulation, what you reviewed for compliance, the scale, and the result of the review.';
  }
  if (/data|reporting|documentation/.test(value)) {
    return 'If accurate, add a bullet showing what data or documentation you reviewed, how accuracy/timeliness was verified, and what action followed.';
  }
  if (/certif|socra|acrp/.test(value)) {
    return 'List the exact credential and issuing organization only if held. If it is preferred rather than required, leave it as a visible gap instead of implying certification.';
  }
  if (/bachelor|degree|years?/.test(value)) {
    return 'Clarify the exact education and length/scope of equivalent experience. Do not convert experience into a degree or invent a duration.';
  }
  if (/communication|presentation|interpersonal|relationship/.test(value)) {
    return 'If accurate, show the audiences involved, the communication responsibility, and a result—for example audit coordination, training, escalation, or cross-functional resolution.';
  }
  return 'If this requirement is genuinely part of your background, add a concrete accomplishment showing the action, scope, standard/tool, and result. Otherwise leave it identified as a gap.';
}

function bulletRelevance(bullet, targetTerms) {
  return targetTerms.reduce((score, item) => score + (textSupportsTerm(bullet, item.term) ? item.weight : 0), 0);
}

function personalizedSummary(resume, targetTitle, supportedTerms) {
  const identity = resume.profile.headline?.trim() || resume.experiences.find((role) => role.title?.trim())?.title?.trim() || 'Experienced professional';
  const terms = supportedTerms.slice(0, 5).map((item) => item.term);
  const firstSentence = resume.profile.summary?.trim().split(/(?<=[.!?])\s+/)[0]?.trim() || '';
  const target = targetTitle && targetTitle !== 'Target role' ? ` targeting ${targetTitle}` : '';
  const evidence = terms.length ? `, bringing documented experience in ${listJoin(terms)}` : '';
  const lead = `${identity}${target}${evidence}.`;
  if (!firstSentence || firstSentence.toLowerCase() === lead.toLowerCase()) return lead;
  return `${lead} ${firstSentence}`;
}

function idealSummary(targetTitle, targetTerms, requirements) {
  const terms = targetTerms.slice(0, 6).map((item) => item.term);
  const requiredCount = requirements.filter((item) => item.type === 'required').length;
  const role = targetTitle && targetTitle !== 'Target role' ? targetTitle : 'Target-role professional';
  const capability = terms.length ? ` with demonstrated capability in ${listJoin(terms)}` : '';
  const requirementNote = requiredCount ? ` and evidence addressing the posting’s ${requiredCount} identified required qualification${requiredCount === 1 ? '' : 's'}` : '';
  return `${role}${capability}${requirementNote}. Presents concise, measurable accomplishments that connect responsibilities to scope, standards, and outcomes.`;
}

export function buildOptimizedDraft(resume) {
  const targetTitle = inferTargetTitle(resume);
  const company = resume.jobSourceCompany?.trim() || '';
  const targetTerms = extractKeywords(resume.jobDescription, 28);
  const requirements = extractRequirementSignals(resume.jobDescription, 24);
  const entries = evidenceEntries(resume);
  const resumeText = resumeToPlainText(resume);

  const supportedTerms = targetTerms.filter((item) => textSupportsTerm(resumeText, item.term));
  const missingTerms = targetTerms.filter((item) => !textSupportsTerm(resumeText, item.term));

  const requirementReview = requirements.map((requirement) => {
    const review = requirementStatus(resume, entries, requirement);
    const evidence = review.supported.flatMap((item) => evidenceForTerm(entries, item.term)).slice(0, 3);
    return {
      ...requirement,
      status: review.status,
      evidence,
      comment: review.status === 'supported'
        ? 'Evidence was found in the imported/entered resume. Verify that the wording and level of responsibility are accurate before using it.'
        : coachingExample(requirement.text)
    };
  });

  const prioritizedSkills = [...resume.skills]
    .filter(Boolean)
    .map((skill, index) => ({
      skill,
      index,
      score: targetTerms.reduce((sum, item) => sum + (textSupportsTerm(skill, item.term) ? item.weight : 0), 0)
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((item) => item.skill);

  const suggestedSkills = supportedTerms
    .filter((item) => !resume.skills.some((skill) => textSupportsTerm(skill, item.term)))
    .slice(0, 8)
    .map((item) => item.term);

  const experiences = resume.experiences.map((role) => ({
    ...role,
    bullets: role.bullets
      .map((bullet, index) => ({ bullet, index, score: bulletRelevance(bullet, targetTerms) }))
      .filter((item) => item.bullet?.trim())
      .sort((a, b) => b.score - a.score || a.index - b.index)
  }));

  const idealBullets = targetTerms.slice(0, 5).map((item) =>
    `Demonstrated ${item.term} across [relevant scope], applying [standard/tool/process] and documenting a measurable result or risk/quality outcome.`
  );

  const unsupportedRequired = requirementReview.filter((item) => item.type === 'required' && item.status !== 'supported');
  const unsupportedPreferred = requirementReview.filter((item) => item.type === 'preferred' && item.status !== 'supported');

  return {
    targetTitle,
    company,
    targetTerms,
    supportedTerms,
    missingTerms,
    requirements: requirementReview,
    idealReference: {
      headline: targetTitle,
      summary: idealSummary(targetTitle, targetTerms, requirements),
      capabilities: targetTerms.slice(0, 14).map((item) => item.term),
      bullets: idealBullets
    },
    personalized: {
      headline: targetTitle && targetTitle !== 'Target role' ? `Target: ${targetTitle}` : (resume.profile.headline || 'Target-role professional'),
      summary: personalizedSummary(resume, targetTitle, supportedTerms),
      skills: prioritizedSkills,
      suggestedSkills,
      experiences,
      education: resume.education,
      certifications: resume.certifications
    },
    gaps: {
      required: unsupportedRequired,
      preferred: unsupportedPreferred,
      missingTerms: missingTerms.slice(0, 12)
    }
  };
}
