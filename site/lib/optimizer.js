import { extractKeywords, extractRequirementSignals, resolveTargetConcepts, textSupportsTerm } from './analyzer.js';
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

function cleanSourceSentence(value) {
  return String(value ?? '')
    .replace(/^[\s•▪◦*-]+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function careerSourceRecords(resume) {
  return (resume.careerSources ?? [])
    .map((source, index) => {
      const text = [source.fileText, source.text].filter((value) => String(value ?? '').trim()).join('\n');
      const sentences = text
        .split(/(?:\n+|(?<=[.!?;])\s+)/)
        .map(cleanSourceSentence)
        .filter((value) => value.length >= 18 && value.length <= 320);
      return {
        index,
        label: source.label?.trim() || source.fileName?.trim() || `Job description ${index + 1}`,
        fileName: source.fileName?.trim() || '',
        text,
        sentences
      };
    })
    .filter((source) => source.text.trim());
}

function careerContextForTerm(sources, term, limit = 2) {
  const results = [];
  for (const source of sources) {
    for (const sentence of source.sentences) {
      if (!textSupportsTerm(sentence, term)) continue;
      results.push({ label: source.label, text: sentence, term });
      if (results.length >= limit) return results;
    }
  }
  return results;
}

function careerContextForRequirement(sources, requirement) {
  const concepts = extractKeywords(requirement, 6);
  const seen = new Set();
  const matches = [];
  for (const concept of concepts) {
    for (const item of careerContextForTerm(sources, concept.term, 2)) {
      const key = `${item.label}\n${item.text}`;
      if (seen.has(key)) continue;
      seen.add(key);
      matches.push(item);
      if (matches.length >= 2) return matches;
    }
  }
  return matches;
}

function roleSourceSuggestions(role, sources, targetTerms) {
  const title = role.title?.trim().toLowerCase();
  const company = role.company?.trim().toLowerCase();
  const likely = sources.filter((source) => {
    const haystack = `${source.label}\n${source.text.slice(0, 1200)}`.toLowerCase();
    return (title && title.length >= 4 && haystack.includes(title)) || (company && company.length >= 4 && haystack.includes(company));
  });
  const pool = likely.length ? likely : [];
  const suggestions = [];
  for (const source of pool) {
    for (const sentence of source.sentences) {
      const matched = targetTerms.filter((item) => textSupportsTerm(sentence, item.term)).slice(0, 3);
      if (!matched.length) continue;
      suggestions.push({
        label: source.label,
        text: sentence,
        terms: matched.map((item) => item.term)
      });
      if (suggestions.length >= 3) return suggestions;
    }
  }
  return suggestions;
}

function sourceAwareEvidencePattern(term, sources) {
  const [context] = careerContextForTerm(sources, term, 1);
  if (context) {
    return `For ${term}, the supplied role description “${context.label}” references: “${context.text}” Convert that responsibility into a resume accomplishment only if personally performed, adding ownership, scale, and a verifiable result.`;
  }
  return `Show direct evidence of ${term} by naming the relevant responsibility, tool or governing standard, the scope of your work, and a verifiable outcome.`;
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

function coachingExample(text, sourceContext = []) {
  if (sourceContext.length) {
    const context = sourceContext[0];
    return `Your supporting job-description source “${context.label}” mentions: “${context.text}” If you personally performed this responsibility, turn it into an accomplishment that states your ownership, scope, and outcome. Do not copy the duty statement as proof of an achievement.`;
  }

  const value = text.toLowerCase();
  if (/capa|corrective|preventive/.test(value)) {
    return 'If accurate, describe a corrective/preventive action you personally owned: what finding or risk triggered it, what action you coordinated, the affected scope, and how effectiveness or closure was verified.';
  }
  if (/audit|auditing|monitor/.test(value)) {
    return 'If accurate, identify what you audited or monitored, the governing requirement or review criteria, the size/frequency of the review, the findings, and what happened after escalation or corrective action.';
  }
  if (/gcp|ich|clinical research|clinical trial/.test(value)) {
    return 'If accurate, specify the clinical-research activity you personally performed, the GCP/ICH or protocol requirement involved, and the study, record, or monitoring scope.';
  }
  if (/regulatory|compliance|federal regulation|policy/.test(value)) {
    return 'If accurate, identify the governing standard or regulation, what you personally reviewed for compliance, the organizational scope, and the resulting action or outcome.';
  }
  if (/data|reporting|documentation/.test(value)) {
    return 'If accurate, identify the data or documentation you personally reviewed, the system or method used, the volume/frequency, how accuracy or timeliness was verified, and what decision or action followed.';
  }
  if (/certif|socra|acrp/.test(value)) {
    return 'List the exact credential and issuing organization only if held. If it is preferred rather than required, leave it as a visible gap instead of implying certification.';
  }
  if (/bachelor|degree|years?/.test(value)) {
    return 'Clarify the exact education and length/scope of equivalent experience. Do not convert experience into a degree or invent a duration.';
  }
  if (/communication|presentation|interpersonal|relationship/.test(value)) {
    return 'If accurate, identify the audiences involved, what you communicated or coordinated, the frequency or scope, and the result—for example training completion, issue resolution, audit coordination, or escalation.';
  }
  return 'If this requirement is genuinely part of your background, add a concrete accomplishment showing your action, the work context, the relevant tool/standard, the scope, and the result. Otherwise leave it identified as a gap.';
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
  const targetTerms = resolveTargetConcepts(resume.jobDescription, resume.targetConceptOverrides, 28);
  const requirements = extractRequirementSignals(resume.jobDescription, 24);
  const entries = evidenceEntries(resume);
  const careerSources = careerSourceRecords(resume);
  const resumeText = resumeToPlainText(resume);

  const supportedTerms = targetTerms.filter((item) => textSupportsTerm(resumeText, item.term));
  const missingTerms = targetTerms.filter((item) => !textSupportsTerm(resumeText, item.term));

  const requirementReview = requirements.map((requirement) => {
    const review = requirementStatus(resume, entries, requirement);
    const evidence = review.supported.flatMap((item) => evidenceForTerm(entries, item.term)).slice(0, 3);
    const sourceContext = careerContextForRequirement(careerSources, requirement.text);
    return {
      ...requirement,
      status: review.status,
      evidence,
      sourceContext,
      comment: review.status === 'supported'
        ? 'Evidence was found in the imported/entered resume. Supporting job descriptions may add terminology or role context, but the resume evidence remains the basis for this status.'
        : coachingExample(requirement.text, sourceContext)
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
    sourceSuggestions: roleSourceSuggestions(role, careerSources, targetTerms),
    bullets: role.bullets
      .map((bullet, index) => ({ bullet, index, score: bulletRelevance(bullet, targetTerms) }))
      .filter((item) => item.bullet?.trim())
      .sort((a, b) => b.score - a.score || a.index - b.index)
  }));

  const idealBullets = targetTerms.slice(0, 5).map((item) => sourceAwareEvidencePattern(item.term, careerSources));

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
    careerContext: {
      sourceCount: careerSources.length,
      alignedSources: careerSources.map((source) => ({
        label: source.label,
        fileName: source.fileName,
        matchedTerms: targetTerms.filter((item) => textSupportsTerm(source.text, item.term)).slice(0, 8).map((item) => item.term)
      })).filter((source) => source.matchedTerms.length)
    },
    gaps: {
      required: unsupportedRequired,
      preferred: unsupportedPreferred,
      missingTerms: missingTerms.slice(0, 12)
    }
  };
}
