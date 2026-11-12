import { Suspense } from 'react';
import { ExploreFilters, ExploreFiltersFallback } from '@/components/explore-filters';
import { PageIntro } from '@/components/ui';
import { api } from '@/lib/api';

export default async function ExploreLayout({ children }) {
  let categories = [];
  try {
    const categoryList = await api.listCategories();
    categories = Array.isArray(categoryList) ? categoryList : [];
  } catch {
    categories = [];
  }

  return (
    <div>
      <PageIntro
        eyebrow="Authentic canvas & pigment registry"
        title="The permanent collection & recent acquisitions"
        description="Browse singular, non-reproducible original paintings. Refine the hanging by search, category or acquisition value."
      />
      <div className="page-shell pb-20 space-y-10">
        <Suspense fallback={<ExploreFiltersFallback />}>
          <ExploreFilters categories={categories} />
        </Suspense>
        {children}
      </div>
    </div>
  );
}
