export function selectDefaultAfterDelete(addresses, deletedId) {
  const remaining = (addresses || [])
    .filter((row) => row.id !== deletedId)
    .slice()
    .sort((a, b) => {
      const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return bTime - aTime;
    });

  return remaining[0] || null;
}

export function shouldPromoteDefault(deleted, remainingDefault) {
  return Boolean(deleted?.isDefault && remainingDefault);
}

export default {
  selectDefaultAfterDelete,
  shouldPromoteDefault,
};
