import Link from 'next/link';
import { Pagination } from '@/components/pagination';
import { EmptyState, ErrorState } from '@/components/states';
import { Button } from '@/components/ui';
import { api } from '@/lib/api';
import { requireAdmin } from '@/lib/session';

export const metadata = { title: 'Journal' };

export default async function AdminBlogsPage({ searchParams }) {
  const params = await searchParams;
  const { token } = await requireAdmin();
  const page = params.page || '1';
  const status = params.status || '';
  const q = params.q || '';
  let data = { items: [], total: 0, page: 1, limit: 20 };
  let loadError = null;
  try {
    data = await api.adminBlogs({ page, limit: 20, status, q }, { token });
  } catch (error) {
    loadError = error;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="label-sm text-patina">Editorial ledger</p>
          <h1 className="font-display text-4xl mt-2">Journal</h1>
        </div>
        <Button href="/admin/blogs/new">Write an entry</Button>
      </div>
      <form className="flex flex-wrap gap-4 items-end" action="/admin/blogs">
        <label>
          <span className="label-md text-patina">Search</span>
          <input className="field-input" name="q" defaultValue={q} />
        </label>
        <label>
          <span className="label-md text-patina">Status</span>
          <select className="field-input" name="status" defaultValue={status}>
            <option value="">All</option>
            {['draft', 'published'].map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </label>
        <button className="btn-secondary" type="submit">Filter</button>
      </form>
      {loadError ? (
        <ErrorState error={loadError} retryHref="/admin/blogs" />
      ) : (data.items || []).length === 0 ? (
        <EmptyState title="No journal entries in this filter" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="label-md text-patina border-b border-fillet">
                <th className="py-3">Title</th>
                <th>Slug</th>
                <th>Status</th>
                <th>Published</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((blog) => (
                <tr key={blog.id} className="border-b border-fillet">
                  <td className="py-4">
                    <Link href={`/admin/blogs/${blog.id}/edit`}>{blog.title}</Link>
                  </td>
                  <td>{blog.slug}</td>
                  <td>{blog.status}</td>
                  <td>{blog.publishedAt ? new Date(blog.publishedAt).toLocaleDateString('en-IN') : '—'}</td>
                  <td>
                    {blog.status === 'published' ? (
                      <Link href={`/journal/${blog.slug}`} className="text-link">View</Link>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination
        page={data.page}
        limit={data.limit}
        total={data.total}
        makeHref={(next) => {
          const search = new URLSearchParams({ q, status, page: String(next) });
          return `/admin/blogs?${search.toString()}`;
        }}
      />
    </div>
  );
}
