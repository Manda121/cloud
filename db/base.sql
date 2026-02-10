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

CREATE TABLE sessions (
    id_session UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    id_user INTEGER REFERENCES users(id) ON DELETE CASCADE,
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

-- Table pour stocker les photos associées aux signalements
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

-- Table des notifications
CREATE TABLE IF NOT EXISTS notifications (
    id_notification SERIAL PRIMARY KEY,
    id_user INTEGER REFERENCES users(id) ON DELETE CASCADE,
    id_signalement UUID REFERENCES signalements(id_signalement) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL DEFAULT 'STATUS_CHANGE',
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(id_user);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(id_user, is_read);

CREATE OR REPLACE VIEW v_stats_globales AS
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

-- Index pour rechercher par firebase_uid
CREATE INDEX IF NOT EXISTS idx_users_firebase_uid ON users(firebase_uid);


-- =====================================================
-- DONNÉES DE TEST POUR LES SIGNALEMENTS
-- =====================================================

-- Entreprises de travaux routiers
INSERT INTO entreprises (nom, contact) VALUES
('COLAS Madagascar', 'contact@colas.mg'),
('SOGEA SATOM', 'info@sogea-satom.mg'),
('ENTREPRISE JEAN LEFEBVRE', 'ejl@madagascar.mg');
-- Signalements de travaux routiers à Antananarivo

-- Les coordonnées sont au format PostGIS: ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
INSERT INTO signalements (id_statut, id_entreprise, description, surface_m2, budget, date_signalement, geom, source, synced) VALUES
(1, 1, 'Nid de poule important sur la route principale', 150.00, 5000000.00, '2026-01-15', ST_SetSRID(ST_MakePoint(47.5079, -18.8792), 4326), 'LOCAL', false),
(2, 2, 'Route dégradée nécessitant réfection complète', 300.00, 12000000.00, '2026-01-10', ST_SetSRID(ST_MakePoint(47.5150, -18.8850), 4326), 'LOCAL', false),
(3, 1, 'Fissures sur chaussée - Travaux terminés', 80.00, 2500000.00, '2026-01-05', ST_SetSRID(ST_MakePoint(47.5200, -18.8700), 4326), 'LOCAL', true),
(2, 2, 'Réparation caniveau effondré', 120.00, 4500000.00, '2026-01-19', ST_SetSRID(ST_MakePoint(47.5320, -18.8680), 4326), 'LOCAL', false),
(2, 3, 'Réhabilitation du tronçon Analakely', 450.00, 15000000.00, '2026-01-18', ST_SetSRID(ST_MakePoint(47.5250, -18.8750), 4326), 'LOCAL', false),
(1, NULL, 'Trou dangereux près du marché Analakely', 50.00, 2000000.00, '2026-01-22', ST_SetSRID(ST_MakePoint(47.5195, -18.9055), 4326), 'LOCAL', false),
(1, NULL, 'Affaissement de la chaussée', 200.00, 8000000.00, '2026-01-20', ST_SetSRID(ST_MakePoint(47.4950, -18.8900), 4326), 'LOCAL', false),
(3, 1, 'Revêtement route Ankorondrano terminé', 500.00, 25000000.00, '2026-01-08', ST_SetSRID(ST_MakePoint(47.5080, -18.8650), 4326), 'LOCAL', true);
CREATE OR REPLACE VIEW v_signalements_details AS
-- Vue enrichie des signalements avec les noms d'entreprise

SELECT 
    s.id_signalement,
    s.id_user,
    s.id_statut,
    s.id_entreprise,
    st.libelle AS statut_libelle,
    e.nom AS entreprise_nom,
    s.description,
    s.surface_m2,
    s.budget,
    s.date_signalement,
    ST_X(s.geom) AS longitude,
    ST_Y(s.geom) AS latitude,
    s.source,
    s.synced,
    s.created_at
FROM signalements s
LEFT JOIN statuts_signalement st ON s.id_statut = st.id_statut
LEFT JOIN entreprises e ON s.id_entreprise = e.id_entreprise
ORDER BY s.date_signalement DESC;

-- new

CREATE TABLE type_reparation(
   id_typereparation INTEGER,
   nom_reparation VARCHAR(50)  NOT NULL,
   PRIMARY KEY(id_typereparation)
);

CREATE TABLE Traveaux(
   id_traveaux INTEGER,
   niveau_reparation INTEGER NOT NULL,
   id_typereparation INTEGER NOT NULL,
   id_signalement UUID DEFAULT uuid_generate_v4() NOT NULL,
   PRIMARY KEY(id_traveaux),
   FOREIGN KEY(id_typereparation) REFERENCES type_reparation(id_typereparation),
   FOREIGN KEY(id_signalement) REFERENCES signalements(id_signalement)
);
