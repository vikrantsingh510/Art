import { IconWhatsapp } from './icons';
import { resolveWhatsappFloatHref } from '@/lib/whatsapp-enquiry';

export function WhatsappFloat({ enquiry }) {
  const href = resolveWhatsappFloatHref(enquiry);
  if (!href) {
    return null;
  }

  return (
    <a
      className="whatsapp-float fixed z-40 inline-flex h-12 w-12 items-center justify-center rounded-full text-ivory shadow-[0_8px_24px_rgba(26,25,24,0.18)] transition-transform duration-300 ease-out hover:scale-[1.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-antique"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat on WhatsApp"
      title="Chat on WhatsApp"
    >
      <IconWhatsapp className="h-6 w-6" />
    </a>
  );
}
