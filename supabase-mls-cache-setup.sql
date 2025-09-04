-- ===================================================================
-- OPTIMIZED MLS GEOCODING CACHE SYSTEM FOR SUPABASE
-- Designed for processing 100K+ records efficiently
-- ===================================================================

-- 1. Tabla de caché de geocoding (Mapbox/Geocodio)
CREATE TABLE IF NOT EXISTS mls_geocoding_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  address_hash VARCHAR(64) UNIQUE NOT NULL, -- SHA256 hash of normalized address
  original_address TEXT NOT NULL,
  normalized_address TEXT NOT NULL,
  
  -- Geocoding results
  formatted_address TEXT,
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  accuracy DECIMAL(5,2),
  confidence DECIMAL(5,2),
  
  -- Geographic components
  street_number TEXT,
  street_name TEXT,
  neighborhood TEXT,
  locality TEXT,
  city TEXT,
  county TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'US',
  
  -- API source tracking
  api_source VARCHAR(20) NOT NULL, -- 'mapbox', 'geocodio'
  api_raw_response JSONB,
  
  -- Cache metadata
  hit_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days')
);

-- 2. Tabla de caché de Gemini (neighborhoods/communities)
CREATE TABLE IF NOT EXISTS mls_gemini_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_hash VARCHAR(64) UNIQUE NOT NULL, -- SHA256 of address+city+county
  
  -- Input parameters
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  county TEXT NOT NULL,
  state TEXT DEFAULT 'FL',
  
  -- Gemini results
  neighborhood TEXT,
  community TEXT,
  neighborhood_confidence DECIMAL(3,2), -- 0.00-1.00
  community_confidence DECIMAL(3,2),
  
  -- Response metadata
  gemini_response JSONB,
  processing_time_ms INTEGER,
  
  -- Cache metadata
  hit_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 days')
);

-- 3. Tabla de jobs de procesamiento batch
CREATE TABLE IF NOT EXISTS mls_processing_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name VARCHAR(255) NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  -- Job configuration
  total_records INTEGER NOT NULL,
  batch_size INTEGER DEFAULT 1000,
  concurrency_limit INTEGER DEFAULT 20,
  
  -- Processing status
  status VARCHAR(20) DEFAULT 'pending', -- pending, running, completed, failed, cancelled
  current_batch INTEGER DEFAULT 0,
  processed_records INTEGER DEFAULT 0,
  successful_records INTEGER DEFAULT 0,
  failed_records INTEGER DEFAULT 0,
  
  -- API usage tracking
  mapbox_requests INTEGER DEFAULT 0,
  geocodio_requests INTEGER DEFAULT 0,
  gemini_requests INTEGER DEFAULT 0,
  cache_hits INTEGER DEFAULT 0,
  
  -- Progress tracking
  progress_percentage DECIMAL(5,2) DEFAULT 0,
  estimated_completion_time TIMESTAMP WITH TIME ZONE,
  average_processing_time_ms INTEGER,
  
  -- Error tracking
  error_message TEXT,
  error_details JSONB,
  
  -- Metadata
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Tabla de resultados de procesamiento (temporal)
CREATE TABLE IF NOT EXISTS mls_processing_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES mls_processing_jobs(id) ON DELETE CASCADE,
  batch_number INTEGER NOT NULL,
  record_index INTEGER NOT NULL,
  
  -- Original data
  original_data JSONB NOT NULL,
  original_address TEXT NOT NULL,
  
  -- Processed results
  status VARCHAR(20) NOT NULL, -- success, error, skipped
  formatted_address TEXT,
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  
  -- Geographic data
  neighborhood TEXT,
  community TEXT,
  
  -- Source tracking
  geocoding_source VARCHAR(20), -- mapbox, geocodio, cache
  neighborhood_source VARCHAR(20), -- gemini, mapbox, cache
  
  -- Processing metadata
  processing_time_ms INTEGER,
  cached_result BOOLEAN DEFAULT FALSE,
  error_message TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Tabla de métricas de performance
CREATE TABLE IF NOT EXISTS mls_processing_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES mls_processing_jobs(id) ON DELETE CASCADE,
  
  -- Performance metrics
  timestamp_bucket TIMESTAMP WITH TIME ZONE NOT NULL, -- Rounded to minute
  records_processed INTEGER DEFAULT 0,
  avg_processing_time_ms INTEGER,
  
  -- API metrics
  mapbox_requests INTEGER DEFAULT 0,
  geocodio_requests INTEGER DEFAULT 0,
  gemini_requests INTEGER DEFAULT 0,
  cache_hits INTEGER DEFAULT 0,
  
  -- Error metrics
  timeout_errors INTEGER DEFAULT 0,
  rate_limit_errors INTEGER DEFAULT 0,
  other_errors INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===================================================================
-- ÍNDICES PARA OPTIMIZACIÓN DE PERFORMANCE
-- ===================================================================

-- Geocoding cache indices
CREATE INDEX IF NOT EXISTS idx_geocoding_cache_hash ON mls_geocoding_cache(address_hash);
CREATE INDEX IF NOT EXISTS idx_geocoding_cache_expires ON mls_geocoding_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_geocoding_cache_last_used ON mls_geocoding_cache(last_used_at);
CREATE INDEX IF NOT EXISTS idx_geocoding_cache_api_source ON mls_geocoding_cache(api_source);

