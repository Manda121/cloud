DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS user_fcm_tokens CASCADE;

CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    id_user INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    id_signalement UUID REFERENCES signalements(id_signalement) ON DELETE SET NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'status_change',
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSONB,
    old_status INTEGER,
    new_status INTEGER,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_fcm_tokens (
    id SERIAL PRIMARY KEY,
    id_user INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    fcm_token TEXT NOT NULL,
    device_type VARCHAR(20) DEFAULT 'mobile',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(id_user, fcm_token)
);
