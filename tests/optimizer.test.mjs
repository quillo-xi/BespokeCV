import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOptimizedDraft } from '../site/lib/optimizer.js';
import { createBlankResume } from '../site/lib/model.js';

test('optimized draft uses resume evidence and leaves unsupported requirements visible', () => {
  const resume = createBlankResume();
  resume.profile.fullName = 'Alex Morgan';
  resume.profile.headline = 'Quality and Operations Specialist';
  resume.profile.summary = 'Quality professional with experience reviewing regulated operations and coordinating corrective actions.';
  resume.skills = ['Quality Assurance', 'Regulatory Compliance', 'Microsoft Excel'];
  resume.experiences[0] = {
    ...resume.experiences[0],
    title: 'Quality Specialist',
    company: 'Example Organization',
    start: '2022',
    current: true,
    bullets: [
      'Audited regulated workflows for compliance and documented findings for leadership review.',
      'Coordinated corrective actions across three operating teams.'
    ]
  };
  resume.jobSourceTitle = 'Quality Assurance Coordinator';
  resume.jobDescription = `
Required: quality assurance monitoring and auditing experience.
Required: strong understanding of clinical research conduct, GCP and ICH guidelines.
Required: regulatory compliance and accurate data review.
Preferred: SoCRA or ACRP certification.
`;

  const draft = buildOptimizedDraft(resume);
  assert.match(draft.personalized.headline, /Quality Assurance Coordinator/);
  assert.match(draft.personalized.summary, /quality assurance/i);
  assert.equal(/gcp/i.test(draft.personalized.summary), false);
  assert.ok(draft.requirements.some((item) => /GCP/i.test(item.text) && item.status !== 'supported'));
  assert.ok(draft.requirements.some((item) => /SoCRA/i.test(item.text) && item.type === 'preferred'));
  assert.ok(draft.personalized.experiences[0].bullets[0].score >= draft.personalized.experiences[0].bullets.at(-1).score);
});


test('optimized draft honors curated target concepts', () => {
  const resume = createBlankResume();
  resume.profile.fullName = 'Alex Morgan';
  resume.skills = ['Vendor Oversight'];
  resume.jobDescription = 'Quality assurance and regulatory compliance required.';
  resume.targetConceptOverrides = {
    added: ['vendor oversight'],
    excluded: ['regulatory compliance']
  };

  const draft = buildOptimizedDraft(resume);
  const terms = draft.targetTerms.map((item) => item.term.toLowerCase());
  assert.ok(terms.includes('vendor oversight'));
  assert.equal(terms.includes('regulatory compliance'), false);
});


test('supporting job descriptions make coaching specific without becoming accomplishment evidence', () => {
  const resume = createBlankResume();
  resume.profile.fullName = 'Alex Morgan';
  resume.experiences[0] = {
    ...resume.experiences[0],
    title: 'Operations Manager',
    company: 'Example Organization',
    start: '2022',
    current: true,
    bullets: ['Coordinated weekly operational reporting for department leadership.']
  };
  resume.jobDescription = `
Required: quality assurance and regulatory compliance experience.
Required: monitoring and auditing experience.
`;
  resume.careerSources = [{
    id: 'source-1',
    label: 'Operations Manager — Example Organization',
    fileName: 'role-description.txt',
    fileFormat: 'text',
    importedAt: '2026-10-06T00:00:00.000Z',
    text: '',
    fileText: 'Operations Manager responsibilities include monitoring and auditing regulated workflows against documented compliance procedures and coordinating corrective follow-up with regional teams.'
  }];

  const draft = buildOptimizedDraft(resume);
  const auditRequirement = draft.requirements.find((item) => /monitoring and auditing/i.test(item.text));

  assert.equal(draft.careerContext.sourceCount, 1);
  assert.ok(draft.careerContext.alignedSources.length >= 1);
  assert.ok(draft.personalized.experiences[0].sourceSuggestions.length >= 1);
  assert.ok(auditRequirement);
  assert.notEqual(auditRequirement.status, 'supported');
  assert.ok(auditRequirement.sourceContext.length >= 1);
  assert.match(auditRequirement.comment, /supporting job-description source/i);
  assert.equal(draft.idealReference.bullets.some((item) => /\[(?:scope|process|standard|tool)/i.test(item)), false);
});
