import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "./lib/auth";
import type { Session } from "next-auth";
import {
  applyRateLimit,
  generalAPILimiter,
  geocodingAPILimiter,
  mlsProcessingAPILimiter,
} from "./lib/rate-limiting";
import {
  applySecurityHeaders,
  validateRequestOrigin,
  apiHeaders,
} from "./lib/security-headers";

export default auth(async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // En NextAuth v5, la sesión ya está disponible en request.auth
  const session = (request as NextRequest & { auth?: Session | null }).auth;

  // Si usuario está logueado e intenta acceder al login, redirigir al dashboard
  if (session && pathname === "/") {
    const dashboardUrl = new URL("/dashboard", request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  // Aplicar rate limiting a requests seleccionadas
  // Usar rate limiters específicos según el tipo de API
  const isGeocodingAPI = pathname.startsWith("/api/geocoding/");
  const isMLSProcessingAPI = pathname.startsWith("/api/mls/");
  const isDashboardAPI = pathname.startsWith("/api/dashboard/");

  // Aplicar rate limiting apropiado según el tipo de API
  if (pathname.startsWith("/api/")) {
    let rateLimiter;
    let limitType = "general_rate_limit";

    if (isGeocodingAPI) {
      rateLimiter = geocodingAPILimiter;
      limitType = "geocoding_rate_limit";
    } else if (isMLSProcessingAPI) {
      rateLimiter = mlsProcessingAPILimiter;
      limitType = "mls_processing_rate_limit";
    } else if (!isDashboardAPI) {
      // Solo aplicar rate limiting general a APIs que no sean dashboard
      rateLimiter = generalAPILimiter;
      limitType = "general_rate_limit";
    }

    // Aplicar rate limiting si se determinó un limiter
    if (rateLimiter) {
      const rateLimitResult = await applyRateLimit(rateLimiter, request);
      if (!rateLimitResult.allowed) {
        return new NextResponse(
          JSON.stringify({
            error: rateLimitResult.error,
            type: limitType,
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
    }
  }

  // Crear response base
  const response = NextResponse.next();

  // Rutas públicas (no requieren autenticación)
  const publicPaths = ["/auth/verify", "/auth/error", "/api/auth"];

  // Rutas de API que requieren validación de origen
  const apiPaths = ["/api/auth/send-otp", "/api/auth/verify-otp"];

  // Aplicar headers de seguridad para APIs
  if (pathname.startsWith("/api/")) {
    // Validar origen para APIs sensibles
    if (apiPaths.some((path) => pathname.startsWith(path))) {
      if (!validateRequestOrigin(request)) {
        return new NextResponse(
          JSON.stringify({ error: "Unauthorized origin" }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // Aplicar headers específicos para API
    Object.entries(apiHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
  }

  // Permitir acceso a ruta de login (exactamente "/"), rutas de auth y archivos estáticos
  if (
    pathname === "/" || // Solo la ruta raíz exacta
    publicPaths.some((path) => pathname.startsWith(path)) ||
    pathname.includes("/_next/") ||
    pathname.includes("/favicon.ico") ||
    pathname.includes("/api/auth/") ||
    // Excluir archivos estáticos del directorio public
    pathname.match(/\.(svg|png|jpg|jpeg|gif|ico|webp|js|css|woff|woff2|ttf)$/i)
  ) {
    return applySecurityHeaders(response, {
      isDevelopment: process.env.NODE_ENV === "development",
    });
  }

  // Redirigir a login si no está autenticado
  if (!session) {
    const loginUrl = new URL("/", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);

    const redirectResponse = NextResponse.redirect(loginUrl);
    return applySecurityHeaders(redirectResponse, {
      isDevelopment: process.env.NODE_ENV === "development",
    });
  }

  // Aplicar headers de seguridad a la respuesta
  return applySecurityHeaders(response, {
    isDevelopment: process.env.NODE_ENV === "development",
  });
});

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * We handle static file exclusion in the middleware function itself
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
