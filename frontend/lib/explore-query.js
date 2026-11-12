export const PRICE_BANDS = [
  { label: 'Under ₹1,00,000', minPricePaise: '', maxPricePaise: '10000000' },
  { label: '₹1,00,000 – ₹3,00,000', minPricePaise: '10000000', maxPricePaise: '30000000' },
  { label: '₹3,00,000+', minPricePaise: '30000000', maxPricePaise: '' },
];

const FILTER_KEYS = ['q', 'categoryId', 'collectionId', 'minPricePaise', 'maxPricePaise', 'featured'];

export function parseExploreQuery(searchParams) {
  return {
    q: searchParams.q || '',
    categoryId: searchParams.categoryId || '',
    collectionId: searchParams.collectionId || '',
    minPricePaise: searchParams.minPricePaise || '',
    maxPricePaise: searchParams.maxPricePaise || '',
    featured: searchParams.featured || '',
    page: searchParams.page || '1',
    limit: searchParams.limit || '18',
  };
}

export function exploreHref(query, page) {
  const params = new URLSearchParams();
  Object.entries({ ...query, page }).forEach(([key, value]) => {
    if (value) {
      params.set(key, String(value));
    }
  });
  const qs = params.toString();
  return qs ? `/explore?${qs}` : '/explore';
}

export function exploreHasActiveFilters(query) {
  return FILTER_KEYS.some((key) => Boolean(query?.[key]));
}

export function clearedExploreQuery(query = {}) {
  return {
    q: '',
    categoryId: '',
    collectionId: '',
    minPricePaise: '',
    maxPricePaise: '',
    featured: '',
    page: 1,
    limit: query.limit || '18',
  };
}

export function priceBandLabel(minPricePaise, maxPricePaise) {
  const min = minPricePaise || '';
  const max = maxPricePaise || '';
  const band = PRICE_BANDS.find(
    (item) => (item.minPricePaise || '') === min && (item.maxPricePaise || '') === max,
  );
  return band?.label || null;
}

export function exploreFilterChips(query, { categories = [] } = {}) {
  const chips = [];
  if (query?.q) {
    chips.push({
      id: 'q',
      group: 'Search',
      label: query.q,
      clear: { q: '' },
    });
  }
  if (query?.categoryId) {
    const category = categories.find((item) => item.id === query.categoryId);
    chips.push({
      id: 'categoryId',
      group: 'Category',
      label: category?.name || 'Selected series',
      clear: { categoryId: '' },
    });
  }
  if (query?.minPricePaise || query?.maxPricePaise) {
    chips.push({
      id: 'price',
      group: 'Acquisition value',
      label: priceBandLabel(query.minPricePaise, query.maxPricePaise) || 'Selected valuation',
      clear: { minPricePaise: '', maxPricePaise: '' },
    });
  }
  return chips;
}
