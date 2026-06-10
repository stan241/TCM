/**
 * NextAuth configuration — TCM Client Intake Portal
 *
 * Doc10 §V:
 * - JWT session tied to onboarding_session_id
 * - Participant re-enters via email + OTP on resume
 * - No sensitive data in localStorage or sessionStorage — session is server-side
 */

import type { NextAuthOptions } from 'next-auth'
import EmailProvider from 'next-auth/providers/email'
import { Pool } from 'pg'

// Session storage: PostgreSQL — not JWT cookies for sensitive portal sessions
const pool = new Pool({ connectionString: process.env.DATABASE_URL_CREDENTIAL_MIRROR })

export const authOptions: NextAuthOptions = {
  providers: [
    // Email + OTP (magic link / one-time passcode) — Doc10 §V
    EmailProvider({
      server: {
        host:   process.env.EMAIL_SERVER_HOST,
        port:   Number(process.env.EMAIL_SERVER_PORT ?? 587),
        auth: {
          user: process.env.EMAIL_SERVER_USER,
          pass: process.env.EMAIL_SERVER_PASSWORD,
        },
      },
      from: process.env.EMAIL_FROM ?? 'noreply@tokencap.io',
      // Short expiry — onboarding sessions are sensitive
      maxAge: 10 * 60, // 10 minutes for the OTP link
    }),
  ],

  session: {
    strategy: 'jwt',
    maxAge:   7 * 24 * 60 * 60, // 7 days — matches onboarding_session TTL
  },

  callbacks: {
    async jwt({ token, user }) {
      // On first sign-in, attach the session_id if one exists for this email
      if (user?.email) {
        const result = await pool.query<{ session_id: string }>(
          `SELECT session_id FROM onboarding_session
           WHERE participant_email = $1 AND expires_at > now()
           ORDER BY created_at DESC LIMIT 1`,
          [user.email]
        )
        if (result.rows[0]) {
          token.session_id = result.rows[0].session_id
        }
      }
      return token
    },

    async session({ session, token }) {
      // Expose session_id to client — used to resume onboarding state
      if (token.session_id) {
        (session as any).session_id = token.session_id
      }
      return session
    },
  },

  pages: {
    signIn:  '/auth/signin',
    verifyRequest: '/auth/verify',  // "Check your email" page
    error:   '/auth/error',
  },

  // No debug in production
  debug: process.env.NODE_ENV === 'development',
}
