# 📋 **Sistema MLS Geocoding Processor**

## Documentación Técnica Completa v2.0

---

## 🏗️ **Arquitectura General**

### **Stack Tecnológico Principal**

- **Framework**: Next.js 15.4.3 con TypeScript
- **Base de Datos**: Supabase (PostgreSQL)
- **Autenticación**: NextAuth v5 con sistema OTP
- **Storage**: Supabase Storage
- **UI/UX**: React 19, Radix UI, Tailwind CSS
- **Estado Global**: Zustand + React Query
- **Procesamiento**: Concurrencia con p-queue, p-retry, p-limit

---

## 🎯 **Propósito del Sistema**

El **Sistema MLS Geocoding Processor** es una aplicación web empresarial diseñada para procesar masivamente archivos de listings inmobiliarios (MLS), enriqueciendo cada registro con información geográfica precisa mediante múltiples APIs de geocoding y servicios de IA.

### **Capacidades Clave:**

- ✅ **Procesamiento Masivo**: Hasta 100,000+ registros MLS
- ✅ **Geocoding Múltiple**: Mapbox, Geocodio, Google
- ✅ **IA Integrada**: Google Gemini para neighborhoods/communities
- ✅ **Sistema de Cache**: Optimización de costos y velocidad
- ✅ **Auto-Save**: Recuperación de sesiones interrumpidas
- ✅ **Reportes Avanzados**: Analytics y métricas detalladas

---

## 🗄️ **Base de Datos - Supabase PostgreSQL**

### **Tablas Principales:**

#### **1. users** - Gestión de Usuarios

```sql
id UUID PRIMARY KEY
email VARCHAR(255) UNIQUE -- Usuario autorizado
name VARCHAR(255)
last_login TIMESTAMP
created_at, updated_at TIMESTAMP
```

#### **2. otp_codes** - Autenticación Temporal

```sql
id UUID PRIMARY KEY
email VARCHAR(255)
code_hash VARCHAR(255) -- Hash SHA256 del código OTP
expires_at TIMESTAMP -- Expiración del código
attempts INTEGER DEFAULT 0
used BOOLEAN DEFAULT FALSE
```

#### **3. user_sessions** - Sesiones Seguras

```sql
id UUID PRIMARY KEY
user_id UUID REFERENCES users(id)
session_token VARCHAR(255) UNIQUE
csrf_token VARCHAR(255) -- Protección CSRF
fingerprint VARCHAR(255) -- Device fingerprinting
ip_address INET
user_agent TEXT
expires_at TIMESTAMP
```

#### **4. mls_completed_files** - Historiales de Procesamiento

```sql
id UUID PRIMARY KEY
user_id UUID REFERENCES users(id)
original_filename VARCHAR
total_records INTEGER
successful_records INTEGER
failed_records INTEGER
mapbox_requests INTEGER -- Contadores de API
geocodio_requests INTEGER
gemini_requests INTEGER
cache_hits INTEGER
storage_path VARCHAR -- Ubicación del archivo procesado
storage_url VARCHAR -- URL de descarga
processing_duration_ms INTEGER
batch_config JSONB -- Configuración utilizada
detected_columns JSONB -- Columnas detectadas
created_at, updated_at TIMESTAMP
```

#### **5. mls_geocoding_cache** - Cache de Geocoding

```sql
id UUID PRIMARY KEY
address_hash VARCHAR(64) UNIQUE -- SHA256 de dirección normalizada
original_address TEXT
normalized_address TEXT
formatted_address TEXT
latitude DECIMAL(10,8)
longitude DECIMAL(11,8)
accuracy, confidence DECIMAL(5,2)
street_number, street_name TEXT
neighborhood, locality, city TEXT
county, state, postal_code TEXT
api_source VARCHAR(20) -- 'mapbox', 'geocodio'
api_raw_response JSONB
hit_count INTEGER DEFAULT 0
expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '7 days')
```

#### **6. mls_gemini_cache** - Cache de IA Neighborhoods

