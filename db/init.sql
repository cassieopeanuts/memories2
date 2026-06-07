-- Enable UUID generation extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    yandex_id VARCHAR(255) UNIQUE,
    sber_id VARCHAR(255) UNIQUE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    storage_limit BIGINT NOT NULL DEFAULT 1073741824, -- 1 GB default free storage
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Photos table
CREATE TABLE IF NOT EXISTS photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    s3_key VARCHAR(512) NOT NULL UNIQUE,
    original_name VARCHAR(255) NOT NULL,
    size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexing for speed
CREATE INDEX IF NOT EXISTS idx_photos_user_id ON photos(user_id);
CREATE INDEX IF NOT EXISTS idx_users_yandex_id ON users(yandex_id);
CREATE INDEX IF NOT EXISTS idx_users_sber_id ON users(sber_id);
