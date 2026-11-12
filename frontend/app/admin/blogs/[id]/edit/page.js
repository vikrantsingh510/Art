import { notFound } from 'next/navigation';
import { BlogForm } from '@/components/blog-form';
import { ErrorState } from '@/components/states';
import { api, ApiClientError } from '@/lib/api';
import { requireAdmin } from '@/lib/session';

export const metadata = { title: 'Edit journal entry' };

export default async function EditBlogPage({ params }) {
  const { id } = await params;
  const { token } = await requireAdmin();

  let blog;
  try {
    blog = await api.adminBlog(id, { token });
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 404) {
      notFound();
    }
    return <ErrorState error={error} />;
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="label-sm text-patina">{blog.status}</p>
        <h1 className="font-display text-4xl mt-2">Edit {blog.title}</h1>
      </div>
      <BlogForm mode="edit" blog={blog} />
    </div>
  );
}
