export function parseAdminOrdersQuery(searchParams) {
  return {
    q: searchParams.q || '',
    status: searchParams.status || '',
    paymentStatus: searchParams.paymentStatus || '',
    from: searchParams.from || '',
    to: searchParams.to || '',
    page: searchParams.page || '1',
    limit: searchParams.limit || '20',
  };
}

export function adminOrdersHref(query, page) {
  const params = new URLSearchParams();
  Object.entries({ ...query, page }).forEach(([key, value]) => {
    if (value) {
      params.set(key, String(value));
    }
  });
  const qs = params.toString();
  return qs ? `/admin/orders?${qs}` : '/admin/orders';
}
