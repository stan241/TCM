import express from 'express'
import { authRouter }          from './routes/auth/index.js'
import { onboardingRouter }    from './routes/onboarding/index.js'
import { gate1Router }         from './routes/onboarding/gate1.js'
import { kycRouter }           from './routes/kyc/index.js'
import { walletRouter }        from './routes/wallet/index.js'
import { tokenRouter }         from './routes/token/index.js'
import { credentialsRouter }      from './routes/credentials/index.js'
import { adminRouter, auditRouter, credentialSearchRouter } from './routes/admin/index.js'
import { tcaWebhookRouter } from './routes/tca/webhook.js'
import { mtlsMiddleware }           from './middleware/mtls.js'
import { requestLogger }            from './middleware/logger.js'
import { startReconciliationJobs }  from './jobs/reconciliation.js'
import { startSyncPipeline }        from './jobs/syncPipeline.js'

const app = express()
app.use(express.json())
app.use(requestLogger)

// Auth API (TCM-CRED-VERIFY-002) — mTLS required, TCN service certificate only
app.use('/auth/v1', mtlsMiddleware, authRouter)

// Portal backend routes
app.use('/api/v1/onboarding', onboardingRouter)
app.use('/api/v1/onboarding/gate1', gate1Router)
app.use('/api/v1/kyc', kycRouter)
app.use('/api/v1/wallet', walletRouter)
app.use('/api/v1/token', tokenRouter)
app.use('/api/v1/credentials', credentialSearchRouter)
app.use('/api/v1/credentials', credentialsRouter)
app.use('/api/v1/admin',       adminRouter)
app.use('/api/v1/audit',       auditRouter)

// TCA Onboarding Engine — inbound webhook (Option B)
app.use('/api/v1/tca/webhook', tcaWebhookRouter)

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok' }))

const PORT = process.env.PORT ?? 4000
app.listen(PORT, () => {
  console.log(`TCM API listening on port ${PORT}`)
  // Background jobs — start after server is listening
  startReconciliationJobs()
  startSyncPipeline().catch(err => console.error('syncPipeline failed to start', err))
})

export default app
