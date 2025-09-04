# 🔐 Configuración de Autenticación OTP con Supabase

Este sistema implementa autenticación segura sin contraseñas usando códigos OTP (One-Time Password) enviados por email, con Supabase como base de datos.

## 🚀 Configuración Rápida

### 1. Configurar Supabase

1. Ve a [supabase.com](https://supabase.com) y crea una cuenta gratuita
2. Crea un nuevo proyecto
3. Ve a **Settings** → **API** y copia:
   - Project URL (`NEXT_PUBLIC_SUPABASE_URL`)
   - Public anon key (`NEXT_PUBLIC_SUPABASE_ANON_KEY`)
   - Service role key (`SUPABASE_SERVICE_ROLE_KEY`)

### 2. Ejecutar SQL Setup

1. Ve a **SQL Editor** en tu dashboard de Supabase
2. Ejecuta el contenido del archivo `supabase-setup.sql`
3. Esto creará las tablas necesarias y configurará las políticas de seguridad

### 3. Configurar Resend (Email)

1. Ve a [resend.com](https://resend.com) y crea una cuenta
2. Obtén tu API key
3. Configura un dominio (opcional para desarrollo)

### 4. Variables de Entorno

```bash
# Copia el archivo de ejemplo
cp .env.local.example .env.local

# Edita .env.local con tus valores reales
```

**Variables requeridas:**

- `NEXTAUTH_SECRET`: Genera una clave secreta segura
- `NEXT_PUBLIC_SUPABASE_URL`: URL de tu proyecto Supabase
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Public anon key de Supabase
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key de Supabase
- `RESEND_API_KEY`: Tu API key de Resend
- `AUTHORIZED_EMAIL`: Tu email (el único usuario autorizado)

### 5. Insertar Usuario Inicial

En el SQL Editor de Supabase, ejecuta:

```sql
INSERT INTO users (email, name)
VALUES ('tu-email@ejemplo.com', 'MLS Admin')
ON CONFLICT (email) DO NOTHING;
```

### 6. Ejecutar el Proyecto

```bash
npm run dev
```

## 🔒 Flujo de Autenticación

1. **Login** (`/auth/login`): Usuario introduce email
2. **Verificación**: Sistema genera código de 6 dígitos
3. **Email**: Código enviado por Resend con diseño profesional
4. **Validación** (`/auth/verify`): Usuario introduce código
5. **Acceso**: Sesión creada con NextAuth

## 📊 Características de Seguridad

### 🔒 Protección Multicapa (estilo Laravel)

- ✅ **Tokens CSRF**: Protección contra Cross-Site Request Forgery
- ✅ **Rate Limiting**: Límites por IP y email para prevenir ataques de fuerza bruta
- ✅ **Headers de Seguridad**: CSP, HSTS, X-Frame-Options, etc.
- ✅ **Validación de Origen**: Verificación de origen de requests API
- ✅ **Session Fingerprinting**: Detección de session hijacking
- ✅ **Logging de Seguridad**: Registro completo de eventos sospechosos

### 🛡️ Medidas Anti-Injection

- ✅ **Códigos únicos**: Cada código OTP se usa una sola vez
- ✅ **Expiración temporal**: Códigos válidos por 10 minutos
- ✅ **Límite de intentos**: Máximo 3 intentos por código
- ✅ **Hashing seguro**: Códigos hasheados con bcrypt
- ✅ **Cleanup automático**: Limpieza de códigos expirados
- ✅ **RLS habilitado**: Row Level Security en Supabase
- ✅ **Validación estricta**: Schemas Zod en frontend y backend

### ⚡ Rate Limiting Inteligente

- **Login attempts**: 5 intentos por IP cada 15 minutos
- **OTP requests**: 3 códigos por IP cada 5 minutos
- **OTP por email**: 5 códigos por email cada hora
- **Verificación OTP**: 10 intentos por email cada 15 minutos
- **API general**: 100 requests por IP cada 15 minutos

## 🗄️ Estructura de Base de Datos

### Tabla `users`

- Usuario autorizado para el sistema
- Registro de último login y actividad

### Tabla `otp_codes`

- Códigos OTP temporales con hash de seguridad
- Control de intentos y expiración automática
- Limpieza automática de códigos usados/expirados

### Tabla `user_sessions`

- Sesiones seguras con tokens CSRF
- Fingerprinting para detección de anomalías
- Seguimiento de IP y User-Agent
- Expiración automática de sesiones

### Tabla `security_logs`

- Registro completo de eventos de seguridad
- Seguimiento de intentos de acceso no autorizados
- Análisis de patrones sospechosos
- Auditoría completa del sistema

## 🔧 Comandos Útiles

```bash
# Desarrollo
npm run dev

# Construir para producción
npm run build

# Limpiar códigos expirados manualmente (opcional)
# Se ejecuta automáticamente cada 5 minutos
```

## 🛡️ Seguridad en Producción

### Headers de Seguridad Implementados

1. **Content Security Policy (CSP)**: Previene XSS y injection attacks
2. **HSTS**: Fuerza conexiones HTTPS (solo en producción)
3. **X-Frame-Options**: Previene clickjacking
4. **X-Content-Type-Options**: Previene MIME sniffing
5. **Referrer-Policy**: Control de información de referencia

### Protecciones Anti-Ataque

1. **CSRF Protection**: Tokens únicos por sesión
2. **Rate Limiting**: Múltiples capas de protección
3. **Origin Validation**: Verificación de origen de requests
4. **Session Security**: Fingerprinting y validación de sesiones
5. **Secure Cookies**: Configuración httpOnly, secure, sameSite

### Monitoreo y Alertas

1. **Security Logs**: Registro de todos los eventos sospechosos
2. **Failed Attempts**: Tracking de intentos fallidos
3. **IP Monitoring**: Seguimiento de IPs sospechosas
4. **Rate Limit Violations**: Alertas de límites excedidos

### Variables Seguras

1. **Secrets Management**: Variables de entorno protegidas
2. **No Hardcoding**: Sin datos sensibles en código
3. **Environment Separation**: Configuraciones por ambiente
4. **Backup Strategy**: Respaldos automáticos de base de datos

## 📝 Notas Importantes

- **Tier gratuito Supabase**: 500MB suficiente para este proyecto
- **Resend gratuito**: 3,000 emails/mes en tier gratuito
- **Usuario único**: Sistema preparado para un solo usuario autorizado
- **Escalabilidad**: Fácil extensión para múltiples usuarios

## 🐛 Troubleshooting

### Error: "Código no encontrado"

- Verifica que las tablas estén creadas en Supabase
- Confirma que las variables de entorno están configuradas

### Error: "Email no enviado"

- Revisa tu API key de Resend
- Verifica la configuración del dominio

### Error: "No autorizado"

- Confirma que tu email está en la variable `AUTHORIZED_EMAIL`
- Verifica que el usuario existe en la tabla `users`

Para más ayuda, revisa los logs de la consola del navegador y del servidor.
