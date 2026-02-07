-- Enable required extensions (requires superuser)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS postgis;


CREATE TABLE IF NOT EXISTS users (
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


CREATE TABLE IF NOT EXISTS roles (
        id_role SERIAL PRIMARY KEY,
        nom VARCHAR(30) UNIQUE NOT NULL
);

INSERT INTO roles (nom) VALUES
('VISITEUR'),
('UTILISATEUR'),

('MANAGER');

CREATE TABLE IF NOT EXISTS sessions (
    id_session UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    id_user INTEGER REFERENCES users(id) ON DELETE CASCADE
    token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS statuts_signalement (
    id_statut SERIAL PRIMARY KEY,
    libelle VARCHAR(30) UNIQUE NOT NULL
);

INSERT INTO statuts_signalement (libelle) VALUES
('NOUVEAU'),
('EN_COURS'),
('TERMINE')
ON CONFLICT (libelle) DO NOTHING;



CREATE TABLE IF NOT EXISTS entreprises (
    id_entreprise SERIAL PRIMARY KEY,
    nom VARCHAR(150) NOT NULL,
    contact VARCHAR(100)
);


CREATE TABLE IF NOT EXISTS signalements (
    id_signalement UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    id_user INTEGER REFERENCES users(id),
    id_statut INT REFERENCES statuts_signalement(id_statut),
    id_entreprise INT REFERENCES entreprises(id_entreprise),
    description TEXT,
    surface_m2 NUMERIC(10,2),
    budget NUMERIC(14,2),
    date_signalement DATE DEFAULT CURRENT_DATE,

    -- Cartographie (PostGIS geometry)
    geom geometry(Point, 4326),

    -- Synchronisation
    source VARCHAR(20) CHECK (source IN ('LOCAL', 'FIREBASE')),
    synced BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table pour stocker les 
s associées aux signalements
CREATE TABLE IF NOT EXISTS signalement_photos (
    id_photo SERIAL PRIMARY KEY,
    id_signalement UUID REFERENCES signalements(id_signalement) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    path TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS historique_statuts (
    id_historique SERIAL PRIMARY KEY,
    id_signalement UUID REFERENCES signalements(id_signalement) ON DELETE CASCADE,
    id_statut INT REFERENCES statuts_signalement(id_statut),
    date_changement TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    id_manager INTEGER REFERENCES users(id)
);

CREATE OR REPLACE VIEW v_stats_globales AS(
    id_manager UUID REFERENCES users(id_user)
);


CREATE VIEW v_stats_globales AS
SELECT
    COUNT(*) AS nb_signalements,
    SUM(surface_m2) AS surface_totale,
    SUM(budget) AS budget_total,
    ROUND(
        (SUM(CASE WHEN id_statut = 3 THEN 1 ELSE 0 END)::NUMERIC / NULLIF(COUNT(*),0)) * 100
    , 2) AS avancement_pourcentage
FROM signalements;


-- Index pour recherche
CREATE INDEX IF NOT EXISTS idx_signalements_geom ON signalements USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_signalements_statut ON signalements(id_statut);
CREATE INDEX IF NOT EXISTS idx_signalements_user ON signalements(id_user);
CREATE INDEX idx_signalements_geom ON signalements USING GIST (geom);
CREATE INDEX idx_signalements_statut ON signalements(id_statut);
CREATE INDEX idx_signalements_user ON signalements(id_user);

-- Index pour rechercher par firebase_uid
CREATE INDEX IF NOT EXISTS idx_users_firebase_uid ON users(firebase_uid);

-- Utilisateur de test (mot de passe non hashé pour test uniquement)
INSERT INTO users (email, password, firstname, lastname) VALUES
('test@gmail.com', 'test123', 'Mandaniaina', 'Notiavina')
ON CONFLICT (email) DO NOTHING;

