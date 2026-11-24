import { Suspense } from 'react';
import { ExploreFilters, ExploreFiltersFallback } from '@/components/explore-filters';
import { ExplorePendingProvider, ExploreResults } from '@/components/explore-pending';
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
        <ExplorePendingProvider>
          <Suspense fallback={<ExploreFiltersFallback />}>
            <ExploreFilters categories={categories} />
          </Suspense>
          <ExploreResults>
            {children}
          </ExploreResults>
        </ExplorePendingProvider>
      </div>
    </div>
  );
}
