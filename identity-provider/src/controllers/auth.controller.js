const localAuth = require('../services/auth.local.service');
const firebaseAuth = require('../services/auth.firebase.service');
const selector = require('../services/auth.selector');

exports.register = async (req, res) => {
  try {
    const result = selector.useFirebase()
      ? await firebaseAuth.register(req.body)
      : await localAuth.register(req.body);

    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

exports.login = async (req, res) => {
  try {
    if (selector.useFirebase()) {
      // Expect idToken from client when using Firebase
      const { idToken } = req.body;
      if (!idToken) return res.status(400).json({ error: 'idToken required' });
      const decoded = await firebaseAuth.verifyIdToken(idToken);
      return res.json({ uid: decoded.uid, email: decoded.email });
    }

    // local login: email + password
    const { email, password } = req.body;
    const result = await localAuth.login(email, password);
    res.json(result);
  } catch (e) {
    res.status(401).json({ error: e.message });
  }
};

exports.unblock = async (req, res) => {
  try {
    await localAuth.unblockUser(req.body.email);
    res.json({ message: 'Compte débloqué' });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};
