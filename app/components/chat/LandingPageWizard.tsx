import React, { useState, useCallback } from 'react';

interface LandingPageWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (prompt: string) => void;
}

const PAGE_TYPES = [
  { value: 'SaaS', emoji: '🚀' },
  { value: 'Portfolio', emoji: '🎨' },
  { value: 'E-commerce', emoji: '🛍️' },
  { value: 'Blog', emoji: '📝' },
  { value: 'Agency', emoji: '🏢' },
  { value: 'Custom', emoji: '✏️' },
] as const;

const STYLES = [
  { value: 'minimal', label: 'Minimal', description: 'Clean lines, lots of whitespace' },
  { value: 'bold', label: 'Bold', description: 'Large typography, vivid colors' },
  { value: 'glassmorphism', label: 'Glassmorphism', description: 'Frosted glass effects, gradients' },
  { value: 'gradient', label: 'Gradient', description: 'Colorful gradient backgrounds' },
] as const;

const COLOR_PALETTES = [
  { value: 'blue/indigo', label: 'Blue / Indigo', tag: 'professional', colors: ['#3B82F6', '#6366F1'] },
  { value: 'purple/pink', label: 'Purple / Pink', tag: 'creative', colors: ['#8B5CF6', '#EC4899'] },
  { value: 'green/teal', label: 'Green / Teal', tag: 'fresh', colors: ['#10B981', '#14B8A6'] },
  { value: 'orange/red', label: 'Orange / Red', tag: 'energetic', colors: ['#F97316', '#EF4444'] },
  { value: 'dark/gold', label: 'Dark / Gold', tag: 'luxury', colors: ['#1F2937', '#F59E0B'] },
  { value: 'custom', label: 'Custom', tag: 'pick your own', colors: ['#6B7280', '#9CA3AF'] },
] as const;

const ALL_SECTIONS = [
  'Hero',
  'Features',
  'Pricing',
  'Testimonials',
  'FAQ',
  'Team',
  'Gallery',
  'Contact',
  'Newsletter',
  'Footer',
] as const;

const DEFAULT_SECTIONS_BY_TYPE: Record<string, string[]> = {
  SaaS: ['Hero', 'Features', 'Pricing', 'Testimonials', 'FAQ', 'Footer'],
  Portfolio: ['Hero', 'Gallery', 'Features', 'Contact', 'Footer'],
  'E-commerce': ['Hero', 'Gallery', 'Features', 'Testimonials', 'FAQ', 'Footer'],
  Blog: ['Hero', 'Features', 'Newsletter', 'Footer'],
  Agency: ['Hero', 'Features', 'Gallery', 'Team', 'Testimonials', 'Contact', 'Footer'],
  Custom: ['Hero', 'Features', 'Contact', 'Footer'],
};

const TOTAL_STEPS = 6;

