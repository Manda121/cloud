// Minimal placeholder for Firebase-backed auth service
module.exports = {
  createUser: async (userData) => {
    throw new Error('auth.firebase.service.createUser not implemented');
  },
  verifyToken: async (token) => {
    throw new Error('auth.firebase.service.verifyToken not implemented');
  }
};
