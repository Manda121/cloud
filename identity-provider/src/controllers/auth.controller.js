const firebaseService = require('../services/auth.firebase.service');
const localService = require('../services/auth.local.service');

exports.register = async (req, res) => {
  // Placeholder: implement registration logic (choose firebase or local)
  res.status(501).json({ message: 'register not implemented' });
};

exports.login = async (req, res) => {
  // Placeholder: implement login logic
  res.status(501).json({ message: 'login not implemented' });
};
