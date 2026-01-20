CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  firebase_uid TEXT UNIQUE,
  email TEXT UNIQUE NOT NULL,
  password TEXT,
  firstname TEXT,
  lastname TEXT,
  attempts INT DEFAULT 0,
  blocked BOOLEAN DEFAULT FALSE,
  synced_from_firebase BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index pour rechercher par firebase_uid
CREATE INDEX idx_users_firebase_uid ON users(firebase_uid);

-- Utilisateur de test (mot de passe non hashé pour test uniquement)
INSERT INTO users (email, password, firstname, lastname) VALUES
('test@gmail.com', 'test123', 'Mandaniaina', 'Notiavina');