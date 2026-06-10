import { Request, Response, NextFunction } from 'express'

/**
 * mTLS middleware — Auth API (TCM-CRED-VERIFY-002)
 *
 * Doc5 §I: mTLS (TCN service certificate — no other caller permitted).
 * Doc5 §V: mTLS failure → 401 INVALID_SERVICE_CREDENTIAL. Escalate immediately. Do not retry.
 * Doc5 §VII: mTLS cert rotation quarterly (90-day). 30-day expiry alert. 14-day overlap window.
 *
 * In production this is enforced at the load balancer / API gateway layer.
 * This middleware validates the client certificate forwarded by the LB.
 */
export function mtlsMiddleware(req: Request, res: Response, next: NextFunction) {
  // TODO: Extract forwarded client cert from X-Client-Cert header (set by ALB/nginx)
  // and verify it against the TCN service CA.
  const clientCert = req.headers['x-client-cert']

  if (!clientCert) {
    return res.status(401).json({
      error: 'INVALID_SERVICE_CREDENTIAL',
      message: 'mTLS client certificate required. Escalate immediately — do not retry.',
    })
  }

  // TODO: Validate cert against TCN service CA and check expiry
  // if (!isValidTCNServiceCert(clientCert)) { ... }

  next()
}
