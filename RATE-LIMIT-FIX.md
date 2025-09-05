# 🔧 Solución al Error 429 "Too Many Requests" - MLS Processor

## 📋 Problema Identificado

El error 429 "Too Many Requests" que se presenta al hacer STOP y CONTINUE en el procesamiento de archivos MLS era causado por el **middleware general del sistema** que aplica rate limiting muy restrictivo.

### 🔍 Análisis del Problema

1. **Middleware Rate Limiting**: El `generalAPILimiter` aplicaba un límite de **100 requests por 15 minutos** a TODAS las rutas API
2. **Incluía APIs de Geocoding**: Este límite afectaba `/api/geocoding/gemini-optimized` y otras APIs de geocoding
3. **Escenario del Error**:
   - Primer archivo (30 rows): Usaba ~30 requests ✅
   - Stop y Continue en segundo archivo: Ya se habían usado requests del primer archivo
   - Al continuar: Se necesitaban más requests → Se excedían las 100 requests/15min → Error 429

## 🛠️ Soluciones Implementadas

### 1. Rate Limiter Específico para Geocoding

**Archivo**: `lib/rate-limiting.ts`

```typescript
// Rate limiter específico para APIs de geocoding (más permisivo)
export const geocodingAPILimiter = new RateLimiterMemory({
  points: 1000, // 1000 requests para geocoding
  duration: 900, // Por 15 minutos (mayor capacidad para MLS processing)
  blockDuration: 30, // Bloquear por 30 segundos (menos tiempo de bloqueo)
});
```

### 2. Middleware Inteligente

**Archivo**: `middleware.ts`

```typescript
// Usar rate limiter específico para APIs de geocoding
const isGeocodingAPI = pathname.startsWith("/api/geocoding/");
const rateLimiter = isGeocodingAPI ? geocodingAPILimiter : generalAPILimiter;

const rateLimitResult = await applyRateLimit(rateLimiter, request);
if (!rateLimitResult.allowed) {
  return new NextResponse(
    JSON.stringify({
      error: rateLimitResult.error,
      type: isGeocodingAPI ? "geocoding_rate_limit" : "general_rate_limit",
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": rateLimitResult.retryAfter?.toString() || "60",
      },
    }
  );
}
```

### 3. Persistencia de Cache Mejorada

**Archivo**: `useMLSProcessor-optimized.ts`

#### Cache Persistente

- **Guardado**: El cache ahora se persiste correctamente en localStorage durante el auto-save
- **Carga**: Al iniciar el hook, se carga el cache persistido desde localStorage
- **Preservación**: Al hacer CONTINUE desde recovery, el cache NO se limpia

#### Mejoras en STOP/CONTINUE

```typescript
// Solo limpiar cache en inicio fresco, NO en continue
if (!isContinuingFromRecovery) {
  // Limpiar cache solo en inicio fresco
  geocodingCache.current.clear();
  geminiCache.current.clear();
} else {
  // Preservar cache existente cuando se continúa
  const geocodingCacheSize = geocodingCache.current.size();
  const geminiCacheSize = geminiCache.current.size();
  addLog(
    `💾 Preserving cache: ${geocodingCacheSize} geocoding + ${geminiCacheSize} gemini entries`,
    "info"
  );
}
```

### 4. Manejo Inteligente de Rate Limits

```typescript
if (response.status === 429) {
  const errorBody = await response.text().catch(() => "");
  const isMiddlewareRateLimit =
    errorBody.includes("geocoding_rate_limit") ||
    errorBody.includes("general_rate_limit");

  if (isMiddlewareRateLimit) {
    addLog("⚠️ Middleware rate limit hit - waiting 60 seconds...", "warning");
    await new Promise((resolve) => setTimeout(resolve, 60000)); // Wait 60 seconds for middleware
  } else {
    addLog("⚠️ Gemini API rate limit hit - waiting 5 seconds...", "warning");
    await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds for external API
  }
}
```

## 📊 Resultados Esperados

### ✅ Antes vs Después

| Aspecto                        | Antes         | Después               |
| ------------------------------ | ------------- | --------------------- |
| **Rate Limit Geocoding**       | 100 req/15min | 1000 req/15min        |
| **Cache en STOP/CONTINUE**     | Se perdía     | Se preserva           |
| **Manejo de 429**              | Genérico      | Específico por fuente |
| **Capacidad de Procesamiento** | ~6.6 req/min  | ~66 req/min           |

### 🎯 Beneficios

1. **Mayor Capacidad**: 10x más requests para procesamiento de MLS
2. **Cache Inteligente**: Evita requests duplicados en STOP/CONTINUE
3. **Recovery Mejorado**: El cache se preserva al continuar desde recovery
4. **Logging Detallado**: Mejor visibilidad de rate limits y cache status
5. **Manejo Diferenciado**: Distingue entre rate limits del middleware vs API externa

## 🧪 Pruebas Recomendadas

1. **Archivo Pequeño (30 rows)**: Debería procesar sin problemas
2. **STOP y CONTINUE**: Debería preservar cache y continuar sin 429
3. **Archivos Grandes**: Mayor capacidad de procesamiento
4. **Recovery**: Cache debe persistir entre sesiones

## 🔍 Monitoreo

El sistema ahora incluye logs detallados para monitorear:

- Cache hits/misses
- Rate limit status
- Diferenciación entre fuentes de rate limiting
- Persistencia de cache

Los logs mostrarán mensajes como:

```
💾 Loaded 45 geocoding cache entries
💾 Preserving cache: 23 geocoding + 18 gemini entries
⚠️ Middleware rate limit hit - waiting 60 seconds...
```
