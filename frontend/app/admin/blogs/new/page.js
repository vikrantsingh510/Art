import { BlogForm } from '@/components/blog-form';
import { requireAdmin } from '@/lib/session';

export const metadata = { title: 'New journal entry' };

export default async function NewBlogPage() {
  await requireAdmin();

  return (
    <div className="space-y-8">
      <div>
        <p className="label-sm text-patina">Editorial</p>
        <h1 className="font-display text-4xl mt-2">Write a journal entry</h1>
      </div>
      <BlogForm mode="create" />
    </div>
  );
}
