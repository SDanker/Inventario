import type { NextAuthConfig } from "next-auth";

/**
 * Configuración compartida cliente/servidor.
 * Sin acceso a Prisma ni bcrypt: ese código vive solo en `src/auth.ts`
 * para que el middleware (Edge) pueda importar esto sin romper.
 */
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  trustHost: true,
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // user lleva los campos que devuelve `authorize()` en auth.ts
        token.id = (user as { id: string }).id;
        token.role = (user as { role: string }).role;
        token.unitId = (user as { unitId: string | null }).unitId;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.unitId = (token.unitId as string | null) ?? null;
      }
      return session;
    },
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const pathname = request.nextUrl.pathname;

      // Rutas públicas
      if (pathname.startsWith("/api/auth") || pathname === "/login" || pathname === "/forbidden") {
        return true;
      }
      return isLoggedIn;
    },
  },
  providers: [], // los providers reales (Credentials con Prisma) van en src/auth.ts
} satisfies NextAuthConfig;
