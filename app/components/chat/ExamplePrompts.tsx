import React from 'react';

const EXAMPLE_PROMPTS = [
  { text: 'Build a SaaS landing page with pricing and features', emoji: '🚀' },
  { text: 'Create a portfolio site with project gallery', emoji: '🎨' },
  { text: 'Build an e-commerce product page with cart', emoji: '🛍️' },
  { text: 'Create a dashboard with charts and stats', emoji: '📊' },
  { text: 'Build a blog with article grid and newsletter', emoji: '📝' },
  { text: 'Create an agency website with services and team', emoji: '🏢' },
];

export function ExamplePrompts(sendMessage?: { (event: React.UIEvent, messageInput?: string): void | undefined }) {
  return (
    <div id="examples" className="relative w-full max-w-3xl mx-auto mt-6 px-2">
      <div
        className="grid grid-cols-2 lg:grid-cols-3 gap-2"
        style={{
          animation: '.25s ease-out 0s 1 _fade-and-move-in_g2ptj_1 forwards',
        }}
      >
        {EXAMPLE_PROMPTS.map((examplePrompt, index: number) => {
          return (
            <button
              key={index}
              onClick={(event) => {
                sendMessage?.(event, examplePrompt.text);
              }}
              className="flex items-start gap-2 border border-bolt-elements-borderColor rounded-lg bg-bolt-elements-background-depth-2 hover:bg-bolt-elements-item-backgroundActive text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary px-3 py-2.5 text-xs text-left transition-theme"
            >
              <span className="text-base shrink-0 leading-tight">{examplePrompt.emoji}</span>
              <span className="leading-snug">{examplePrompt.text}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
