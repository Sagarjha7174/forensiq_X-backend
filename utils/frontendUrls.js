const normalizeUrl = (value) => {
  if (!value || typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim().replace(/\/+$/, '');
  return trimmed || null;
};

const getFrontendUrls = () => {
  const envValues = [
    process.env.FRONTEND_URLS,
    process.env.FRONTEND_URL,
    process.env.FRONTEND_URL_1,
    process.env.FRONTEND_URL_2,
  ]
    .filter(Boolean)
    .flatMap((value) => value.split(','));

  return [...new Set(envValues.map(normalizeUrl).filter(Boolean))];
};

const getPrimaryFrontendUrl = () => {
  const frontendUrls = getFrontendUrls();
  return frontendUrls[0] || 'https://forensiq.in';
};

module.exports = {
  getFrontendUrls,
  getPrimaryFrontendUrl,
};