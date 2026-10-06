import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeResumeQuality, assessBullet, buildEvidenceExamples } from '../site/lib/review-engine.js';
import { createBlankResume } from '../site/lib/model.js';

test('bullet strength can come from standards, complexity, tools, ownership, and outcomes without a number', () => {
  const assessment = assessBullet('Led cross-functional quality reviews under ISO 9001, resolving compliance issues across regional operations.');

  assert.equal(assessment.actionOpening, true);
  assert.equal(assessment.measurable, false);
  assert.ok(assessment.meaningfulEvidence);
  assert.ok(assessment.signalTypes.includes('standard'));
  assert.ok(assessment.signalTypes.includes('ownership'));
  assert.ok(assessment.signalTypes.includes('complexity'));
  assert.ok(assessment.signalTypes.includes('outcome'));
  assert.ok(assessment.evidenceScore >= 58);
});

test('task-only bullets get targeted context questions', () => {
  const assessment = assessBullet('Prepared weekly reports.');

  assert.equal(assessment.actionOpening, true);
  assert.ok(assessment.questions.length >= 1);
  assert.ok(assessment.evidenceScore < 58);
});

test('review engine detects repetition, duplicate content, date conflicts, and past-role tense', () => {
  const resume = createBlankResume();
  resume.skills = ['SQL', 'SQL'];
  resume.experiences = [
    {
      ...resume.experiences[0],
      title: 'Analyst',
      company: 'Example',
      start: '2022',
      end: '2021',
      current: false,
      bullets: [
        'Prepare weekly operational reports for leadership.',
        'Prepare monthly operational reports for leadership.',
        'Prepare operational reports for senior leadership.',
        'Prepare recurring operational reports for department leadership.'
      ]
    },
    {
      ...resume.experiences[0],
      title: 'Coordinator',
      company: 'Earlier Example',
      start: '2019',
      end: '2020',
      current: false,
      bullets: ['Prepare weekly operational reports for leadership.']
    }
  ];

  const result = analyzeResumeQuality(resume);
  const kinds = new Set(result.consistencyIssues.map((item) => item.kind));

  assert.ok(kinds.has('date'));
  assert.ok(kinds.has('tense'));
  assert.ok(kinds.has('repetition'));
  assert.ok(kinds.has('duplicate'));
  assert.ok(kinds.has('skills'));
});

test('evidence examples do not create list-count metrics from enumerated nouns', () => {
  const resume = createBlankResume();
  resume.experiences[0] = {
    ...resume.experiences[0],
    title: 'Specialist',
    company: 'Example',
    bullets: [
      'Prepare specialized products, including category A, category B, and category C.',
      'Responsible for safeguarding $2M in sensitive equipment.'
    ]
  };

  const examples = buildEvidenceExamples(resume);
  assert.equal(examples.some((item) => /covering 3|3 named categories/i.test(item.after)), false);
  assert.ok(examples.some((item) => /^Safeguarded and maintained accountability for \$2M/i.test(item.after)));
});
