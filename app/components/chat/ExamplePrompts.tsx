import React from 'react';

interface LandingTemplate {
  title: string;
  description: string;
  prompt: string;
}

const LANDING_TEMPLATES: LandingTemplate[] = [
  {
    title: 'SaaS Landing Page',
    description: 'Professional landing with pricing, features & testimonials',
    prompt:
      'Build a modern SaaS landing page with: hero section with gradient background and CTA button, features grid with icons, pricing table with 3 tiers (Basic/Pro/Enterprise) with toggle monthly/annual, testimonials carousel, FAQ accordion, and footer with newsletter signup. Use a professional blue/indigo color scheme. Make it fully responsive with smooth scroll animations.',
  },
  {
    title: 'Portfolio Website',
    description: 'Creative portfolio with project gallery & dark theme',
    prompt:
      'Build a creative portfolio website with: hero section with name and animated title, project gallery with filterable grid (Web/Mobile/Design categories), about section with skills progress bars, experience timeline, contact form with validation, and a dark theme with accent color highlights. Add subtle hover animations on project cards.',
  },
  {
    title: 'E-commerce Product Page',
    description: 'Product page with gallery, cart & reviews',
    prompt:
      'Build an e-commerce product page with: product image gallery with thumbnail navigation, product details (title, price, reviews stars, description), size/color selectors, add to cart button with quantity picker, related products carousel, customer reviews section with rating breakdown, and a sticky add-to-cart bar on mobile. Use a clean white/gray theme.',
  },
  {
    title: 'Blog / Magazine',
    description: 'Blog homepage with article grid & newsletter',
    prompt:
      'Build a blog homepage with: hero featured article with large image, article grid with cards (image, category tag, title, excerpt, date, read time), sidebar with categories and popular posts, newsletter signup section with email input, and pagination. Use a clean serif/sans-serif typography combination with warm colors.',
  },
  {
    title: 'Agency / Studio',
    description: 'Agency site with services, case studies & team',
    prompt:
      'Build an agency website with: full-screen hero with background video placeholder and bold headline, services section with icon cards, case studies grid with hover overlay showing project details, team section with photo cards, client logos marquee, contact section with form and map placeholder, and footer with social links. Use a modern dark/light contrast theme.',
  },
];

export function ExamplePrompts(sendMessage?: { (event: React.UIEvent, messageInput?: string): void | undefined }) {
  return (
    <div id="examples" className="relative w-full max-w-3xl mx-auto mt-6 px-2">
      <div
        className="grid grid-cols-2 md:grid-cols-3 gap-2"
        style={{
          animation: '.25s ease-out 0s 1 _fade-and-move-in_g2ptj_1 forwards',
        }}
      >
        {LANDING_TEMPLATES.map((template, index) => (
          <button
            key={index}
            onClick={(event) => {
              sendMessage?.(event, template.prompt);
            }}
            className="volt-card p-3 text-sm text-left cursor-pointer transition-colors duration-150 hover:bg-[var(--surface-2)]"
            style={{ color: 'var(--text-secondary)' }}
          >
            <div className="font-medium text-sm mb-1" style={{ color: 'var(--text-primary)' }}>
              {template.title}
            </div>
            <div className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {template.description}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
