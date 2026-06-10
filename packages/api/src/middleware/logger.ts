import { Request, Response, NextFunction } from 'express'

/** Structured request logger — writes to audit log on material actions */
export function requestLogger(req: Request, _res: Response, next: NextFunction) {
  // TODO: Wire to Audit Log (Store 4) for material actions
  // Non-material health checks and static reads can stay in stdout only
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`)
  next()
}
