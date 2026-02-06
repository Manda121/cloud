const db = require('../config/database');
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const MAX_ATTEMPTS = parseInt(process.env.MAX_ATTEMPTS || 3);

async function register(data) {
  // Hasher le mot de passe avant insertion
  const hashedPassword = await bcrypt.hash(data.password, 10);

  const result = await db.query(
    `INSERT INTO users (email, password, firstname, lastname)
     VALUES ($1,$2,$3,$4)
     RETURNING id,email`,
    [data.email, hashedPassword, data.firstname, data.lastname]
  );

  return result.rows[0];
}

/**
 * Enregistre un utilisateur créé via Firebase dans la base locale
 * (appelé par le contrôleur après inscription Firebase)
 */
async function registerFromFirebase(data) {
  const hashedPassword = data.password ? await bcrypt.hash(data.password, 10) : null;

  // Vérifier si l'utilisateur existe déjà
  const existing = await db.query('SELECT id FROM users WHERE email = $1', [data.email]);
  
  if (existing.rows.length > 0) {
    // Mettre à jour avec firebase_uid
    const result = await db.query(
      `UPDATE users 
       SET firebase_uid = $1, password = COALESCE($2, password), 
           firstname = COALESCE($3, firstname), lastname = COALESCE($4, lastname),
           synced_from_firebase = true
       WHERE email = $5
       RETURNING id, email, firebase_uid`,
      [data.firebase_uid, hashedPassword, data.firstname, data.lastname, data.email]
    );
    return result.rows[0];
  }

  const result = await db.query(
    `INSERT INTO users (firebase_uid, email, password, firstname, lastname, synced_from_firebase)
     VALUES ($1,$2,$3,$4,$5,true)
     RETURNING id,email,firebase_uid`,
    [data.firebase_uid, data.email, hashedPassword, data.firstname, data.lastname]
  );

  return result.rows[0];
}

async function login(email, password) {
  const result = await db.query(
    "SELECT * FROM users WHERE email=$1",
    [email]
  );

  if (result.rows.length === 0)
    throw new Error("Utilisateur introuvable");

  const user = result.rows[0];

  if (user.blocked)
    throw new Error("Compte bloqué");

  // Vérifier si l'utilisateur a un mot de passe local
  if (!user.password) {
    throw new Error("Cet utilisateur n'a pas de mot de passe local. Veuillez vous connecter en ligne d'abord.");
  }

  const ok = await bcrypt.compare(password, user.password);

  if (!ok) {
    await db.query(
      `UPDATE users
       SET attempts = attempts + 1,
           blocked = (attempts + 1) >= $1
       WHERE id=$2`,
      [MAX_ATTEMPTS, user.id]
    );
    throw new Error("Mot de passe incorrect");
  }

  await db.query(
    "UPDATE users SET attempts=0 WHERE id=$1",
    [user.id]
  );

  const token = jwt.sign(
    { id: user.id, email: user.email, firebase_uid: user.firebase_uid },
    process.env.JWT_SECRET,
    { expiresIn: process.env.SESSION_DURATION || "1h" }
  );

  return { token, user: { id: user.id, email: user.email, firebase_uid: user.firebase_uid } };
}

/**
 * Recherche un utilisateur par email
 */
async function findByEmail(email) {
  const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
  return result.rows[0] || null;
}

/**
 * Recherche un utilisateur par ID
 */
async function findById(id) {
  const result = await db.query('SELECT * FROM users WHERE id = $1', [id]);
  return result.rows[0] || null;
}

/**
 * Recherche un utilisateur par firebase_uid
 */
async function findByFirebaseUid(uid) {
  const result = await db.query('SELECT * FROM users WHERE firebase_uid = $1', [uid]);
  return result.rows[0] || null;
}

async function updateUser(id, data) {
  await db.query(
    `UPDATE users
     SET firstname=$1, lastname=$2
     WHERE id=$3`,
    [data.firstname, data.lastname, id]
  );
}

async function unblockUser(email) {
  await db.query(
    `UPDATE users SET attempts=0, blocked=false WHERE email=$1`,
    [email]
  );
}

module.exports = {
  register,
  registerFromFirebase,
  login,
  findByEmail,
  findById,
  findByFirebaseUid,
  updateUser,
  unblockUser,
};
