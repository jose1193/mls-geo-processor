import { NextRequest, NextResponse } from "next/server";

export interface SecurityHeaders {
  "Content-Security-Policy"?: string;
  "X-Frame-Options"?: string;
  "X-Content-Type-Options"?: string;
  "Referrer-Policy"?: string;
  "Permissions-Policy"?: string;
  "Strict-Transport-Security"?: string;
  "X-XSS-Protection"?: string;
}

// Headers de seguridad por defecto
const defaultSecurityHeaders: SecurityHeaders = {
  // Política de seguridad de contenido estricta
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https:",
    "connect-src 'self' https://api.resend.com https://*.supabase.co wss://*.supabase.co",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join("; "),

  // Prevenir embedding en iframes
  "X-Frame-Options": "DENY",

  // Prevenir MIME type sniffing
  "X-Content-Type-Options": "nosniff",

  // Control de referrer
  "Referrer-Policy": "strict-origin-when-cross-origin",

  // Controlar APIs del navegador
  "Permissions-Policy": [
    "camera=()",
    "microphone=()",
    "geolocation=()",
    "interest-cohort=()",
  ].join(", "),

  // XSS Protection (aunque los navegadores modernos prefieren CSP)
  "X-XSS-Protection": "1; mode=block",
};

// Headers HSTS para producción
const hstsHeader = "max-age=31536000; includeSubDomains; preload";

// Aplicar headers de seguridad a response
export function applySecurityHeaders(
  response: NextResponse,
  options: {
    isDevelopment?: boolean;
    customHeaders?: Partial<SecurityHeaders>;
  } = {}
): NextResponse {
  const { isDevelopment = false, customHeaders = {} } = options;

  // Combinar headers por defecto con personalizados
  const headers = { ...defaultSecurityHeaders, ...customHeaders };

  // Aplicar headers
  Object.entries(headers).forEach(([key, value]) => {
    if (value) {
      response.headers.set(key, value);
    }
  });

  // HSTS solo en producción con HTTPS
  if (!isDevelopment) {
    response.headers.set("Strict-Transport-Security", hstsHeader);
  }

  return response;
}

// Headers específicos para páginas de autenticación
export const authPageHeaders: Partial<SecurityHeaders> = {
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data:",
    "connect-src 'self' https://api.resend.com https://*.supabase.co",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
  ].join("; "),
};

// Headers para API endpoints
export const apiHeaders = {
  "Content-Security-Policy": "default-src 'none'",
  "X-Content-Type-Options": "nosniff",
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

// Función helper para validar origen de requests
export function validateRequestOrigin(
  request: NextRequest,
  allowedOrigins: string[] = []
): boolean {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");

  // En desarrollo, permitir cualquier origen
  if (process.env.NODE_ENV === "development") {
    return true;
  }

  // Para requests internos (sin origin/referer), permitir en producción también
  if (!origin && !referer) {
    return true;
  }

  const requestOrigin = origin || (referer ? new URL(referer).origin : "");

  // URLs permitidas en producción
  const siteUrl =
    process.env.NEXTAUTH_URL || process.env.AUTH_URL || "http://localhost:3000";
  const allowedDomains = [
    siteUrl,
    process.env.NEXTAUTH_URL,
    process.env.AUTH_URL,
    "http://localhost:3000",
    "https://localhost:3000",
  ].filter(Boolean); // Filtra valores undefined/null

  const defaultAllowed = [...allowedDomains, ...allowedOrigins];

  console.log(
    `[ORIGIN-VALIDATION] Request origin: ${requestOrigin}, Allowed: ${defaultAllowed.join(", ")}`
  );

  return defaultAllowed.includes(requestOrigin);
}

// Middleware helper para aplicar todas las protecciones
export function createSecureResponse(
  request: NextRequest,
  response: NextResponse,
  options: {
    requireOriginValidation?: boolean;
    customHeaders?: Partial<SecurityHeaders>;
  } = {}
): NextResponse | null {
  const { requireOriginValidation = true, customHeaders = {} } = options;

  // Validar origen si es requerido
  if (requireOriginValidation && !validateRequestOrigin(request)) {
    return new NextResponse("Invalid origin", { status: 403 });
  }

  // Aplicar headers de seguridad
  const isDevelopment = process.env.NODE_ENV === "development";
  return applySecurityHeaders(response, {
    isDevelopment,
    customHeaders,
  });
}
