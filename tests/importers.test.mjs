import test from 'node:test';
import assert from 'node:assert/strict';
import { createDocxBytes } from '../site/lib/docx.js';
import { createBlankResume } from '../site/lib/model.js';
import { extractDocxText, parseResumeText } from '../site/lib/importers.js';

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