```sql
id UUID PRIMARY KEY
location_hash VARCHAR(64) UNIQUE
address, city, county, state TEXT
neighborhood, community TEXT
neighborhood_confidence DECIMAL(3,2)
community_confidence DECIMAL(3,2)
gemini_response JSONB
processing_time_ms INTEGER
hit_count INTEGER DEFAULT 0
expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '30 days')
```

#### **7. security_logs** - Auditoría de Seguridad

```sql
id UUID PRIMARY KEY
user_id UUID REFERENCES users(id)
event_type VARCHAR(100) -- 'login_attempt', 'csrf_violation', 'rate_limit'
ip_address INET
user_agent TEXT
details JSONB
created_at TIMESTAMP
```

### **Funciones PostgreSQL:**

- `cleanup_expired_otp_codes()` - Limpieza automática de códigos
- `cleanup_expired_sessions()` - Gestión de sesiones
- `log_security_event()` - Registro de eventos de seguridad
- `update_updated_at_column()` - Trigger para timestamps

### **Políticas de Seguridad (RLS):**

- Row Level Security habilitado en todas las tablas
- Solo `service_role` tiene acceso completo
- Políticas específicas por tabla y operación

---

## 🔐 **Sistema de Autenticación**

### **Flujo OTP (One-Time Password):**

1. **Solicitud de OTP**:
   - Usuario ingresa email en `/auth/login`
   - Sistema valida que email esté en tabla `users`
   - Genera código 6 dígitos aleatorio
   - Hash SHA256 del código se almacena en `otp_codes`
   - Envío por email usando Resend API

2. **Verificación**:
   - Usuario ingresa código recibido
   - Sistema valida código contra hash en BD
   - Verificación con rate limiting (max 3 intentos)
   - Código se marca como `used=true` tras uso exitoso

3. **Creación de Sesión**:
   - NextAuth v5 crea sesión segura
   - Generación de CSRF token
   - Device fingerprinting para seguridad
   - Registro en `user_sessions`

### **Componentes de Seguridad:**

- ✅ **Rate Limiting**: Múltiples niveles (general + geocoding)
- ✅ **CSRF Protection**: Tokens únicos por sesión
- ✅ **Security Headers**: CSP, HSTS, frame protection
- ✅ **Input Validation**: Zod schemas en todas las APIs
- ✅ **Audit Logging**: Registro completo de eventos

---

## 📊 **MLS Processor - Motor Principal**

### **Arquitectura del Procesador:**

#### **Hook Principal: `useMLSProcessor-optimized.ts`**

- **Estados Reactivos**: Progreso, resultados, estadísticas
- **Referencias Persistentes**: Contadores API, cache, queue
- **Gestión de Memoria**: Limpieza automática cada 5000ms
- **Recuperación de Sesión**: Auto-save cada 250 registros

#### **Sistema de Batches:**

```typescript
batchConfig = {
  batchSize: 1000, // Registros por batch
  concurrentBatches: 3, // Batches paralelos
  maxRetries: 3, // Reintentos por fallo
  retryDelay: 1000, // Delay entre reintentos
  cacheEnabled: true, // Cache habilitado
  autoSave: true, // Auto-guardado
};
```

#### **Flujo de Procesamiento:**

1. **Carga y Validación**:
   - Soporte: Excel (.xlsx), CSV (.csv)
   - Detección automática de columnas MLS
   - Validación de direcciones requeridas

2. **Procesamiento por Lotes**:
   - División en batches configurables
   - Procesamiento paralelo con p-queue
   - Rate limiting inteligente por API

3. **Geocoding en Cascada**:
   - **Primario**: Mapbox Geocoding API
   - **Secundario**: Geocodio API (fallback)
   - **IA Enhancement**: Google Gemini para neighborhoods

4. **Cache Inteligente**:
   - Hash SHA256 de direcciones normalizadas
   - Cache en memoria + persistencia en Supabase
   - Expiración configurable (7-30 días)

5. **Auto-Save y Recuperación**:
   - Guardado automático cada N registros
   - Recuperación completa de estado
   - Continuación desde último punto

