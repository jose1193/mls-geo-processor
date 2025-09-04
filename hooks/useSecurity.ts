"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";

interface SecurityHookState {
  isSecure: boolean;
  csrfToken: string | null;
  sessionFingerprint: string | null;
  rateLimitStatus: {
    remaining: number;
    resetTime: number;
  } | null;
}

export function useSecurity() {
  const { data: session, status } = useSession();
  const [securityState, setSecurityState] = useState<SecurityHookState>({
    isSecure: false,
    csrfToken: null,
    sessionFingerprint: null,
    rateLimitStatus: null,
  });

  // Generar fingerprint del navegador (memoizado)
  const generateFingerprint = useCallback(() => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.textBaseline = "top";
      ctx.font = "14px Arial";
      ctx.fillText("Security fingerprint", 2, 2);
    }

    const fingerprint = btoa(
      JSON.stringify({
        userAgent: navigator.userAgent,
        language: navigator.language,
        platform: navigator.platform,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        screen: `${screen.width}x${screen.height}`,
        canvas: canvas.toDataURL(),
      })
    );

    return fingerprint;
  }, []);

  // Verificar integridad de sesión
  const verifySessionIntegrity = useCallback(async () => {
    if (!session) return false;

    try {
      // Por ahora solo verificamos que la sesión exista
      // TODO: Cuando implementemos el endpoint /api/auth/verify-session, implementar:
      // const response = await fetch("/api/auth/verify-session", {
      //   method: "POST",
      //   headers: {
      //     "Content-Type": "application/json",
      //   },
      //   body: JSON.stringify({
      //     fingerprint: securityState.sessionFingerprint,
      //   }),
      // });
      // return response.ok;

      return true;
    } catch {
      return false;
    }
  }, [session]);

  // Detectar cambios sospechosos en el navegador
  const detectSuspiciousActivity = useCallback(() => {
    const currentFingerprint = generateFingerprint();

    if (
      securityState.sessionFingerprint &&
      securityState.sessionFingerprint !== currentFingerprint
    ) {
      console.warn(
        "🚨 Suspicious activity detected: Browser fingerprint changed"
      );
      // Podrías enviar una alerta al servidor aquí
      return true;
    }

    return false;
  }, [generateFingerprint, securityState.sessionFingerprint]);

  // Hacer request seguro con protecciones
  const secureRequest = useCallback(
    async (url: string, options: RequestInit = {}) => {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-Requested-With": "XMLHttpRequest",
        ...((options.headers as Record<string, string>) || {}),
      };

      // Agregar CSRF token si está disponible
      if (securityState.csrfToken) {
        headers["X-CSRF-Token"] = securityState.csrfToken;
      }

      // Agregar fingerprint para validación adicional
      if (securityState.sessionFingerprint) {
        headers["X-Browser-Fingerprint"] = securityState.sessionFingerprint;
      }

      try {
        const response = await fetch(url, {
          ...options,
          headers,
        });

        // Verificar rate limiting en la respuesta
        const remaining = response.headers.get("X-RateLimit-Remaining");
        const resetTime = response.headers.get("X-RateLimit-Reset");

        if (remaining && resetTime) {
          setSecurityState((prev) => ({
            ...prev,
            rateLimitStatus: {
              remaining: parseInt(remaining),
              resetTime: parseInt(resetTime),
            },
          }));
        }

        // Manejar errores de rate limiting
        if (response.status === 429) {
          const retryAfter = response.headers.get("Retry-After");
          throw new Error(
            `Rate limit exceeded. Retry after ${retryAfter} seconds.`
          );
        }

        return response;
      } catch (error) {
        console.error("Secure request failed:", error);
        throw error;
      }
    },
    [securityState.csrfToken, securityState.sessionFingerprint]
  );

  // Inicializar seguridad
  useEffect(() => {
    if (typeof window !== "undefined") {
      const fingerprint = generateFingerprint();

      setSecurityState((prev) => ({
        ...prev,
        sessionFingerprint: fingerprint,
        isSecure: true,
      }));
    }
  }, [generateFingerprint]);

  // Verificar integridad periódicamente
  useEffect(() => {
    if (!session || status !== "authenticated") return;

    const interval = setInterval(async () => {
      // Detectar cambios sospechosos
      if (detectSuspiciousActivity()) {
        console.warn("🚨 Suspicious activity detected");
      }

      // Verificar integridad de sesión
      const isValid = await verifySessionIntegrity();
      if (!isValid) {
        console.warn("🚨 Session integrity check failed");
      }
    }, 60000); // Cada minuto

    return () => clearInterval(interval);
  }, [session, status, detectSuspiciousActivity, verifySessionIntegrity]);

  return {
    ...securityState,
    secureRequest,
    generateFingerprint,
    detectSuspiciousActivity,
    verifySessionIntegrity,
  };
}
