import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeResume, extractKeywords, extractRequirements, resolveTargetConcepts } from '../site/lib/analyzer.js';
import { createBlankResume, resumeToPlainText } from '../site/lib/model.js';

test('extractKeywords prioritizes repeated meaningful terms and drops common words', () => {
  const terms = extractKeywords('Required Python data analysis. Python automation and data analysis experience required.', 10).map((item) => item.term);
  assert.ok(terms.includes('python'));
  assert.ok(terms.includes('data analysis'));
  assert.equal(terms.includes('required'), false);
});

test('extractRequirements finds qualification-like statements', () => {
  const requirements = extractRequirements('Build dashboards. Required: 5 years of analytics experience. Tableau preferred. Must hold a degree.');
  assert.equal(requirements.length, 3);
});

test('analysis rewards quantified action-oriented bullets and target alignment', () => {
  const resume = createBlankResume();
  resume.profile = {
    ...resume.profile,
    fullName: 'Alex Morgan',
    cityState: 'Austin, TX',
    email: 'alex@example.com',
    phone: '555-0100',
    headline: 'Senior Data Analyst',
    summary: 'Senior data analyst with eight years of experience translating operational data into decisions. Builds reliable reporting systems, partners with business leaders, and improves performance through clear analysis, automation, and measurable process improvement.'
  };
  resume.skills = ['Python', 'SQL', 'Tableau', 'Data Analysis', 'Automation', 'Stakeholder Management'];
  resume.experiences[0] = {
    ...resume.experiences[0],
    title: 'Senior Data Analyst',
    company: 'Example Co.',
    start: 'Jan 2022',
    current: true,
    bullets: [
      'Automated Python and SQL reporting workflows, reducing weekly preparation time by 12 hours.',
      'Built Tableau dashboards used by 45 leaders to monitor service quality and staffing.',
      'Improved data validation controls, reducing reporting defects by 38%.'
    ]
  };
  resume.education[0] = { ...resume.education[0], degree: 'B.S. Analytics', school: 'State University' };
  resume.jobDescription = 'Senior Data Analyst required. Python, SQL, Tableau, data analysis, automation, and stakeholder management required.';
  const result = analyzeResume(resume);
  assert.ok(result.overall >= 75);
  assert.ok(result.targetScore >= 70);
  assert.equal(result.metricCount, 3);
});

test('plain text export uses standard section headings', () => {
  const resume = createBlankResume();
  const output = resumeToPlainText(resume);
  assert.match(output, /SUMMARY/);
  assert.match(output, /SKILLS/);
  assert.match(output, /WORK EXPERIENCE/);
  assert.match(output, /EDUCATION/);
});


test('target language prefers meaningful phrases and filters boilerplate', () => {
  const posting = `
Quality Assurance Coordinator
Conduct internal quality assurance monitoring and auditing for clinical research studies.
Confirm regulatory compliance and data compliance; review clinical trial documentation.
Conditions of Employment: E-Verify and pre-placement health evaluation.
Equal Opportunity Employer. Employment misconduct policy applies.
All work is performed under applicable university policy.
`;
  const terms = extractKeywords(posting, 20).map((item) => item.term);
  assert.ok(terms.includes('quality assurance'));
  assert.ok(terms.some((term) => term.includes('clinical research')));
  assert.ok(terms.some((term) => term.includes('regulatory compliance')));
  assert.equal(terms.includes('quality'), false);
  assert.equal(terms.includes('assurance'), false);
  assert.equal(terms.includes('employment'), false);
  assert.equal(terms.includes('misconduct'), false);
  assert.equal(terms.includes('all'), false);
  assert.equal(terms.includes('under'), false);
});


test('target concepts reject sentence fragments while preserving canonical resume concepts', () => {
  const posting = `
Quality Assurance Coordinator
Conduct quality assurance monitoring and auditing for clinical research.
Oversee the corrective and preventive action (CAPA) process.
Required: strong understanding of clinical research conduct (GCP, ICH guidelines).
Required: review timely and accurate submission of clinical trial data and report findings.
Required: working knowledge of computer software including Microsoft Office (Outlook, Word, Excel, PowerPoint).
Preferred: SoCRA or ACRP certification.
Preferred: monitoring or auditing FDA regulated studies for highly complex clinical trials.
Preferred: Clinical Trial Professional certification.
`;
  const terms = extractKeywords(posting, 24).map((item) => item.term);

  for (const expected of [
    'quality assurance',
    'clinical research',
    'monitoring and auditing',
    'CAPA',
    'GCP',
    'ICH guidelines',
    'clinical trial data',
    'Microsoft Office',
    'SoCRA / ACRP certification',
    'FDA-regulated studies'
  ]) assert.ok(terms.includes(expected), `missing expected concept: ${expected}`);

  for (const fragment of [
    'assurance coordinator',
    'computer software',
    'software including',
    'accurate submission',
    'submission clinical',
    'preventive action',
    'knowledge computer',
    'highly complex'
  ]) assert.equal(terms.includes(fragment), false, `sentence fragment leaked: ${fragment}`);
});


test('target concept curation excludes detected concepts and adds user concepts', () => {
  const posting = 'Quality assurance and regulatory compliance required. Risk management preferred.';
  const concepts = resolveTargetConcepts(posting, {
    excluded: ['regulatory compliance'],
    added: ['vendor oversight']
  }, 20);

  const terms = concepts.map((item) => item.term.toLowerCase());
  assert.ok(terms.includes('quality assurance'));
  assert.ok(terms.includes('vendor oversight'));
  assert.equal(terms.includes('regulatory compliance'), false);
  assert.equal(concepts.find((item) => item.term.toLowerCase() === 'vendor oversight')?.source, 'manual');
});

test('readiness analysis classifies a user-added concept against resume evidence', () => {
  const resume = createBlankResume();
  resume.profile.fullName = 'Alex Morgan';
  resume.profile.email = 'alex@example.com';
  resume.profile.phone = '555-0100';
  resume.skills = ['Vendor Oversight'];
  resume.jobDescription = 'Quality assurance required.';
  resume.targetConceptOverrides = { added: ['vendor oversight'], excluded: ['quality assurance'] };

  const result = analyzeResume(resume);
  assert.ok(result.matchedKeywords.some((item) => item.term.toLowerCase() === 'vendor oversight'));
  assert.equal(result.matchedKeywords.some((item) => item.term.toLowerCase() === 'quality assurance'), false);
  assert.equal(result.missingKeywords.some((item) => item.term.toLowerCase() === 'quality assurance'), false);
});
