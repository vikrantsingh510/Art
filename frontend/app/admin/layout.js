import { AdminShell } from '@/components/admin-shell';
import { ErrorState } from '@/components/states';
import { isRateLimitError, requireAdmin } from '@/lib/session';

export const metadata = {
  title: {
    default: 'Curatorial console',
    template: "%s · Maison d'Art console",
  },
};

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }) {
  let user = null;
  let rateLimitError = null;
  try {
    ({ user } = await requireAdmin());
  } catch (error) {
    if (!isRateLimitError(error)) {
      throw error;
    }
    rateLimitError = error;
  }

  if (rateLimitError) {
    return (
      <div className="page-shell py-16">
        <ErrorState
          title="Too many requests"
          error={rateLimitError}
          retryHref="/admin"
        />
      </div>
    );
  }

  return <AdminShell user={user}>{children}</AdminShell>;
}
