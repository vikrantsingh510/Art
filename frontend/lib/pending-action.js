export function pendingButtonProps(pending) {
  const isPending = Boolean(pending);
  return {
    disabled: isPending,
    'aria-busy': isPending,
  };
}
