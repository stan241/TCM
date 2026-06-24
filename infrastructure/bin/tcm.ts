#!/usr/bin/env node
import 'source-map-support/register'
import * as cdk from 'aws-cdk-lib'
import { TcmNetworkStack }   from '../lib/network-stack'
import { TcmDatabaseStack }  from '../lib/database-stack'
import { TcmApiStack }       from '../lib/api-stack'
import { TcmPortalStack }    from '../lib/portal-stack'
import { TcmSecretsStack }   from '../lib/secrets-stack'

const app = new cdk.App()

const env: cdk.Environment = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region:  process.env.CDK_DEFAULT_REGION ?? 'us-east-1',
}

// ── Layer 1: Network (VPC) ──────────────────────────────────────────────────
const network = new TcmNetworkStack(app, 'TcmNetwork', { env })

// ── Layer 2: Secrets (created before DB and API so ARNs are available) ──────
const secrets = new TcmSecretsStack(app, 'TcmSecrets', { env })

// ── Layer 3: Databases (RDS PostgreSQL — 2 instances) ───────────────────────
const database = new TcmDatabaseStack(app, 'TcmDatabase', {
  env,
  vpc:     network.vpc,
  secrets,
})

// ── Layer 4: API (ECS Fargate) ───────────────────────────────────────────────
const api = new TcmApiStack(app, 'TcmApi', {
  env,
  vpc:      network.vpc,
  database,
  secrets,
})

// ── Layer 5: Portal (AWS Amplify — Next.js SSR) ─────────────────────────────
new TcmPortalStack(app, 'TcmPortal', {
  env,
  apiUrl: api.apiUrl,
  secrets,
})
