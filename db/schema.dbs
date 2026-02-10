-- ======================
-- USERS
-- ======================
CREATE TABLE users (
    id_user INTEGER PRIMARY KEY AUTOINCREMENT,

    firebase_uid VARCHAR(128) UNIQUE,
    email VARCHAR(150) UNIQUE NOT NULL,
    password VARCHAR(255),

    firstname VARCHAR(100),
    lastname VARCHAR(100),

    id_role INTEGER,
    attempts INTEGER DEFAULT 0,
    blocked BOOLEAN DEFAULT FALSE,
    synced_from_firebase BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ======================
-- ROLES
-- ======================
CREATE TABLE roles (
    id_role INTEGER PRIMARY KEY AUTOINCREMENT,
    nom VARCHAR(30) UNIQUE NOT NULL
);

-- ======================
-- SESSIONS
-- ======================
CREATE TABLE sessions (
    id_session VARCHAR(36) PRIMARY KEY,
    id_user INTEGER NOT NULL,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (id_user) REFERENCES users(id_user)
);

-- ======================
-- STATUTS SIGNALEMENT
-- ======================
CREATE TABLE statuts_signalement (
    id_statut INTEGER PRIMARY KEY AUTOINCREMENT,
    libelle VARCHAR(30) UNIQUE NOT NULL
);

-- ======================
-- ENTREPRISES
-- ======================
CREATE TABLE entreprises (
    id_entreprise INTEGER PRIMARY KEY AUTOINCREMENT,
    nom VARCHAR(150) NOT NULL,
    contact VARCHAR(100)
);

-- ======================
-- SIGNALEMENTS
-- ======================
CREATE TABLE signalements (
    id_signalement VARCHAR(36) PRIMARY KEY,

    id_user INTEGER,
    id_statut INTEGER,
    id_entreprise INTEGER,

    description TEXT,
    surface_m2 NUMERIC(10,2),
    budget NUMERIC(14,2),
    date_signalement DATE,

    -- Cartographie (compatible DbSchema)
    latitude DECIMAL(9,6),
    longitude DECIMAL(9,6),

    -- Synchronisation
    source VARCHAR(20),
    synced BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (id_user) REFERENCES users(id_user),
    FOREIGN KEY (id_statut) REFERENCES statuts_signalement(id_statut),
    FOREIGN KEY (id_entreprise) REFERENCES entreprises(id_entreprise)
);

-- ======================
-- HISTORIQUE STATUTS
-- ======================
CREATE TABLE historique_statuts (
    id_historique INTEGER PRIMARY KEY AUTOINCREMENT,
    id_signalement VARCHAR(36),
    id_statut INTEGER,
    date_changement TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    id_manager INTEGER,

    FOREIGN KEY (id_signalement) REFERENCES signalements(id_signalement),
    FOREIGN KEY (id_statut) REFERENCES statuts_signalement(id_statut),
    FOREIGN KEY (id_manager) REFERENCES users(id_user)
);
