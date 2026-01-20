const localAuth = require('../services/auth.local.service');
const firebaseAuth = require('../services/auth.firebase.service');
const selector = require('../services/auth.selector');

exports.register = async (req, res) => {
  try {
    let result;
    if (selector.useFirebase()) {
      // Prefer server-side REST sign-up (email/password) if provided
      if (req.body.email && req.body.password) {
        result = await firebaseAuth.serverSignUp(req.body.email, req.body.password);
      } else {
        result = await firebaseAuth.register(req.body);
      }
    } else {
      result = await localAuth.register(req.body);
    }

    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

exports.login = async (req, res) => {
  try {
    if (selector.useFirebase()) {
      // Accept either idToken (client-side) or email+password (server-side sign-in)
      const { idToken, email, password } = req.body;
      if (idToken) {
        const decoded = await firebaseAuth.verifyIdToken(idToken);
        return res.json({ token: idToken, uid: decoded.uid, email: decoded.email });
      }

      if (email && password) {
        const data = await firebaseAuth.serverSignIn(email, password);
        // data contains idToken; verify to get decoded info
        const decoded = await firebaseAuth.verifyIdToken(data.idToken);
        return res.json({ token: data.idToken, uid: decoded.uid, email: decoded.email });
      }

      return res.status(400).json({ error: 'Provide idToken or email+password' });
    }

    // local login: email + password
    const { email, password } = req.body;
    const result = await localAuth.login(email, password);
    // localAuth.login returns { token }
    return res.json({ token: result.token });
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
