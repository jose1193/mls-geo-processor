#!/bin/bash

# Script para configurar variables de entorno en Railway
echo "🚂 Configurando variables de entorno para Railway..."

# Verificar si Railway CLI está instalado
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI no encontrado. Instálalo con:"
    echo "npm install -g @railway/cli"
    exit 1
fi

# Configurar variables de entorno
echo "📝 Configurando variables de entorno..."

# Pedir al usuario las URLs
read -p "Ingresa tu dominio de Railway (ej: https://tu-app.railway.app): " RAILWAY_DOMAIN
read -p "Ingresa tu URL de Supabase: " SUPABASE_URL
read -p "Ingresa tu Service Role Key de Supabase: " SUPABASE_KEY

# Generar secret aleatorio
AUTH_SECRET=$(openssl rand -base64 32)

echo "🔧 Configurando variables en Railway..."

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

echo "✅ Variables de entorno configuradas exitosamente!"
echo "🚀 Ahora puedes hacer deploy con: railway up"

echo ""
echo "📋 Variables configuradas:"
echo "- AUTH_URL: $RAILWAY_DOMAIN"
echo "- NEXTAUTH_URL: $RAILWAY_DOMAIN"
echo "- AUTH_SECRET: [GENERADO AUTOMÁTICAMENTE]"
echo "- AUTH_TRUST_HOST: true"
echo "- PORT: 8080"
echo "- NODE_ENV: production"
echo "- NEXT_PUBLIC_SUPABASE_URL: $SUPABASE_URL"
echo "- SUPABASE_SERVICE_ROLE_KEY: [CONFIGURADO]"
