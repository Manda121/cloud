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

-- ============================================
-- TABLES DE SYNCHRONISATION
-- ============================================

-- Table des logs de synchronisation
CREATE TABLE IF NOT EXISTS sync_logs (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('SUCCESS', 'ERROR', 'PARTIAL_ERROR', 'COMPLETED')),
    details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des conflits de synchronisation
CREATE TABLE IF NOT EXISTS sync_conflicts (
    id SERIAL PRIMARY KEY,
    id_signalement UUID NOT NULL UNIQUE,
    conflict_type VARCHAR(50) NOT NULL,
    local_data JSONB,
    firebase_data JSONB,
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP,
    resolution VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index pour les logs de sync
CREATE INDEX IF NOT EXISTS idx_sync_logs_event ON sync_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_sync_logs_status ON sync_logs(status);
CREATE INDEX IF NOT EXISTS idx_sync_logs_created ON sync_logs(created_at DESC);

-- Index pour les conflits
CREATE INDEX IF NOT EXISTS idx_sync_conflicts_resolved ON sync_conflicts(resolved);
CREATE INDEX IF NOT EXISTS idx_sync_conflicts_signalement ON sync_conflicts(id_signalement);

-- ============================================
-- TABLES DE NOTIFICATIONS
-- ============================================

-- Table des notifications pour les changements de statut
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    id_user INTEGER REFERENCES users(id) ON DELETE CASCADE,
    id_signalement UUID REFERENCES signalements(id_signalement) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT,
    data JSONB,
    read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table pour tracker les tokens FCM des utilisateurs (Firebase Cloud Messaging)
CREATE TABLE IF NOT EXISTS user_fcm_tokens (
    id SERIAL PRIMARY KEY,
    id_user INTEGER REFERENCES users(id) ON DELETE CASCADE,
    fcm_token TEXT NOT NULL,
    device_type VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(id_user, fcm_token)
);

-- Index pour les notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(id_user);
CREATE INDEX IF NOT EXISTS idx_notifications_signalement ON notifications(id_signalement);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- Index pour les tokens FCM
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_user ON user_fcm_tokens(id_user);

-- Utilisateur de test (mot de passe non hashé pour test uniquement)
INSERT INTO users (email, password, firstname, lastname) VALUES
('test@gmail.com', 'test123', 'Mandaniaina', 'Notiavina')
ON CONFLICT (email) DO NOTHING;



BEGIN;

-- 1) Mettre à jour les statuts
UPDATE signalements
SET id_statut = 2  -- 2 = EN_COURS
WHERE id_signalement = '5b2c7f23-af6c-412a-94e8-bf81fff25a72';

UPDATE signalements
SET id_statut = 3  -- 3 = TERMINE
WHERE id_signalement = 'b130307d-75b9-41d6-a272-0c5ba10b9ae3';

-- 2) Enregistrer l'historique (id_manager optionnel -> mettre NULL ou ton id)
INSERT INTO historique_statuts (id_signalement, id_statut, id_manager)
VALUES
('5b2c7f23-af6c-412a-94e8-bf81fff25a72', 2, NULL),
('b130307d-75b9-41d6-a272-0c5ba10b9ae3', 3, NULL);

-- 3) (Optionnel) marquer comme non synchronisé pour forcer sync si tu utilises un mécanisme de sync
UPDATE signalements
SET synced = FALSE
WHERE id_signalement IN (
  '5b2c7f23-af6c-412a-94e8-bf81fff25a72',
  'b130307d-75b9-41d6-a272-0c5ba10b9ae3'
);

COMMIT;