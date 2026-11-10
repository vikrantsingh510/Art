import { AccountNav } from '@/components/account-nav';
import { LogoutButton } from '@/components/logout-button';
import { requireUser } from '@/lib/session';

export default async function AccountLayout({ children }) {
  const { user } = await requireUser();

  return (
    <div className="page-shell py-12 grid grid-cols-1 lg:grid-cols-12 gap-12">
      <aside className="lg:col-span-3 space-y-6">
        <div>
          <p className="label-sm text-patina">Collector dossier</p>
          <p className="font-display text-2xl mt-2">{user.fullName || user.email}</p>
        </div>
        <AccountNav />
        <LogoutButton />
      </aside>
      <div className="lg:col-span-9">{children}</div>
    </div>
  );
}
