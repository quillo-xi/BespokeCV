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
    if (degreeMatch) return { status: 'covered', keyTerms, supported };
    if (/equivalent experience/.test(text) && resume.experiences.some((role) => role.title || role.company)) {
      return { status: 'detail', keyTerms, supported };
    }
  }

  if (/\b\d+\s*[-–—]\s*\d+\s+years?|at least\s+\d+\s+years?|\d+\+?\s+years?/.test(text)) {
    return { status: 'detail', keyTerms, supported };
  }

  if (ratio >= 0.5 || supported.length >= 2) return { status: 'covered', keyTerms, supported };
  if (supported.length) return { status: 'detail', keyTerms, supported };
  return { status: 'not-shown', keyTerms, supported };
}

function requirementCoach(text, status, sourceContext = []) {
  if (status === 'covered') {
    return 'This is already visible in the resume. Keep the strongest example easy to find and use the employer’s wording where it fits naturally.';
  }

  if (sourceContext.length) {
    const context = sourceContext[0];
    return `Your “${context.label}” job-description source mentions: “${context.text}” If this reflects work you handled, use it to add a more specific bullet with your role, scope, frequency, or outcome.`;
  }

  const value = text.toLowerCase();
  if (/capa|corrective|preventive/.test(value)) {
    return 'Add a concrete corrective/preventive-action example: what started the action, what you coordinated, the area affected, and how closure or effectiveness was checked.';
  }
  if (/audit|auditing|monitor/.test(value)) {
    return 'Add an audit or monitoring example that names what you reviewed, the rule or criteria used, how often or how broadly you reviewed it, and what followed.';
  }
  if (/gcp|ich|clinical research|clinical trial/.test(value)) {
    return 'Make the clinical-research work easier to see by naming the study activity, protocol or GCP/ICH requirement, and the records or monitoring work involved.';
  }
  if (/regulatory|compliance|federal regulation|policy/.test(value)) {
    return 'Name the regulation, policy, or standard you worked with and describe what you reviewed, supported, or changed under that requirement.';
  }
  if (/data|reporting|documentation/.test(value)) {
    return 'Show the kind of data or documentation you worked with, the system or method used, the volume or frequency, and what the review or report was used for.';
  }
  if (/certif|socra|acrp/.test(value)) {
    return 'If you hold the credential, list its exact name and issuer. If not, leave this as a preferred qualification rather than trying to replace it with unrelated experience.';
  }
  if (/bachelor|degree|years?/.test(value)) {
    return 'Make the relevant education and experience easy to scan. For experience-based alternatives, show the length and level of responsibility clearly.';
  }
  if (/communication|presentation|interpersonal|relationship/.test(value)) {
    return 'Use a specific example: who you worked with, what you communicated or coordinated, how often, and what the interaction accomplished.';
  }
  return 'Add one specific example that shows what you did, the setting or scope, the tool or standard involved, and the result or purpose.';
}

function bulletRelevance(bullet, targetTerms) {
  return targetTerms.reduce((score, item) => score + (textSupportsTerm(bullet, item.term) ? item.weight : 0), 0);
}

function matchedTermsForText(text, targetTerms, limit = 4) {
  return targetTerms.filter((item) => textSupportsTerm(text, item.term)).slice(0, limit).map((item) => item.term);
}

function roleSourceSuggestions(role, sources, targetTerms) {
  const title = role.title?.trim().toLowerCase();
  const company = role.company?.trim().toLowerCase();
  const likely = sources.filter((source) => {
    const haystack = `${source.label}\n${source.text.slice(0, 1200)}`.toLowerCase();
    return (title && title.length >= 4 && haystack.includes(title)) || (company && company.length >= 4 && haystack.includes(company));
  });
  const suggestions = [];
  for (const source of likely) {
    for (const sentence of source.sentences) {
      const matched = matchedTermsForText(sentence, targetTerms, 3);
      if (!matched.length) continue;
      suggestions.push({
        label: source.label,
        text: sentence,
        terms: matched,
        prompt: `If this was part of your work, consider adding a bullet that explains your part in it and gives the reader a sense of scale, frequency, or outcome.`
      });
      if (suggestions.length >= 3) return suggestions;
    }
  }
  return suggestions;
}

function buildHeadlineStarter(resume, targetTitle, supportedTerms) {
  const strengths = supportedTerms.slice(0, 2).map((item) => item.term);
  if (targetTitle && targetTitle !== 'Target role') {
    return strengths.length ? `${targetTitle} | ${strengths.join(' | ')}` : targetTitle;
  }
  return resume.profile.headline?.trim() || strengths.join(' | ') || 'Professional headline';
}

