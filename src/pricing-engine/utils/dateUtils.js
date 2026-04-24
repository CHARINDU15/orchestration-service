const diffInDays = (from, to) => {
  if (!from || !to) return null;
  const start = new Date(from).getTime();
  const end = new Date(to).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  const diffMs = end - start;
  return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
};

module.exports = {
  diffInDays
};
