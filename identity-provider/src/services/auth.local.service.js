// Minimal placeholder for local auth service (e.g., email/password)
module.exports = {
  createUser: async (userData) => {
    throw new Error('auth.local.service.createUser not implemented');
  },
  authenticate: async (credentials) => {
    throw new Error('auth.local.service.authenticate not implemented');
  }
};
