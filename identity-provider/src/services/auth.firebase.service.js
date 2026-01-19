const { initFirebase } = require('../config/firebase');

async function register(data) {
  const admin = initFirebase();
  const user = await admin.auth().createUser({
    email: data.email,
    password: data.password,
    displayName: `${data.firstname || ''} ${data.lastname || ''}`.trim(),
  });
  const customToken = await admin.auth().createCustomToken(user.uid);
  return { uid: user.uid, email: user.email, token: customToken };
}

async function verifyIdToken(idToken) {
  const admin = initFirebase();
  const decoded = await admin.auth().verifyIdToken(idToken);
  return decoded;
}

async function updateUser(uid, data) {
  const admin = initFirebase();
  await admin.auth().updateUser(uid, {
    displayName: `${data.firstname || ''} ${data.lastname || ''}`.trim(),
  });
}

module.exports = { register, verifyIdToken, updateUser };
