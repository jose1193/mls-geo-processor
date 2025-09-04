import crypto from "crypto";
import CryptoJS from "crypto-js";

export interface CSRFToken {
  token: string;
  hash: string;
  timestamp: number;
  sessionId: string;
}

// Generar token CSRF único
export function generateCSRFToken(sessionId: string): CSRFToken {
  const timestamp = Date.now();
  const randomBytes = crypto.randomBytes(32).toString("hex");
  const token = `${sessionId}_${timestamp}_${randomBytes}`;

  // Hash del token para validación
  const secret = process.env.NEXTAUTH_SECRET || "fallback-secret";
  const hash = CryptoJS.HmacSHA256(token, secret).toString();

  return {
    token,
    hash,
    timestamp,
    sessionId,
  };
}

// Validar token CSRF
export function validateCSRFToken(
  token: string,
  hash: string,
  sessionId: string,
  maxAge: number = 3600000 // 1 hora por defecto
): { valid: boolean; error?: string } {
  try {
    if (!token || !hash || !sessionId) {
      return { valid: false, error: "Token CSRF requerido" };
    }

    // Verificar que el token pertenece a la sesión
    if (!token.startsWith(sessionId + "_")) {
      return { valid: false, error: "Token CSRF inválido para esta sesión" };
    }

    // Extraer timestamp del token
    const parts = token.split("_");
    if (parts.length < 3) {
      return { valid: false, error: "Formato de token CSRF inválido" };
    }

    const timestamp = parseInt(parts[1]);
    const now = Date.now();

    // Verificar expiración
    if (now - timestamp > maxAge) {
      return { valid: false, error: "Token CSRF expirado" };
    }

    // Validar hash
    const secret = process.env.NEXTAUTH_SECRET || "fallback-secret";
    const expectedHash = CryptoJS.HmacSHA256(token, secret).toString();

    if (hash !== expectedHash) {
      return { valid: false, error: "Token CSRF inválido" };
    }

    return { valid: true };
  } catch (error) {
    console.error("Error validating CSRF token:", error);
    return { valid: false, error: "Error interno validando token CSRF" };
  }
}

// Generar session fingerprint para validación adicional
export function generateSessionFingerprint(
  userAgent: string,
  ip: string,
  acceptLanguage?: string
): string {
  const data = `${userAgent}_${ip}_${acceptLanguage || ""}`;
  return CryptoJS.SHA256(data).toString();
}

// Validar session fingerprint
export function validateSessionFingerprint(
  currentFingerprint: string,
  storedFingerprint: string
): boolean {
  return currentFingerprint === storedFingerprint;
}
