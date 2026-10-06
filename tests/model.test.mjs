import test from 'node:test';
import assert from 'node:assert/strict';
import { createBlankResume, normalizeResume } from '../site/lib/model.js';

test('resume schema always keeps at least one career-source intake slot', () => {
  const blank = createBlankResume();
  assert.equal(blank.schemaVersion, 4);
  assert.equal(blank.careerSources.length, 1);

  const normalized = normalizeResume({ schemaVersion: 1, careerSources: [] });
  assert.equal(normalized.careerSources.length, 1);
  assert.equal(normalized.careerSources[0].text, '');
  assert.equal(normalized.careerSources[0].fileText, '');
});

test('career-source text and extracted file context survive normalization', () => {
  const normalized = normalizeResume({
    careerSources: [{
      id: 'source-a',
      label: 'Operations Manager',
      text: 'Additional role details',
      fileName: 'job-description.pdf',
      fileFormat: 'pdf',
      fileText: 'Formal responsibilities and systems',
      importedAt: '2026-10-06T00:00:00.000Z'
    }]
  });

  assert.equal(normalized.careerSources[0].label, 'Operations Manager');
  assert.equal(normalized.careerSources[0].fileName, 'job-description.pdf');
  assert.match(normalized.careerSources[0].fileText, /Formal responsibilities/);
});
