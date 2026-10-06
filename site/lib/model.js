export const APP_VERSION = '0.3.4';

export const createBlankResume = () => ({
  schemaVersion: 4,
  profile: {
    fullName: '',
    cityState: '',
    email: '',
    phone: '',
    linkedin: '',
    portfolio: '',
    headline: '',
    summary: ''
  },
  experiences: [createExperience()],
  education: [createEducation()],
  certifications: [],
  skills: [],
  jobDescription: '',
  jobSourceUrl: '',
  jobSourceTitle: '',
  jobSourceCompany: '',
  targetConceptOverrides: { added: [], excluded: [] },
  careerSources: [createCareerSource()],
  importedSource: { fileName: '', format: '', importedAt: '', text: '' }
});

export function createExperience() {
  return {
    id: cryptoSafeId(),
    title: '',
    company: '',
    location: '',
    start: '',
    end: '',
    current: false,
    bullets: ['', '', '']
  };
}

export function createEducation() {
  return {
    id: cryptoSafeId(),
    degree: '',
    school: '',
    location: '',
    graduation: ''
  };
}

export function createCareerSource() {
  return {
    id: cryptoSafeId(),
    label: '',
    text: '',
    fileName: '',
    fileFormat: '',
    fileText: '',
    importedAt: ''
  };
}

export function cryptoSafeId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function normalizeResume(input) {
  const base = createBlankResume();
  if (!input || typeof input !== 'object') return base;
  return {
    ...base,
    ...input,
    profile: { ...base.profile, ...(input.profile ?? {}) },
    experiences: Array.isArray(input.experiences) && input.experiences.length
      ? input.experiences.map((item) => ({ ...createExperience(), ...item, bullets: Array.isArray(item.bullets) ? item.bullets : [''] }))
      : base.experiences,
    education: Array.isArray(input.education) && input.education.length
      ? input.education.map((item) => ({ ...createEducation(), ...item }))
      : base.education,
    certifications: Array.isArray(input.certifications) ? input.certifications : [],
    skills: Array.isArray(input.skills) ? input.skills : [],
    jobDescription: typeof input.jobDescription === 'string' ? input.jobDescription : '',
    jobSourceUrl: typeof input.jobSourceUrl === 'string' ? input.jobSourceUrl : '',
    jobSourceTitle: typeof input.jobSourceTitle === 'string' ? input.jobSourceTitle : '',
    jobSourceCompany: typeof input.jobSourceCompany === 'string' ? input.jobSourceCompany : '',
    targetConceptOverrides: {
      added: Array.isArray(input.targetConceptOverrides?.added) ? input.targetConceptOverrides.added.map(String) : [],
      excluded: Array.isArray(input.targetConceptOverrides?.excluded) ? input.targetConceptOverrides.excluded.map(String) : []
    },
    careerSources: Array.isArray(input.careerSources) && input.careerSources.length
      ? input.careerSources.map((item) => ({
          ...createCareerSource(),
          ...(item ?? {}),
          label: String(item?.label ?? ''),
          text: String(item?.text ?? ''),
          fileName: String(item?.fileName ?? ''),
          fileFormat: String(item?.fileFormat ?? ''),
          fileText: String(item?.fileText ?? ''),
          importedAt: String(item?.importedAt ?? '')
        }))
      : base.careerSources,
    importedSource: { ...base.importedSource, ...(input.importedSource ?? {}) }
  };
}

export function resumeToPlainText(resume) {
  const p = resume.profile;
  const lines = [
    p.fullName,
    [p.cityState, p.phone, p.email].filter(Boolean).join(' | '),
    [p.linkedin, p.portfolio].filter(Boolean).join(' | '),
    p.headline,
    '',
    'SUMMARY',
    p.summary,
    '',
    'SKILLS',
    resume.skills.filter(Boolean).join(' | '),
    '',
    'WORK EXPERIENCE'
  ];

  for (const role of resume.experiences) {
    lines.push(
      '',
      [role.title, role.company].filter(Boolean).join(' — '),
      [role.location, [role.start, role.current ? 'Present' : role.end].filter(Boolean).join(' – ')].filter(Boolean).join(' | '),
      ...role.bullets.filter(Boolean).map((bullet) => `• ${bullet}`)
    );
  }

  lines.push('', 'EDUCATION');
  for (const education of resume.education) {
    lines.push(
      [education.degree, education.school].filter(Boolean).join(' — '),
      [education.location, education.graduation].filter(Boolean).join(' | ')
    );
  }

  if (resume.certifications.some(Boolean)) {
    lines.push('', 'CERTIFICATIONS', ...resume.certifications.filter(Boolean));
  }

  return lines.filter((line, index, all) => !(line === '' && all[index - 1] === '')).join('\n').trim();
}
