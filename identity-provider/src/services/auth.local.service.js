const db = require('../config/database');
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const MAX_ATTEMPTS = parseInt(process.env.MAX_ATTEMPTS || 3);

async function register(data) {
  const hash = await bcrypt.hash(data.password, 10);

  const result = await db.query(
    `INSERT INTO users (email, password, firstname, lastname)
     VALUES ($1,$2,$3,$4)
     RETURNING id,email`,
    [data.email, hash, data.firstname, data.lastname]
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
    { id: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.SESSION_DURATION || "1h" }
  );

  return { token };
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
  login,
  updateUser,
  unblockUser,
};
