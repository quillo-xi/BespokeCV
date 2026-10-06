import test from 'node:test';
import assert from 'node:assert/strict';
import { validateJobUrl } from '../site/lib/job-source.js';

test('job URL validation requires safe public HTTPS destinations', () => {
  assert.equal(validateJobUrl('http://careers.example.org/job/1').ok, false);
  assert.equal(validateJobUrl('https://localhost/job/1').ok, false);
  assert.equal(validateJobUrl('https://127.0.0.1/job/1').ok, false);
  assert.equal(validateJobUrl('https://user:pass@careers.example.org/job/1').ok, false);
  const valid = validateJobUrl('https://careers.microsoft.com/v2/global/en/search-results.html');
  assert.equal(valid.ok, true);
  assert.equal(valid.fetchAllowed, true);
});

test('restricted job platforms validate as links but are not scraped', () => {
  const linkedin = validateJobUrl('https://www.linkedin.com/jobs/view/123456');
  assert.equal(linkedin.ok, true);
  assert.equal(linkedin.fetchAllowed, false);
  assert.equal(linkedin.provider, 'LinkedIn');

  const indeed = validateJobUrl('https://www.indeed.com/viewjob?jk=abc123');
  assert.equal(indeed.ok, true);
  assert.equal(indeed.fetchAllowed, false);
  assert.equal(indeed.provider, 'Indeed');
});
