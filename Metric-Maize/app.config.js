module.exports = ({ config }) => {
  return {
    ...config,
    android: {
      ...config.android,
      intentFilters: [
        ...(config.android?.intentFilters || [])
      ]
    }
  };
};