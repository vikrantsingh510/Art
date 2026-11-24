'use client';

import { useState } from 'react';
import { IconMinus, IconPlus } from '@/components/icons';
import { shouldRenderHomepageFaq, toggleHomepageFaqOpenIds } from '@/lib/homepage-faq';

export function HomepageFaq({ faq }) {
  const [openIds, setOpenIds] = useState(() => new Set());

  if (!shouldRenderHomepageFaq(faq)) {
    return null;
  }

  function toggle(id) {
    setOpenIds((current) => toggleHomepageFaqOpenIds(current, id));
  }

  return (
    <section
      className="page-shell py-20 md:py-28"
      aria-labelledby={faq.heading ? 'homepage-faq-heading' : undefined}
      aria-label={faq.heading ? undefined : 'Frequently asked questions'}
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 mb-12 lg:mb-16">
        {faq.heading ? (
          <h2
            id="homepage-faq-heading"
            className="lg:col-span-5 font-display text-[38px] md:text-[48px] lg:text-[52px] leading-[1.15] tracking-[-0.02em] text-ink"
          >
            {faq.heading}
          </h2>
        ) : null}
        {faq.subtitle ? (
          <p className="lg:col-span-7 lg:col-start-6 text-[15px] md:text-base leading-7 text-on-surface-variant max-w-xl lg:max-w-none lg:pt-3">
            {faq.subtitle}
          </p>
        ) : null}
      </div>
      <div className="border-t border-fillet">
        {faq.items.map((item) => {
          const open = openIds.has(item.id);
          const buttonId = `homepage-faq-button-${item.id}`;
          const panelId = `homepage-faq-panel-${item.id}`;
          return (
            <div key={item.id} className="border-b border-fillet">
              <h3>
                <button
                  type="button"
                  id={buttonId}
                  className="flex w-full cursor-pointer items-start justify-between gap-6 border-0 bg-transparent py-6 text-left font-display text-[22px] md:text-[26px] leading-snug text-ink"
                  aria-expanded={open}
                  aria-controls={panelId}
                  onClick={() => toggle(item.id)}
                >
                  <span>{item.question}</span>
                  {open ? (
                    <IconMinus className="mt-1.5 h-5 w-5 shrink-0 text-patina" />
                  ) : (
                    <IconPlus className="mt-1.5 h-5 w-5 shrink-0 text-patina" />
                  )}
                </button>
              </h3>
              <div
                id={panelId}
                role="region"
                aria-labelledby={buttonId}
                hidden={!open}
                className="pb-7 pr-12 max-w-3xl"
              >
                <p className="whitespace-pre-wrap text-[15px] leading-7 text-on-surface-variant">
                  {item.answer}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
