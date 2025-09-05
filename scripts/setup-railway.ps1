# Script para configurar variables de entorno en Railway (PowerShell)
Write-Host "🚂 Configurando variables de entorno para Railway..." -ForegroundColor Green

# Verificar si Railway CLI está instalado
try {
    railway --version | Out-Null
} catch {
    Write-Host "❌ Railway CLI no encontrado. Instálalo con:" -ForegroundColor Red
    Write-Host "npm install -g @railway/cli" -ForegroundColor Yellow
    exit 1
}

# Configurar variables de entorno
Write-Host "📝 Configurando variables de entorno..." -ForegroundColor Blue

# Pedir al usuario las URLs
$RAILWAY_DOMAIN = Read-Host "Ingresa tu dominio de Railway (ej: https://tu-app.railway.app)"
$SUPABASE_URL = Read-Host "Ingresa tu URL de Supabase"
$SUPABASE_KEY = Read-Host "Ingresa tu Service Role Key de Supabase"

# Generar secret aleatorio (32 caracteres)
$AUTH_SECRET = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes([System.Guid]::NewGuid().ToString() + [System.Guid]::NewGuid().ToString()))

Write-Host "🔧 Configurando variables en Railway..." -ForegroundColor Blue

# Configurar variables de entorno en Railway
railway variables set AUTH_URL="$RAILWAY_DOMAIN"
railway variables set NEXTAUTH_URL="$RAILWAY_DOMAIN" 
railway variables set AUTH_SECRET="$AUTH_SECRET"
railway variables set NEXTAUTH_SECRET="$AUTH_SECRET"
railway variables set AUTH_TRUST_HOST="true"
railway variables set PORT="8080"
railway variables set NODE_ENV="production"
railway variables set NEXT_PUBLIC_SUPABASE_URL="$SUPABASE_URL"
railway variables set SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_KEY"

Write-Host "✅ Variables de entorno configuradas exitosamente!" -ForegroundColor Green
Write-Host "🚀 Ahora puedes hacer deploy con: railway up" -ForegroundColor Yellow

Write-Host ""
Write-Host "📋 Variables configuradas:" -ForegroundColor Cyan
Write-Host "- AUTH_URL: $RAILWAY_DOMAIN"
Write-Host "- NEXTAUTH_URL: $RAILWAY_DOMAIN"
Write-Host "- AUTH_SECRET: [GENERADO AUTOMÁTICAMENTE]"
Write-Host "- AUTH_TRUST_HOST: true"
Write-Host "- PORT: 8080"
Write-Host "- NODE_ENV: production"
Write-Host "- NEXT_PUBLIC_SUPABASE_URL: $SUPABASE_URL"
Write-Host "- SUPABASE_SERVICE_ROLE_KEY: [CONFIGURADO]"
