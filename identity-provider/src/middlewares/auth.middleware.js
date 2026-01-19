const jwt = require('jsonwebtoken');
const { initFirebase } = require('../config/firebase');
const selector = require('../services/auth.selector');

module.exports = async (req, res, next) => {
  const header = req.headers.authorization;
  const token = header?.split(' ')[1];
  if (!token) return res.sendStatus(401);

  if (selector.useFirebase()) {
    try {
      const admin = initFirebase();
      const decoded = await admin.auth().verifyIdToken(token);
      req.user = decoded;
      return next();
    } catch (e) {
      return res.sendStatus(403);
    }
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (e) {
    res.sendStatus(403);
  }
};
