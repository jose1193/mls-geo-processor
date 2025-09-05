import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { supabaseAdmin } from "./supabase";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      id: "credentials",
      name: "OTP",
      credentials: {
        email: { label: "Email", type: "email" },
        otp: { label: "OTP Code", type: "text" },
      },
      async authorize(credentials) {
        try {
          const parsedCredentials = z
            .object({
              email: z.string().email(),
              otp: z.string().length(6),
            })
            .safeParse(credentials);

          if (!parsedCredentials.success) {
            return null;
          }

          const { email, otp } = parsedCredentials.data;

          // Check if Supabase admin client is available
          if (!supabaseAdmin) {
            console.error("Supabase admin client not available");
            return null;
          }

          // Verificar que el email está autorizado en la tabla de usuarios
          const { data: user, error } = await supabaseAdmin
            .from("users")
            .select("id, email, name")
            .eq("email", email)
            .single();

          if (error || !user) {
            return null;
          }

          // Verificar OTP usando API interna
          const baseUrl = process.env.NEXTAUTH_URL || 
            (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
          
          const verifyResponse = await fetch(
            `${baseUrl}/api/auth/verify-otp`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email, otp }),
            }
          );

          if (!verifyResponse.ok) {
            return null;
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
          };
        } catch (error) {
          console.error("Auth error:", error);
          return null;
        }
      },
    }),
  ],
  pages: {
    signIn: "/",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.email = user.email;
        token.name = user.name;
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.email) {
        session.user.email = token.email;
        session.user.name = token.name as string;
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
    maxAge: 5 * 24 * 60 * 60, // 5 días = 432,000 segundos
    // maxAge: 24 * 60 * 60, // 24 horas (configuración anterior)
  },
});
