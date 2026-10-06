import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeResume, extractKeywords, extractRequirements } from '../site/lib/analyzer.js';
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
