import { Notice } from '@/components/ui';
import { ProfileForm } from '@/components/profile-form';
import { requireUser } from '@/lib/session';

export const metadata = { title: 'Profile' };

export default async function ProfilePage() {
  const { user } = await requireUser();

  return (
    <div className="space-y-8 max-w-xl">
      <h1 className="font-display text-4xl">Profile</h1>
      <Notice>
        You can update name and phone. Email stays with Google sign-in. Role and admin access cannot be edited here.
      </Notice>
      <ProfileForm user={user} />
    </div>
  );
}
