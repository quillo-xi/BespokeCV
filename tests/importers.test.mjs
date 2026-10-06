import test from 'node:test';
import assert from 'node:assert/strict';
import { createDocxBytes } from '../site/lib/docx.js';
import { createBlankResume } from '../site/lib/model.js';
import { extractDocxText, importSupportingDocument, parseResumeText } from '../site/lib/importers.js';

test('DOCX importer extracts readable local text from generated resume package', async () => {
  const resume = createBlankResume();
  resume.profile.fullName = 'Alex Morgan';
  resume.profile.email = 'alex@example.com';
  resume.profile.summary = 'Operations leader focused on scalable service delivery and measurable process improvement.';
  resume.skills = ['Process improvement', 'Data analysis'];
  resume.experiences[0].title = 'Operations Manager';
  resume.experiences[0].company = 'Example Organization';
  resume.experiences[0].start = 'Jan 2022';
  resume.experiences[0].current = true;
  resume.experiences[0].bullets = ['Reduced fulfillment cycle time by 22% across three service teams.'];
  const bytes = createDocxBytes(resume);
  const text = await extractDocxText(bytes);
  assert.match(text, /Alex Morgan/);
  assert.match(text, /Operations Manager/);
  assert.match(text, /Reduced fulfillment cycle time by 22%/);
});

test('resume text parser conservatively maps common sections', () => {
  const text = `Alex Morgan\nalex@example.com | 555-555-0100\nOperations Manager\n\nSUMMARY\nOperations leader focused on service quality and process improvement.\n\nSKILLS\nProject management | Data analysis | SQL\n\nWORK EXPERIENCE\nOperations Manager\nExample Organization\nJan 2022 – Present\n• Reduced cycle time by 22% across three teams.\n\nEDUCATION\nB.S. Business Administration\nState University\n2021\n\nCERTIFICATIONS\nProject Management Professional`;
  const resume = parseResumeText(text, { fileName: 'resume.txt', format: 'text' });
  assert.equal(resume.profile.fullName, 'Alex Morgan');
  assert.equal(resume.profile.email, 'alex@example.com');
  assert.ok(resume.skills.includes('SQL'));
  assert.equal(resume.experiences[0].title, 'Operations Manager');
  assert.equal(resume.experiences[0].current, true);
  assert.match(resume.importedSource.text, /WORK EXPERIENCE/);
});


test('resume parser removes page artifacts, rejoins wrapped bullets, ignores duration as location, and maps education correctly', () => {
  const text = `Jordan Taylor
jordan@example.com | 555-555-0100
Operations Analyst

SUMMARY
Operations professional focused on service quality.

WORK EXPERIENCE
Operations Analyst
Example Organization
Apr 2018 - Present (4 years 6 months +)
• Operate and maintain an automated reporting
system
• Led a cross-functional project that improved
workflow quality
Front Desk Assistant
Jordan Taylor - page 1
Example Services
Nov 2011 - Apr 2014 (2 years 6 months)
• Answer phone calls and emails

EDUCATION
North Coast College
Associate of Science - AS, Liberal Arts and Sciences
2020 - 2022
Learning Platform
Data Analytics Certificate
2022 - 2022
Central High School
High School Diploma
Jordan Taylor - page 2
2000 - 2004

SKILLS
Data Cleaning • R (Programming
Language) • Communication
Jordan Taylor - page 3`;

  const resume = parseResumeText(text, { fileName: 'structured.pdf', format: 'pdf' });

  assert.equal(resume.experiences[0].location, '');
  assert.equal(resume.experiences[0].bullets[0], 'Operate and maintain an automated reporting system');
  assert.equal(resume.experiences[0].bullets[1], 'Led a cross-functional project that improved workflow quality');
  assert.equal(resume.experiences[1].title, 'Front Desk Assistant');
  assert.equal(resume.experiences[1].company, 'Example Services');

  assert.equal(resume.education.length, 3);
  assert.equal(resume.education[0].school, 'North Coast College');
  assert.equal(resume.education[0].degree, 'Associate of Science - AS, Liberal Arts and Sciences');
  assert.equal(resume.education[0].graduation, '2022');
  assert.equal(resume.education[2].school, 'Central High School');
  assert.equal(resume.education[2].degree, 'High School Diploma');
  assert.equal(resume.education[2].graduation, '2004');

  assert.ok(resume.skills.includes('R (Programming Language)'));
  assert.equal(resume.skills.some((item) => /page\s+\d+/i.test(item)), false);
  assert.equal(resume.importedSource.text.includes('Jordan Taylor - page 1'), false);
});


test('supporting job-description documents are extracted without mapping them into resume fields', async () => {
  const file = new File([
    'Operations Manager\nResponsibilities include vendor management, quarterly compliance reviews, and process improvement across regional teams.'
  ], 'operations-manager.txt', { type: 'text/plain' });

  const result = await importSupportingDocument(file);
  assert.equal(result.fileName, 'operations-manager.txt');
  assert.equal(result.format, 'text');
  assert.match(result.text, /vendor management/);
  assert.match(result.text, /quarterly compliance reviews/);
  assert.ok(result.importedAt);
});
