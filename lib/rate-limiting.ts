import { RateLimiterMemory } from "rate-limiter-flexible";
import { NextRequest } from "next/server";

// Rate limiters para diferentes endpoints
export const loginAttemptLimiter = new RateLimiterMemory({
  points: 5, // 5 intentos
  duration: 900, // Por 15 minutos
  blockDuration: 900, // Bloquear por 15 minutos
});

export const otpRequestLimiter = new RateLimiterMemory({
  points: 3, // 3 códigos OTP
  duration: 300, // Por 5 minutos
  blockDuration: 300, // Bloquear por 5 minutos
});

export const generalAPILimiter = new RateLimiterMemory({
  points: 100, // 100 requests
  duration: 900, // Por 15 minutos
  blockDuration: 60, // Bloquear por 1 minuto
});

// Rate limiter específico para APIs de geocoding (más permisivo)
export const geocodingAPILimiter = new RateLimiterMemory({
  points: 1000, // 1000 requests para geocoding
  duration: 900, // Por 15 minutos (mayor capacidad para MLS processing)
  blockDuration: 30, // Bloquear por 30 segundos (menos tiempo de bloqueo)
});

// Función helper para obtener IP del request
function getClientIP(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const realIP = req.headers.get("x-real-ip");

  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  if (realIP) {
    return realIP;
  }

  return "unknown";
}

// Función helper para aplicar rate limiting
export async function applyRateLimit(
  limiter: RateLimiterMemory,
  req: NextRequest,
  identifier?: string
): Promise<{ allowed: boolean; error?: string; retryAfter?: number }> {
  try {
    const key = identifier || getClientIP(req);
    await limiter.consume(key);
    return { allowed: true };
  } catch (rejRes: unknown) {
    const error = rejRes as { msBeforeNext: number };
    const secs = Math.round(error.msBeforeNext / 1000) || 1;
    return {
      allowed: false,
      error: `Too many attempts. Try again in ${secs} seconds.`,
      retryAfter: secs,
    };
  }
}

// Rate limiting específico por email para OTP
export const otpEmailLimiter = new RateLimiterMemory({
  points: 5, // 5 códigos OTP por email
  duration: 3600, // Por 1 hora
  blockDuration: 3600, // Bloquear por 1 hora
});

// Rate limiting para verificación de OTP
export const otpVerifyLimiter = new RateLimiterMemory({
  points: 10, // 10 intentos de verificación
  duration: 900, // Por 15 minutos
  blockDuration: 1800, // Bloquear por 30 minutos
});

// Rate limiting por email helper
export async function applyEmailRateLimit(
  limiter: RateLimiterMemory,
  email: string
): Promise<{ allowed: boolean; error?: string; retryAfter?: number }> {
  try {
    await limiter.consume(email);
    return { allowed: true };
  } catch (rejRes: unknown) {
    const error = rejRes as { msBeforeNext: number };
    const secs = Math.round(error.msBeforeNext / 1000) || 1;
    return {
      allowed: false,
      error: `Too many attempts for this email. Try again in ${secs} seconds.`,
      retryAfter: secs,
    };
  }
}
