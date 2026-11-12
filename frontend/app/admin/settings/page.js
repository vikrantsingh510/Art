import { ErrorState } from '@/components/states';
import { WhatsappSettingsForm } from '@/components/whatsapp-settings-form';
import { api } from '@/lib/api';
import { requireAdmin } from '@/lib/session';

export const metadata = { title: 'Settings' };

export default async function AdminSettingsPage() {
  const { token } = await requireAdmin();
  let settings = { enabled: false, e164: '', buttonLabel: '' };
  let loadError = null;

  try {
    settings = await api.adminWhatsappSettings({ token });
  } catch (error) {
    loadError = error;
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="label-sm text-patina">Atelier ledger</p>
        <h1 className="font-display text-4xl mt-2">Settings</h1>
        <p className="mt-3 max-w-xl text-sm text-on-surface-variant">
          WhatsApp Click-to-Chat opens the salon inbox with a pre-filled enquiry. No WhatsApp Business API or webhooks are used.
        </p>
      </div>
      {loadError ? (
        <ErrorState error={loadError} retryHref="/admin/settings" />
      ) : (
        <WhatsappSettingsForm settings={settings} />
      )}
    </div>
  );
}
