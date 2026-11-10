export const PRICE_BANDS = [
  { label: 'Under ₹1,00,000', minPricePaise: '', maxPricePaise: '10000000' },
  { label: '₹1,00,000 – ₹3,00,000', minPricePaise: '10000000', maxPricePaise: '30000000' },
  { label: '₹3,00,000+', minPricePaise: '30000000', maxPricePaise: '' },
];

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