export const LandingPageWizard: React.FC<LandingPageWizardProps> = ({ isOpen, onClose, onGenerate }) => {
  const [step, setStep] = useState(1);
  const [pageType, setPageType] = useState('SaaS');
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [ctaText, setCtaText] = useState('Get Started');
  const [style, setStyle] = useState('minimal');
  const [palette, setPalette] = useState('blue/indigo');
  const [customPrimary, setCustomPrimary] = useState('#6366F1');
  const [customSecondary, setCustomSecondary] = useState('#EC4899');
  const [sections, setSections] = useState<string[]>(DEFAULT_SECTIONS_BY_TYPE['SaaS']);

  const handleTypeChange = useCallback((type: string) => {
    setPageType(type);
    setSections(DEFAULT_SECTIONS_BY_TYPE[type] || DEFAULT_SECTIONS_BY_TYPE['Custom']);
  }, []);

  const toggleSection = useCallback((section: string) => {
    setSections((prev) => (prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section]));
  }, []);

  const handleGenerate = useCallback(() => {
    const colorScheme = palette === 'custom' ? `custom (${customPrimary} and ${customSecondary})` : palette;
    const nameStr = name || 'my project';
    const taglineStr = tagline || '';
    const prompt = [
      `Build a ${style} ${pageType} landing page for "${nameStr}".`,
      taglineStr ? `Headline: "${taglineStr}"` : '',
      `CTA: "${ctaText}"`,
      `Color scheme: ${colorScheme}`,
      `Sections: ${sections.join(', ')}`,
      'Make it fully responsive with smooth animations. Use semantic HTML, proper heading hierarchy for SEO, and include meta tags.',
    ]
      .filter(Boolean)
      .join('\n');
    onGenerate(prompt);
    resetAndClose();
  }, [style, pageType, name, tagline, ctaText, palette, customPrimary, customSecondary, sections, onGenerate]);

  const resetAndClose = useCallback(() => {
    setStep(1);
    onClose();
  }, [onClose]);

  if (!isOpen) {
    return null;
  }

  const canNext = () => {
    if (step === 2) {
      return true; // all content fields are optional
    }

    return true;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={resetAndClose}>
      <div
        className="bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-bolt-elements-borderColor">
          <div>
            <h2 className="text-lg font-bold text-bolt-elements-textPrimary">Create Landing Page</h2>
            <p className="text-xs text-bolt-elements-textSecondary mt-0.5">
              Step {step} of {TOTAL_STEPS}
            </p>
          </div>
          <button
            onClick={resetAndClose}
            className="text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-colors p-1"
          >
            <span className="i-ph:x text-xl" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-bolt-elements-background-depth-2">
          <div
            className="h-full bg-purple-500 transition-all duration-300"
            style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
          />
        </div>

        {/* Content */}
        <div className="px-6 py-5">
          {step === 1 && (
            <div>
              <h3 className="text-sm font-semibold text-bolt-elements-textPrimary mb-3">What type of landing page?</h3>
              <div className="grid grid-cols-2 gap-2">
                {PAGE_TYPES.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => handleTypeChange(t.value)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm text-left transition-all ${
                      pageType === t.value
                        ? 'border-purple-500 bg-purple-500/10 text-purple-500 font-medium'
                        : 'border-bolt-elements-borderColor text-bolt-elements-textSecondary hover:border-purple-500/40'
                    }`}
                  >
                    <span className="text-lg">{t.emoji}</span>
                    {t.value}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-4">
              <h3 className="text-sm font-semibold text-bolt-elements-textPrimary">Content details</h3>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-bolt-elements-textSecondary">Business / Project name</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Acme Inc"
                  className="px-3 py-2 rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 text-bolt-elements-textPrimary text-sm focus:outline-none focus:border-purple-500"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-bolt-elements-textSecondary">Tagline / Headline</span>
                <input
                  type="text"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  placeholder="e.g. Build faster, ship smarter"
                  className="px-3 py-2 rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 text-bolt-elements-textPrimary text-sm focus:outline-none focus:border-purple-500"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-bolt-elements-textSecondary">CTA button text</span>
                <input
                  type="text"
                  value={ctaText}
                  onChange={(e) => setCtaText(e.target.value)}
                  placeholder="Get Started"
                  className="px-3 py-2 rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 text-bolt-elements-textPrimary text-sm focus:outline-none focus:border-purple-500"
                />
              </label>
            </div>
          )}

          {step === 3 && (
            <div>
              <h3 className="text-sm font-semibold text-bolt-elements-textPrimary mb-3">Choose a style</h3>
              <div className="grid grid-cols-2 gap-2">
                {STYLES.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => setStyle(s.value)}
                    className={`flex flex-col px-3 py-3 rounded-lg border text-left transition-all ${
                      style === s.value
                        ? 'border-purple-500 bg-purple-500/10'
                        : 'border-bolt-elements-borderColor hover:border-purple-500/40'
                    }`}
                  >
                    <span
                      className={`text-sm font-medium ${style === s.value ? 'text-purple-500' : 'text-bolt-elements-textPrimary'}`}
                    >
                      {s.label}
                    </span>
                    <span className="text-xs text-bolt-elements-textSecondary mt-0.5">{s.description}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div>
              <h3 className="text-sm font-semibold text-bolt-elements-textPrimary mb-3">Pick a color palette</h3>
              <div className="grid grid-cols-2 gap-2">
                {COLOR_PALETTES.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => setPalette(p.value)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-left transition-all ${
                      palette === p.value
                        ? 'border-purple-500 bg-purple-500/10'
                        : 'border-bolt-elements-borderColor hover:border-purple-500/40'
                    }`}
                  >
                    <div className="flex shrink-0">
                      <div className="w-4 h-4 rounded-full" style={{ backgroundColor: p.colors[0] }} />
                      <div className="w-4 h-4 rounded-full -ml-1" style={{ backgroundColor: p.colors[1] }} />
                    </div>
                    <div>
                      <span
                        className={`text-sm font-medium ${palette === p.value ? 'text-purple-500' : 'text-bolt-elements-textPrimary'}`}
                      >
                        {p.label}
                      </span>
                      <span className="text-xs text-bolt-elements-textSecondary ml-1">({p.tag})</span>
                    </div>
                  </button>
                ))}
              </div>
              {palette === 'custom' && (
                <div className="flex gap-4 mt-3">
                  <label className="flex items-center gap-2 text-xs text-bolt-elements-textSecondary">
                    Primary
                    <input
                      type="color"
                      value={customPrimary}
                      onChange={(e) => setCustomPrimary(e.target.value)}
                      className="w-8 h-8 rounded cursor-pointer border-0"
                    />
                  </label>
                  <label className="flex items-center gap-2 text-xs text-bolt-elements-textSecondary">
                    Secondary
                    <input
                      type="color"
                      value={customSecondary}
                      onChange={(e) => setCustomSecondary(e.target.value)}
                      className="w-8 h-8 rounded cursor-pointer border-0"
                    />
                  </label>
                </div>
              )}
            </div>
          )}

          {step === 5 && (
            <div>
              <h3 className="text-sm font-semibold text-bolt-elements-textPrimary mb-3">Select sections</h3>
              <div className="grid grid-cols-2 gap-2">
                {ALL_SECTIONS.map((section) => (
                  <button
                    key={section}
                    onClick={() => toggleSection(section)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${
                      sections.includes(section)
                        ? 'border-purple-500 bg-purple-500/10 text-purple-500 font-medium'
                        : 'border-bolt-elements-borderColor text-bolt-elements-textSecondary hover:border-purple-500/40'
                    }`}
                  >
                    <span className={`i-ph:${sections.includes(section) ? 'check-square' : 'square'} text-base`} />
                    {section}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 6 && (
            <div>
              <h3 className="text-sm font-semibold text-bolt-elements-textPrimary mb-3">Summary</h3>
              <div className="flex flex-col gap-2 text-sm text-bolt-elements-textSecondary bg-bolt-elements-background-depth-2 rounded-lg p-4">
                <div>
                  <span className="font-medium text-bolt-elements-textPrimary">Type:</span> {pageType}
                </div>
                {name && (
                  <div>
                    <span className="font-medium text-bolt-elements-textPrimary">Name:</span> {name}
                  </div>
                )}
                {tagline && (
                  <div>
                    <span className="font-medium text-bolt-elements-textPrimary">Headline:</span> {tagline}
                  </div>
                )}
                <div>
                  <span className="font-medium text-bolt-elements-textPrimary">CTA:</span> {ctaText}
                </div>
                <div>
                  <span className="font-medium text-bolt-elements-textPrimary">Style:</span> {style}
                </div>
                <div>
                  <span className="font-medium text-bolt-elements-textPrimary">Colors:</span>{' '}
                  {palette === 'custom' ? `${customPrimary} / ${customSecondary}` : palette}
                </div>
                <div>
                  <span className="font-medium text-bolt-elements-textPrimary">Sections:</span> {sections.join(', ')}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-bolt-elements-borderColor">
          <button
            onClick={() => (step === 1 ? resetAndClose() : setStep(step - 1))}
            className="px-4 py-2 text-sm rounded-lg border border-bolt-elements-borderColor text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-colors"
          >
            {step === 1 ? 'Cancel' : 'Back'}
          </button>
          {step < TOTAL_STEPS ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!canNext()}
              className="px-4 py-2 text-sm rounded-lg bg-purple-500 text-white hover:bg-purple-600 disabled:opacity-50 transition-colors"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleGenerate}
              className="px-4 py-2 text-sm rounded-lg bg-purple-500 text-white hover:bg-purple-600 transition-colors font-medium"
            >
              Generate Landing Page
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default LandingPageWizard;
