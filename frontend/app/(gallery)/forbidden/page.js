import { Button, PageIntro } from '@/components/ui';

export const metadata = { title: 'Access denied' };

export default function ForbiddenPage() {
  return (
    <div>
      <PageIntro
        eyebrow="403"
        title="This console is reserved"
        description="Your signed-in identity does not have the admin role assigned in the database."
        actions={<Button href="/" variant="secondary">Return to the exhibition</Button>}
      />
    </div>
  );
}