---

## 🌐 **APIs de Geocoding**

### **1. Mapbox Geocoding API** (`/api/geocoding/mapbox`)

```typescript
// Funcionalidades:
- Geocoding de direcciones completas
- Coordenadas precisas (lat/lng)
- Componentes de dirección detallados
- Confidence scoring
- Rate limit: 1000 req/15min
```

### **2. Geocodio API** (`/api/geocoding/geocodio`)

```typescript
// Características:
- Backup para Mapbox
- Geocoding de alta precisión en US
- Información censal adicional
- Validación de direcciones
```

### **3. Google Gemini IA** (`/api/geocoding/gemini-optimized`)

```typescript
// Capacidades:
- Análisis de neighborhoods/communities
- Contextualización geográfica local
- Confidence scoring de resultados
- Optimización con prompts específicos
- Cache extendido (30 días)
```

### **Rate Limiting Diferenciado:**

- **General APIs**: 100 requests/15min
- **Geocoding APIs**: 1000 requests/15min
- **Implementación**: rate-limiter-flexible + Redis-like storage

---

## 💾 **Sistema de Cache Multicapa**

### **Nivel 1: Memoria (Runtime)**

```typescript
class MapboxMemoryCache {
  private cache = new Map<string, CacheEntry>();

  exportEntries(): Record<string, any>;
  importEntries(data: Record<string, any>): void;
  clear(): void;
}
```

### **Nivel 2: LocalStorage (Persistencia Cliente)**

- Cache de sesión para recuperación rápida
- Sincronización automática con memoria
- Limpieza al completar procesamiento

### **Nivel 3: Supabase (Persistencia Global)**

- Cache compartido entre usuarios
- Expiración automática configurada
- Optimización de costos de APIs externas

### **Estrategia de Cache:**

1. **Consulta**: Memoria → LocalStorage → Supabase → API Externa
2. **Almacenamiento**: API → Todos los niveles simultáneamente
3. **Invalidación**: Por tiempo (TTL) y uso (LRU)

---

## 📁 **Sistema de Storage**

### **Supabase Storage Buckets:**

#### **Bucket: `mls-processed-files`**

- **Propósito**: Archivos procesados listos para descarga
- **Estructura**: `/{user_id}/{job_id}/{filename}.xlsx`
- **Políticas**: Acceso autenticado por usuario
- **Retención**: 30 días automático

#### **Políticas de Storage:**

```sql
-- Solo el usuario puede ver sus archivos
CREATE POLICY "Users can view own files" ON storage.objects
FOR SELECT USING (auth.uid()::text = (storage.foldername(name))[1]);

-- Solo el usuario puede subir a su carpeta
CREATE POLICY "Users can upload to own folder" ON storage.objects
FOR INSERT WITH CHECK (auth.uid()::text = (storage.foldername(name))[1]);
```

### **Proceso de Auto-Save:**

1. **Trigger**: Procesamiento 100% completo
2. **Generación**: Archivo Excel con resultados
3. **Upload**: Supabase Storage con metadata
4. **Registro**: Entry en `mls_completed_files`
5. **URL**: Generación de enlace de descarga temporal

---

## 📈 **Sistema de Reportes**

### **Dashboard Analytics** (`/dashboard`)

- **Métricas Tiempo Real**: Archivos procesados hoy
- **Estadísticas Globales**: Total de registros históricos
- **Performance**: Throughput promedio
- **Costos API**: Contadores por servicio

### **Reportes Detallados** (`/reports`)

- **Listado de Jobs**: Histórico completo
- **Filtros Avanzados**: Por fecha, usuario, estado
- **Métricas por Job**: Success rate, timing, API usage
- **Exportación**: CSV, Excel de reportes

### **Actividad de Usuario** (`/api/user/activity`)

- **Tracking**: Última actividad por usuario
- **Sessions**: Tiempo de sesión promedio
- **Patterns**: Análisis de uso

---

## 🛡️ **Seguridad y Middleware**

### **Middleware Stack** (`middleware.ts`):

