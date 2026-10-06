export const APP_VERSION = '0.1.0';

export const createBlankResume = () => ({
  schemaVersion: 1,
  profile: { fullName: '', cityState: '', email: '', phone: '', linkedin: '', portfolio: '', headline: '', summary: '' },
  experiences: [createExperience()],
  education: [createEducation()],
  certifications: [],
  skills: [],
  jobDescription: ''
});

export function createExperience() {
  return { id: cryptoSafeId(), title: '', company: '', location: '', start: '', end: '', current: false, bullets: ['', '', ''] };
}

export function createEducation() {
  return { id: cryptoSafeId(), degree: '', school: '', location: '', graduation: '' };
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
    jobDescription: typeof input.jobDescription === 'string' ? input.jobDescription : ''
  };
}

export function resumeToPlainText(resume) {
  const p = resume.profile;
  const lines = [p.fullName,[p.cityState,p.phone,p.email].filter(Boolean).join(' | '),[p.linkedin,p.portfolio].filter(Boolean).join(' | '),p.headline,'','SUMMARY',p.summary,'','SKILLS',resume.skills.filter(Boolean).join(' | '),'','WORK EXPERIENCE'];
  for (const role of resume.experiences) {
    lines.push('',[role.title,role.company].filter(Boolean).join(' — '),[role.location,[role.start,role.current ? 'Present' : role.end].filter(Boolean).join(' – ')].filter(Boolean).join(' | '),...role.bullets.filter(Boolean).map((bullet) => `• ${bullet}`));
  }
  lines.push('','EDUCATION');
  for (const education of resume.education) {
    lines.push([education.degree,education.school].filter(Boolean).join(' — '),[education.location,education.graduation].filter(Boolean).join(' | '));
  }
  if (resume.certifications.some(Boolean)) lines.push('','CERTIFICATIONS',...resume.certifications.filter(Boolean));
  return lines.filter((line,index,all) => !(line === '' && all[index - 1] === '')).join('\n').trim();
}
