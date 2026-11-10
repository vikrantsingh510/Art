import { AddressBook } from '@/components/address-book';
import { AddressForm } from '@/components/address-form';
import { Notice } from '@/components/ui';
import { api } from '@/lib/api';
import { requireUser } from '@/lib/session';

export const metadata = { title: 'Addresses' };

export default async function AddressesPage() {
  const { token } = await requireUser();
  const addresses = await api.listAddresses({ token });

  return (
    <div className="space-y-10">
      <h1 className="font-display text-4xl">Addresses</h1>
      <Notice>
        Edit or delete your own addresses. Past orders keep the snapshot taken at reservation. Setting a default clears the previous default.
      </Notice>
      <AddressBook addresses={addresses || []} />
      <div className="max-w-xl">
        <h2 className="font-display text-2xl mb-6">Add an address</h2>
        <AddressForm />
      </div>
    </div>
  );
}
