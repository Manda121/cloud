module.exports = {
  useFirebase: () => {
    return String(process.env.USE_FIREBASE || 'false').toLowerCase() === 'true';
  },
};
function useFirebase() {
  return process.env.USE_FIREBASE === "true";
}

module.exports = { useFirebase };
