/**
 * NextAuth catch-all route handler — App Router
 * Handles GET and POST for all NextAuth endpoints:
 * /api/auth/signin, /api/auth/callback, /api/auth/session, etc.
 */

import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth'

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
