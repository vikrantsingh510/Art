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
      className="page-shell pt-16 md:pt-20"
      aria-labelledby={faq.heading ? 'homepage-faq-heading' : undefined}
      aria-label={faq.heading ? undefined : 'Frequently asked questions'}
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12 mb-8 md:mb-10">
        {faq.heading ? (
          <h2
            id="homepage-faq-heading"
            className="lg:col-span-5 font-display text-3xl md:text-4xl leading-tight text-ink"
          >
            {faq.heading}
          </h2>
        ) : null}
        {faq.subtitle ? (
          <p className="lg:col-span-7 lg:col-start-6 text-[15px] leading-7 text-on-surface-variant max-w-xl lg:max-w-none lg:pt-1">
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
                  className="flex w-full cursor-pointer items-start justify-between gap-4 border-0 bg-transparent py-4 text-left font-display text-lg md:text-xl leading-snug text-ink"
                  aria-expanded={open}
                  aria-controls={panelId}
                  onClick={() => toggle(item.id)}
                >
                  <span className="min-w-0">{item.question}</span>
                  <span className={`homepage-faq-icon mt-1 inline-flex shrink-0${open ? ' is-open' : ''}`} aria-hidden="true">
                    {open ? (
                      <IconMinus className="h-4 w-4 text-patina" />
                    ) : (
                      <IconPlus className="h-4 w-4 text-patina" />
                    )}
                  </span>
                </button>
              </h3>
              <div
                id={panelId}
                role="region"
                aria-labelledby={buttonId}
                aria-hidden={!open}
                inert={!open ? true : undefined}
                className={`homepage-faq-panel${open ? ' is-open' : ''}`}
              >
                <div className="homepage-faq-panel-inner">
                  <p className="whitespace-pre-wrap pb-5 pr-10 max-w-3xl text-[15px] leading-7 text-on-surface-variant">
                    {item.answer}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