-- Gemini cache indices
CREATE INDEX IF NOT EXISTS idx_gemini_cache_hash ON mls_gemini_cache(location_hash);
CREATE INDEX IF NOT EXISTS idx_gemini_cache_expires ON mls_gemini_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_gemini_cache_last_used ON mls_gemini_cache(last_used_at);
CREATE INDEX IF NOT EXISTS idx_gemini_cache_location ON mls_gemini_cache(city, county);

-- Processing jobs indices
CREATE INDEX IF NOT EXISTS idx_processing_jobs_status ON mls_processing_jobs(status);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_user_id ON mls_processing_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_created_at ON mls_processing_jobs(created_at);

-- Processing results indices
CREATE INDEX IF NOT EXISTS idx_processing_results_job_id ON mls_processing_results(job_id);
CREATE INDEX IF NOT EXISTS idx_processing_results_batch ON mls_processing_results(job_id, batch_number);
CREATE INDEX IF NOT EXISTS idx_processing_results_status ON mls_processing_results(status);

-- Metrics indices
CREATE INDEX IF NOT EXISTS idx_metrics_job_timestamp ON mls_processing_metrics(job_id, timestamp_bucket);
CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON mls_processing_metrics(timestamp_bucket);

-- ===================================================================
-- FUNCIONES UTILITARIAS
-- ===================================================================

-- Función para generar hash de dirección
CREATE OR REPLACE FUNCTION generate_address_hash(address TEXT, city TEXT DEFAULT '', county TEXT DEFAULT '')
RETURNS TEXT AS $$
BEGIN
  RETURN encode(digest(
    lower(trim(coalesce(address, ''))) || '|' || 
    lower(trim(coalesce(city, ''))) || '|' || 
    lower(trim(coalesce(county, '')))
    , 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Función para limpiar caché expirado
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS void AS $$
BEGIN
  -- Limpiar geocoding cache expirado
  DELETE FROM mls_geocoding_cache WHERE expires_at < NOW();
  
  -- Limpiar gemini cache expirado
  DELETE FROM mls_gemini_cache WHERE expires_at < NOW();
  
  -- Limpiar jobs completados más antiguos que 30 días
  DELETE FROM mls_processing_jobs 
  WHERE status IN ('completed', 'failed', 'cancelled') 
  AND completed_at < NOW() - INTERVAL '30 days';
  
  -- Limpiar métricas más antiguas que 90 días
  DELETE FROM mls_processing_metrics 
  WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- Función para actualizar métricas de job
CREATE OR REPLACE FUNCTION update_job_metrics(
  p_job_id UUID,
  p_processed INTEGER DEFAULT 0,
  p_successful INTEGER DEFAULT 0,
  p_failed INTEGER DEFAULT 0,
  p_mapbox_requests INTEGER DEFAULT 0,
  p_geocodio_requests INTEGER DEFAULT 0,
  p_gemini_requests INTEGER DEFAULT 0,
  p_cache_hits INTEGER DEFAULT 0
)
RETURNS void AS $$
BEGIN
  UPDATE mls_processing_jobs 
  SET 
    processed_records = processed_records + p_processed,
    successful_records = successful_records + p_successful,
    failed_records = failed_records + p_failed,
    mapbox_requests = mapbox_requests + p_mapbox_requests,
    geocodio_requests = geocodio_requests + p_geocodio_requests,
    gemini_requests = gemini_requests + p_gemini_requests,
    cache_hits = cache_hits + p_cache_hits,
    progress_percentage = (processed_records + p_processed) * 100.0 / total_records,
    updated_at = NOW()
  WHERE id = p_job_id;
END;
$$ LANGUAGE plpgsql;

-- ===================================================================
-- ROW LEVEL SECURITY
-- ===================================================================

ALTER TABLE mls_geocoding_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE mls_gemini_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE mls_processing_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE mls_processing_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE mls_processing_metrics ENABLE ROW LEVEL SECURITY;

-- Políticas para permitir acceso completo al service role
CREATE POLICY "Service role can manage geocoding cache" ON mls_geocoding_cache
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage gemini cache" ON mls_gemini_cache
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage processing jobs" ON mls_processing_jobs
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage processing results" ON mls_processing_results
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage processing metrics" ON mls_processing_metrics
  FOR ALL USING (auth.role() = 'service_role');

-- ===================================================================
-- COMENTARIOS DE DOCUMENTACIÓN
-- ===================================================================

COMMENT ON TABLE mls_geocoding_cache IS 'Caché distribuido para resultados de geocoding de Mapbox y Geocodio';
COMMENT ON TABLE mls_gemini_cache IS 'Caché distribuido para resultados de neighborhoods/communities de Gemini';
COMMENT ON TABLE mls_processing_jobs IS 'Jobs de procesamiento batch para datasets grandes';
COMMENT ON TABLE mls_processing_results IS 'Resultados temporales de procesamiento batch';
COMMENT ON TABLE mls_processing_metrics IS 'Métricas de performance agregadas por minuto';

COMMENT ON FUNCTION generate_address_hash(TEXT, TEXT, TEXT) IS 'Genera hash SHA256 consistente para direcciones';
COMMENT ON FUNCTION cleanup_expired_cache() IS 'Limpia caché expirado y datos antiguos';
COMMENT ON FUNCTION update_job_metrics(UUID, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER) IS 'Actualiza métricas de job de procesamiento';