function buildSummaryStarter(resume, targetTitle, supportedTerms) {
  const identity = resume.profile.headline?.trim()
    || resume.experiences.find((role) => role.title?.trim())?.title?.trim()
    || 'Experienced professional';
  const strengths = supportedTerms.slice(0, 4).map((item) => item.term);
  const targetPhrase = targetTitle && targetTitle !== 'Target role' ? ` for ${targetTitle} opportunities` : '';
  const strengthPhrase = strengths.length ? ` with experience in ${listJoin(strengths)}` : '';
  const firstSentence = resume.profile.summary?.trim().split(/(?<=[.!?])\s+/)[0]?.trim() || '';

  const opening = `${identity}${strengthPhrase}${targetPhrase}.`;
  if (!firstSentence || firstSentence.toLowerCase() === opening.toLowerCase()) return opening;
  return `${opening} ${firstSentence}`;
}

function sourceSupportedTerms(missingTerms, sources) {
  return missingTerms
    .map((item) => {
      const context = careerContextForTerm(sources, item.term, 2);
      return context.length ? { ...item, context } : null;
    })
    .filter(Boolean);
}

function buildPriorityActions(resume, targetTitle, supportedTerms, missingTerms, requirementReview, experiences, skillsToAdd) {
  const actions = [];
  const headline = resume.profile.headline?.trim();
  const targetInHeadline = targetTitle && targetTitle !== 'Target role' && headline && headline.toLowerCase().includes(targetTitle.toLowerCase());

  if (!headline || !targetInHeadline) {
    actions.push({
      priority: 'high',
      title: 'Tune the top of the resume',
      detail: targetTitle && targetTitle !== 'Target role'
        ? `Make the headline and opening lines point clearly toward ${targetTitle}.`
        : 'Use a clear professional headline that matches the kind of work you are targeting.'
    });
  }

  if (supportedTerms.length) {
    actions.push({
      priority: 'high',
      title: 'Lead with your strongest matches',
      detail: `Bring ${listJoin(supportedTerms.slice(0, 4).map((item) => item.term))} into the top third of the resume and the most relevant work bullets.`
    });
  }

  if (skillsToAdd.length) {
    actions.push({
      priority: 'medium',
      title: 'Update the skills section',
      detail: `Consider adding ${listJoin(skillsToAdd.slice(0, 4))}; these ideas are already reflected elsewhere in your resume.`
    });
  }

  const rolesWithRelevantBullets = experiences.filter((role) => role.bullets.some((item) => item.score > 0));
  if (rolesWithRelevantBullets.length) {
    actions.push({
      priority: 'medium',
      title: 'Reorder bullets for this application',
      detail: `Within ${rolesWithRelevantBullets.length} role${rolesWithRelevantBullets.length === 1 ? '' : 's'}, move the bullets most closely tied to the target job above less relevant details.`
    });
  }

  const requiredNeedsWork = requirementReview.filter((item) => item.type === 'required' && item.status !== 'covered');
  if (requiredNeedsWork.length) {
    actions.push({
      priority: 'high',
      title: 'Make required qualifications easier to find',
      detail: `${requiredNeedsWork.length} required item${requiredNeedsWork.length === 1 ? '' : 's'} could use more detail or visibility. Work through the Requirement coaching section before submitting.`
    });
  } else if (missingTerms.length) {
    actions.push({
      priority: 'medium',
      title: 'Check the remaining target language',
      detail: `Review the concepts not shown yet and decide whether any belong in your experience, skills, education, or certifications.`
    });
  }

  return actions.slice(0, 5);
}

function finalChecklist(resume, requirementReview, experiences, supportedTerms) {
  const requiredOpen = requirementReview.filter((item) => item.type === 'required' && item.status !== 'covered').length;
  const hasRelevantBullet = experiences.some((role) => role.bullets.some((item) => item.score > 0));
  return [
    {
      done: Boolean(resume.profile.headline?.trim()),
      text: 'Headline clearly points to the kind of role you want.'
    },
    {
      done: Boolean(resume.profile.summary?.trim()) && supportedTerms.length > 0,
      text: 'Summary highlights the experience most relevant to this posting.'
    },
    {
      done: hasRelevantBullet,
      text: 'Most relevant accomplishments appear near the top of each applicable role.'
    },
    {
      done: requiredOpen === 0,
      text: requiredOpen ? `Required qualifications have been reviewed; ${requiredOpen} still need more detail or visibility.` : 'Required qualifications are easy to find where they apply.'
    },
    {
      done: resume.skills.filter(Boolean).length >= 6,
      text: 'Skills section is focused and uses recognizable job-related terms.'
    },
    {
      done: true,
      text: 'Final file stays simple, single-column, and easy for both ATS parsing and a quick human scan.'
    }
  ];
}

