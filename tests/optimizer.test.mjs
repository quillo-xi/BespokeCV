import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCoachingPlan } from '../site/lib/optimizer.js';
import { createBlankResume } from '../site/lib/model.js';

test('coaching plan focuses the resume on supported target strengths', () => {
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

  const plan = buildCoachingPlan(resume);

  assert.match(plan.headline.suggested, /Quality Assurance Coordinator/);
  assert.match(plan.summary.suggested, /quality assurance/i);
  assert.equal(/gcp/i.test(plan.summary.suggested), false);
  assert.ok(plan.requirements.some((item) => /GCP/i.test(item.text) && item.status !== 'covered'));
  assert.ok(plan.requirements.some((item) => /SoCRA/i.test(item.text) && item.type === 'preferred'));
  assert.ok(plan.experiences[0].bullets[0].score >= plan.experiences[0].bullets.at(-1).score);
  assert.ok(plan.priorities.length >= 2);
  assert.equal(plan.checklist.length, 6);
});

test('coaching plan honors curated target concepts', () => {
  const resume = createBlankResume();
  resume.profile.fullName = 'Alex Morgan';
  resume.skills = ['Vendor Oversight'];
  resume.jobDescription = 'Quality assurance and regulatory compliance required.';
  resume.targetConceptOverrides = {
    added: ['vendor oversight'],
    excluded: ['regulatory compliance']
  };

  const plan = buildCoachingPlan(resume);
  const terms = plan.targetTerms.map((item) => item.term.toLowerCase());

  assert.ok(terms.includes('vendor oversight'));
  assert.equal(terms.includes('regulatory compliance'), false);
  assert.ok(plan.strengths.some((item) => item.term.toLowerCase() === 'vendor oversight'));
});

test('supporting job descriptions make coaching more specific without changing requirement coverage by themselves', () => {
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

  const plan = buildCoachingPlan(resume);
  const auditRequirement = plan.requirements.find((item) => /monitoring and auditing/i.test(item.text));

  assert.equal(plan.snapshot.careerSourceCount, 1);
  assert.ok(plan.careerContext.alignedSources.length >= 1);
  assert.ok(plan.experiences[0].sourceSuggestions.length >= 1);
  assert.ok(auditRequirement);
  assert.notEqual(auditRequirement.status, 'covered');
  assert.ok(auditRequirement.sourceContext.length >= 1);
  assert.match(auditRequirement.comment, /job-description source/i);
  assert.ok(plan.sourceOpportunities.some((item) => /monitoring and auditing/i.test(item.term)));
});

test('coaching language uses practical tailoring states', () => {
  const resume = createBlankResume();
  resume.jobDescription = `
Required: project management experience.
Preferred: risk management experience.
`;

  const plan = buildCoachingPlan(resume);
  const statuses = new Set(plan.requirements.map((item) => item.status));

  for (const status of statuses) assert.ok(['covered', 'detail', 'not-shown'].includes(status));
  assert.equal(plan.requirements.some((item) => /fabricat|truthful|dishonest/i.test(item.comment)), false);
});


test('coaching recognizes a state professional license from Certifications even when wording and order differ', () => {
  const resume = createBlankResume();
  resume.profile.fullName = 'Alex Morgan';
  resume.certifications = [
    'Pharmacy Technician - California State Board of Pharmacy',
    'License TCH 147938'
  ];
  resume.jobDescription = 'Required: California Pharmacy Technician License.';

  const plan = buildCoachingPlan(resume);
  const requirement = plan.requirements.find((item) => /California Pharmacy Technician License/i.test(item.text));

  assert.ok(requirement);
  assert.equal(requirement.status, 'covered');
  assert.ok(requirement.evidence.some((item) =>
    item.label === 'Certification / license' &&
    /Pharmacy Technician - California State Board of Pharmacy/i.test(item.text)
  ));
});

test('coaching and requirement parsing agree on a structured pharmacy posting with upon-hire timing', () => {
  const resume = createBlankResume();
  resume.profile.fullName = 'Alex Morgan';
  resume.education = [{
    ...resume.education[0],
    school: 'Example College',
    degree: 'Associate of Science'
  }];
  resume.certifications = [
    'Pharmacy Technician - California State Board of Pharmacy',
    'License TCH 147938'
  ];
  resume.jobDescription = `
Description

Providence caregivers are not simply valued. Your voice matters here, because we know that to inspire and retain the best people, we must empower them.

Required Qualifications

Education to meet certification, license or registration requirement.
Upon hire: California Pharmacy Technician License.
Upon hire: Certified in Chemotherapy Preparation through ministry specific certification program.

Why Join Providence?

Benefits information.
`;

  const plan = buildCoachingPlan(resume);

  assert.equal(plan.requirements.length, 3);
  assert.equal(plan.requirements.some((item) => /Your voice matters|Required Qualifications/i.test(item.text)), false);

  const license = plan.requirements.find((item) => /California Pharmacy Technician License/i.test(item.text));
  assert.ok(license);
  assert.equal(license.status, 'covered');
  assert.equal(license.timing, 'Upon hire');

  const education = plan.requirements.find((item) => /Education to meet certification/i.test(item.text));
  assert.ok(education);
  assert.equal(education.status, 'covered');
});

test('credential matching does not confuse a related occupation with the required licensed profession', () => {
  const resume = createBlankResume();
  resume.certifications = [
    'Pharmacy Technician - California State Board of Pharmacy',
    'License TCH 147938'
  ];
  resume.jobDescription = 'Required: California Pharmacist License.';

  const plan = buildCoachingPlan(resume);
  const requirement = plan.requirements.find((item) => /California Pharmacist License/i.test(item.text));

  assert.ok(requirement);
  assert.notEqual(requirement.status, 'covered');
});
