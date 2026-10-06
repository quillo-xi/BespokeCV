import test from 'node:test';
import assert from 'node:assert/strict';
import { createDocxBytes } from '../site/lib/docx.js';
import { createBlankResume } from '../site/lib/model.js';

test('DOCX generator emits a ZIP container with Office package entries', () => {
  const resume = createBlankResume();
  resume.profile.fullName = 'Alex Morgan';
  const bytes = createDocxBytes(resume);
  assert.equal(bytes[0], 0x50);
  assert.equal(bytes[1], 0x4b);
  const text = new TextDecoder().decode(bytes);
  assert.match(text, /word\/document\.xml/);
  assert.match(text, /\[Content_Types\]\.xml/);
  assert.match(text, /Alex Morgan/);
});
