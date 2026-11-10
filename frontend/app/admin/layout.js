import { AdminShell } from '@/components/admin-shell';
import { requireAdmin } from '@/lib/session';

export const metadata = {
  title: {
    default: 'Curatorial console',
    template: "%s · Maison d'Art console",
  },
};

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }) {
  const { user } = await requireAdmin();
  return <AdminShell user={user}>{children}</AdminShell>;
}
