import { Manrope, Playfair_Display } from 'next/font/google';
import './globals.css';

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
  display: 'swap',
  weight: ['300', '400', '500', '600'],
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
});

export const metadata = {
  title: {
    default: "Maison d'Art",
    template: "%s · Maison d'Art",
  },
  description: 'A private salon for authentic handmade original artworks, verified provenance, and atelier-direct acquisition.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${manrope.variable} ${playfair.variable} h-full antialiased`}>
      <body className="min-h-full bg-surface font-sans text-on-surface">{children}</body>
    </html>
  );
}
