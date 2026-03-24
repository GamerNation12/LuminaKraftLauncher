-- ============================================================================
-- LuminaKraft Launcher - Supabase Database Setup Script
-- Paste this entire file into your Supabase SQL Editor and run it!
-- ============================================================================

-- 1. Enable UUID Extension (usually enabled by default)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- TABLES
-- ============================================================================

-- 2. Create PARTNERS Table
CREATE TABLE IF NOT EXISTS public.partners (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    logo_url TEXT,
    website_url TEXT,
    discord_invite TEXT,
    discord_role_id TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create USERS Table
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    microsoft_id TEXT UNIQUE,
    microsoft_linked_at TIMESTAMP WITH TIME ZONE,
    discord_id TEXT UNIQUE,
    discord_username TEXT,
    discord_global_name TEXT,
    discord_avatar TEXT,
    discord_linked_at TIMESTAMP WITH TIME ZONE,
    display_name TEXT,
    avatar_url TEXT,
    email TEXT,
    minecraft_username TEXT,
    minecraft_uuid TEXT UNIQUE,
    minecraft_username_history JSONB,
    is_minecraft_verified BOOLEAN DEFAULT false,
    is_discord_member BOOLEAN DEFAULT false,
    discord_member_since TIMESTAMP WITH TIME ZONE,
    last_discord_sync TIMESTAMP WITH TIME ZONE,
    discord_roles JSONB,
    has_partner_role BOOLEAN DEFAULT false,
    partner_id UUID REFERENCES public.partners(id),
    role TEXT DEFAULT 'user' NOT NULL CHECK (role IN ('admin', 'partner', 'user')),
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Create MODPACKS Table
CREATE TABLE IF NOT EXISTS public.modpacks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug TEXT UNIQUE NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('official', 'partner', 'community')),
    name_i18n JSONB NOT NULL, -- Format: { "en": "Name", "es": "Nombre" }
    short_description_i18n JSONB NOT NULL,
    description_i18n JSONB NOT NULL,
    version TEXT NOT NULL,
    minecraft_version TEXT NOT NULL,
    modloader TEXT NOT NULL CHECK (modloader IN ('forge', 'fabric', 'neoforge', 'quilt')),
    modloader_version TEXT NOT NULL,
    recommended_ram INTEGER,
    gamemode TEXT,
    server_ip TEXT,
    primary_color TEXT,
    author_id UUID REFERENCES public.users(id),
    partner_id UUID REFERENCES public.partners(id),
    upload_status TEXT DEFAULT 'pending' CHECK (upload_status IN ('pending', 'completed')),
    is_active BOOLEAN DEFAULT false,
    is_coming_soon BOOLEAN DEFAULT false,
    is_new BOOLEAN DEFAULT false,
    allow_custom_mods BOOLEAN DEFAULT true,
    allow_custom_resourcepacks BOOLEAN DEFAULT true,
    logo_url TEXT,
    banner_url TEXT,
    youtube_embed TEXT,
    tiktok_embed TEXT,
    published_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Create MODPACK_VERSIONS Table
CREATE TABLE IF NOT EXISTS public.modpack_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    modpack_id UUID REFERENCES public.modpacks(id) ON DELETE CASCADE NOT NULL,
    version TEXT NOT NULL,
    minecraft_version TEXT,
    modloader_version TEXT,
    changelog_i18n JSONB,
    file_url TEXT,
    sha256 TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Create MODPACK_FEATURES Table
CREATE TABLE IF NOT EXISTS public.modpack_features (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    modpack_id UUID REFERENCES public.modpacks(id) ON DELETE CASCADE NOT NULL,
    title_i18n JSONB NOT NULL,
    description_i18n JSONB,
    icon TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Create MODPACK_IMAGES Table
CREATE TABLE IF NOT EXISTS public.modpack_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    modpack_id UUID REFERENCES public.modpacks(id) ON DELETE CASCADE NOT NULL,
    image_path TEXT,
    image_url TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    size_bytes INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. Create MODPACK_COLLABORATORS Table
CREATE TABLE IF NOT EXISTS public.modpack_collaborators (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    modpack_id UUID REFERENCES public.modpacks(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    role TEXT DEFAULT 'editor',
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================================
-- FUNCTIONS / RPCs
-- ============================================================================

-- 9. Create aggregate stats stub
-- Code seeks: supabase.rpc('get_modpack_aggregate_stats', { p_modpack_id: ... })
CREATE OR REPLACE FUNCTION public.get_modpack_aggregate_stats(p_modpack_id UUID)
RETURNS JSONB AS $$
BEGIN
    RETURN jsonb_build_object(
        'downloads_total', 100, -- Dummy data
        'likes_total', 5
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Create modpacks translated view function
-- Code seeks: supabase.rpc('modpacks_i18n', { p_language: ... })
CREATE OR REPLACE FUNCTION public.modpacks_i18n(p_language TEXT DEFAULT 'en')
RETURNS SETOF public.modpacks AS $$
BEGIN
    RETURN QUERY SELECT * FROM public.modpacks WHERE is_active = true OR is_coming_soon = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
