const jwt = require('jsonwebtoken');
const { initFirebase } = require('../config/firebase');
const selector = require('../services/auth.selector');

module.exports = async (req, res, next) => {
  const header = req.headers.authorization;
  const token = header?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Missing Authorization Bearer token' });

  // Try preferred mode first, then fallback to the other provider.
  const preferFirebase = selector.useFirebase();
  let lastError;

  const tryFirebase = async () => {
    try {
      const admin = initFirebase();
      const decoded = await admin.auth().verifyIdToken(token);
      req.user = decoded;
      req.userProvider = 'firebase';
      return true;
    } catch (e) {
      lastError = e;
      return false;
    }
  };

  const tryLocal = () => {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
      req.userProvider = 'local';
      return true;
    } catch (e) {
      lastError = e;
      return false;
    }
  };

  const ok = preferFirebase ? (await tryFirebase()) || tryLocal() : tryLocal() || (await tryFirebase());

  if (!ok) {
    console.warn('[Auth] Token verification failed:', lastError?.message || lastError);
    return res.status(403).json({ error: 'Forbidden', reason: 'Invalid or expired token', details: lastError?.message });
  }

  return next();
};