1. **Autenticación**: NextAuth session validation
2. **Rate Limiting**: Diferenciado por tipo de API
3. **CSRF Protection**: Validación de tokens
4. **Security Headers**: CSP, HSTS, X-Frame-Options
5. **Request Validation**: Origen y estructura
6. **Audit Logging**: Registro de todas las requests

### **Rate Limiting Configuración:**

```typescript
// General APIs
generalAPILimiter: 100 requests/15min

// Geocoding APIs
geocodingAPILimiter: 1000 requests/15min

// Implementación con sliding window
```

### **Security Headers:**

```typescript
Content-Security-Policy: Restrictivo con allowlist específico
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: Minimal permisos
```

---

## ⚙️ **Configuración y Deployment**

### **Variables de Entorno Requeridas:**

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# NextAuth
NEXTAUTH_SECRET=
NEXTAUTH_URL=

# APIs Externas
MAPBOX_ACCESS_TOKEN=
GEOCODIO_API_KEY=
GEMINI_API_KEY=

# Email
RESEND_API_KEY=
```

### **Scripts de Desarrollo:**

```json
"dev": "next dev --turbopack",     // Desarrollo con Turbopack
"build": "next build",             // Build producción
"start": "next start",             // Servidor producción
"lint": "next lint"                // Linting TypeScript
```

---

## 🔄 **Flujo de Trabajo Completo**

### **1. Autenticación de Usuario:**

```
1. Login con email → 2. OTP enviado → 3. Verificación código → 4. Sesión creada
```

### **2. Procesamiento MLS:**

```
1. Upload archivo → 2. Detección columnas → 3. Configuración batch →
4. Procesamiento paralelo → 5. Geocoding + IA → 6. Auto-save → 7. Descarga
```

### **3. Gestión de Datos:**

```
1. Cache check → 2. API externa (si necesario) → 3. Cache update →
4. Resultado normalizado → 5. Estadísticas actualizadas
```

---

## 📊 **Métricas y Performance**

### **Objetivos de Performance:**

- ✅ **Throughput**: 28 registros/segundo (100K en 60 min)
- ✅ **Disponibilidad**: 99.9% uptime
- ✅ **Cache Hit Rate**: >70% para direcciones comunes
- ✅ **Error Rate**: <0.1% en geocoding

### **Monitoreo Incluido:**

- **Real-time**: Progress tracking con ETA
- **Metrics**: API calls, cache hits, error rates
- **Logs**: Structured logging para debugging
- **Alerts**: Rate limiting y error notifications

---

## 🔧 **Módulos y Componentes**

### **Frontend Components:**

- `MLSProcessor` - Interface principal
- `FileUpload` - Carga de archivos con validación
- `ProgressTracking` - Métricas tiempo real
- `ResultsTable` - Visualización de resultados
- `ConfigurationPanel` - Ajustes de procesamiento

### **Backend APIs:**

- `/api/auth/*` - Autenticación y OTP
- `/api/geocoding/*` - Servicios de geocoding
- `/api/mls/*` - Procesamiento y auto-save
- `/api/reports/*` - Reportes y analytics
- `/api/admin/*` - Gestión de usuarios

### **Hooks Personalizados:**

- `useMLSProcessor` - Estado y lógica principal
- `useAutoSave` - Persistencia automática
- `useSecurity` - Validaciones de seguridad

---

## 📋 **Conclusión**

El **Sistema MLS Geocoding Processor** es una solución empresarial completa que combina:

✅ **Escalabilidad**: Procesamiento masivo optimizado  
✅ **Confiabilidad**: Sistema de cache y recuperación  
✅ **Seguridad**: Autenticación OTP y auditoría completa  
✅ **Performance**: APIs múltiples con rate limiting inteligente  
✅ **Usabilidad**: Interface moderna con progreso tiempo real  
✅ **Maintainability**: Código TypeScript estructurado y documentado

---

**Versión**: 2.0  
**Fecha**: Septiembre 2025  
**Estado**: Producción Estable  
**Stack**: Next.js 15 + Supabase + TypeScript