export function buildCoachingPlan(resume) {
  const targetTitle = inferTargetTitle(resume);
  const company = resume.jobSourceCompany?.trim() || '';
  const targetTerms = resolveTargetConcepts(resume.jobDescription, resume.targetConceptOverrides, 28);
  const requirements = extractRequirementSignals(resume.jobDescription, 24);
  const entries = evidenceEntries(resume);
  const careerSources = careerSourceRecords(resume);
  const resumeText = resumeToPlainText(resume);

  const supportedTerms = targetTerms.filter((item) => textSupportsTerm(resumeText, item.term));
  const missingTerms = targetTerms.filter((item) => !textSupportsTerm(resumeText, item.term));
  const sourceOpportunities = sourceSupportedTerms(missingTerms, careerSources);

  const requirementReview = requirements.map((requirement) => {
    const review = requirementStatus(resume, entries, requirement);
    const evidence = review.supported.flatMap((item) => evidenceForTerm(entries, item.term)).slice(0, 3);
    const sourceContext = careerContextForRequirement(careerSources, requirement.text);
    return {
      ...requirement,
      status: review.status,
      evidence,
      sourceContext,
      comment: requirementCoach(requirement.text, review.status, sourceContext)
    };
  });

  const skillDetails = [...resume.skills]
    .filter(Boolean)
    .map((skill, index) => ({
      skill,
      index,
      score: targetTerms.reduce((sum, item) => sum + (textSupportsTerm(skill, item.term) ? item.weight : 0), 0),
      matches: matchedTermsForText(skill, targetTerms, 3)
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const skillsToAdd = supportedTerms
    .filter((item) => !resume.skills.some((skill) => textSupportsTerm(skill, item.term)))
    .slice(0, 8)
    .map((item) => item.term);

  const experiences = resume.experiences.map((role) => ({
    ...role,
    sourceSuggestions: roleSourceSuggestions(role, careerSources, targetTerms),
    bullets: role.bullets
      .map((bullet, index) => ({
        bullet,
        index,
        score: bulletRelevance(bullet, targetTerms),
        matches: matchedTermsForText(bullet, targetTerms, 4)
      }))
      .filter((item) => item.bullet?.trim())
      .sort((a, b) => b.score - a.score || a.index - b.index)
  }));

  const required = requirementReview.filter((item) => item.type === 'required');
  const requiredCovered = required.filter((item) => item.status === 'covered').length;
  const preferred = requirementReview.filter((item) => item.type === 'preferred');

  const summaryStarter = buildSummaryStarter(resume, targetTitle, supportedTerms);
  const headlineStarter = buildHeadlineStarter(resume, targetTitle, supportedTerms);
  const priorities = buildPriorityActions(resume, targetTitle, supportedTerms, missingTerms, requirementReview, experiences, skillsToAdd);

  return {
    targetTitle,
    company,
    snapshot: {
      matchedConcepts: supportedTerms.length,
      totalConcepts: targetTerms.length,
      requiredCovered,
      requiredTotal: required.length,
      preferredTotal: preferred.length,
      careerSourceCount: careerSources.length
    },
    priorities,
    targetTerms,
    strengths: supportedTerms.slice(0, 10),
    opportunities: missingTerms.slice(0, 12),
    sourceOpportunities: sourceOpportunities.slice(0, 8),
    headline: {
      current: resume.profile.headline?.trim() || '',
      suggested: headlineStarter,
      reason: targetTitle && targetTitle !== 'Target role'
        ? `A focused headline helps the reader immediately connect your background to ${targetTitle}.`
        : 'A focused headline gives the reader an immediate sense of your professional direction.'
    },
    summary: {
      current: resume.profile.summary?.trim() || '',
      suggested: summaryStarter,
      strengths: supportedTerms.slice(0, 5).map((item) => item.term),
      reason: supportedTerms.length
        ? 'This starter brings your strongest job-related experience into the opening lines.'
        : 'Use the summary to connect your background to the target role in two or three short sentences.'
    },
    skills: {
      prioritized: skillDetails,
      addFromResumeEvidence: skillsToAdd,
      exploreFromJobDescriptions: sourceOpportunities.slice(0, 6)
    },
    experiences,
    requirements: requirementReview,
    careerContext: {
      sourceCount: careerSources.length,
      alignedSources: careerSources.map((source) => ({
        label: source.label,
        fileName: source.fileName,
        matchedTerms: targetTerms.filter((item) => textSupportsTerm(source.text, item.term)).slice(0, 8).map((item) => item.term)
      })).filter((source) => source.matchedTerms.length)
    },
    checklist: finalChecklist(resume, requirementReview, experiences, supportedTerms)
  };
}

// Kept as an internal compatibility alias for older tests/backups that may reference the prior name.
export const buildOptimizedDraft = buildCoachingPlan;
