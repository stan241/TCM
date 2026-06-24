# TCM AWS Deployment Guide

## Architecture

```
                     ┌─────────────────────────────────────────┐
   User browser ───► │  AWS Amplify (apps/portal — Next.js SSR) │
                     └──────────────────┬──────────────────────┘
                                        │ API calls
                     ┌──────────────────▼──────────────────────┐
                     │  ALB  ──►  ECS Fargate (packages/api)   │
                     │            private subnets               │
                     └──────────────────┬──────────────────────┘
                                        │ PostgreSQL
                     ┌──────────────────▼──────────────────────┐
                     │  RDS Instance 1: identity-vault (PII)   │
                     │  RDS Instance 2: tcm-engine (7 schemas) │
                     └─────────────────────────────────────────┘
                     All secrets in AWS Secrets Manager
```

## Prerequisites

1. AWS CLI configured with your root/admin credentials:
   ```
   aws configure
   # enter: Access Key, Secret Key, region (us-east-1), output (json)
   ```

2. CDK bootstrapped (one-time per account/region):
   ```
   cd infrastructure
   npm install
   npx cdk bootstrap aws://YOUR_ACCOUNT_ID/us-east-1
   ```

3. Docker installed (for building and pushing the API image)

4. GitHub repo connected (for Amplify CI/CD)

---

## Step 1 — Deploy infrastructure

```bash
cd infrastructure
npm install
npx cdk deploy --all
```

This creates (in order):
- VPC with public/private/isolated subnets
- Secrets Manager secrets (empty — fill in Step 2)
- 2 RDS PostgreSQL instances
- ECR repository + ECS Fargate cluster + ALB
- Amplify app

Takes ~15–20 minutes on first deploy. Note the outputs:
- `TcmApiUrl` — the ALB DNS name for the API
- `TcmPortalAmplifyAppId` — connect to GitHub in Step 4
- All secret ARNs

---

## Step 2 — Fill in secrets

Go to **AWS Console → Secrets Manager** and set values for each secret:

| Secret name                    | What to put |
|-------------------------------|-------------|
| `tcm/issuer-private-key`      | Your ISSUER_ROLE wallet private key (0x...) |
| `tcm/next-auth-secret`        | Random 32+ char string (`openssl rand -hex 32`) |
| `tcm/stripe-secret-key`       | Stripe `sk_live_...` key |
| `tcm/alchemy-api-key`         | Alchemy API key for Polygon |
| `tcm/persona-api-key`         | Persona KYC API key |
| `tcm/tca-hmac-signing-key`    | HMAC-SHA256 key (agree with TCA team) |
| `tcm/tca-api-key`             | Bearer token from TCA |
| `tcm/identity-vault-enc-key`  | `openssl rand -hex 32` |
| `tcm/identity-vault-salt`     | `openssl rand -hex 32` |

---

## Step 3 — Build and push the API image

```bash
# Get your ECR repo URI from cdk deploy output (TcmApiEcrRepo)
ECR_REPO=YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/tcm-api

# Authenticate Docker to ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin $ECR_REPO

# Build from repo root
docker build -f packages/api/Dockerfile -t tcm-api:latest .

# Tag and push
docker tag  tcm-api:latest $ECR_REPO:latest
docker push $ECR_REPO:latest

# Force ECS to pick up the new image
aws ecs update-service \
  --cluster tcm-cluster \
  --service tcm-api \
  --force-new-deployment \
  --region us-east-1
```

---

## Step 4 — Run database migrations

After ECS tasks are running, exec into a task to run migrations:

```bash
# Get a running task ARN
TASK=$(aws ecs list-tasks --cluster tcm-cluster --service-name tcm-api \
  --query 'taskArns[0]' --output text)

# Exec in (requires ECS Exec enabled — it is in the CDK stack)
aws ecs execute-command \
  --cluster tcm-cluster \
  --task $TASK \
  --container tcm-api \
  --interactive \
  --command "/bin/sh"

# Inside the container:
# npm run migrate --workspace=packages/db
```

Or run migrations from your local machine with a DB tunnel via AWS SSM Session Manager.

---

## Step 5 — Connect Amplify to GitHub

1. Go to **AWS Console → AWS Amplify → tcm-portal**
2. Click **Connect repository** → GitHub
3. Authorize Amplify → select your repo → select branch `main`
4. The `amplify.yml` in the repo root is picked up automatically

Set environment variables in Amplify console:
```
NEXT_PUBLIC_API_URL              = https://YOUR_ALB_DNS  (from TcmApiUrl output)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = pk_live_...
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID = (from cloud.walletconnect.com)
NEXT_PUBLIC_RPC_POLYGON          = https://polygon-mainnet.g.alchemy.com/v2/YOUR_KEY
NEXTAUTH_URL                     = https://your-domain.com
NEXTAUTH_SECRET                  = (copy from Secrets Manager — next-auth-secret)
```

---

## Step 6 — Custom domain (optional)

1. In Amplify → **Domain management** → add your domain
2. Amplify provisions an ACM certificate automatically
3. Update `NEXTAUTH_URL` to `https://your-domain.com`
4. Add HTTPS to the ALB for the API (ACM cert in us-east-1)

---

## Ongoing deployments

**Portal** — automatic on every push to `main` branch via Amplify CI/CD.

**API** — rebuild and push Docker image (Step 3), then force ECS deployment.

For future automation, add a GitHub Actions workflow at `.github/workflows/deploy-api.yml`.

---

## Cost estimate (us-east-1, as of Jun 2026)

| Service              | Config                | Monthly est. |
|---------------------|----------------------|-------------|
| ECS Fargate (2 tasks) | 0.5 vCPU, 1GB each  | ~$35        |
| RDS t3.medium × 2   | Multi-AZ             | ~$180       |
| ALB                  | 1 ALB                | ~$20        |
| Amplify Hosting      | SSR                  | ~$5–15      |
| Secrets Manager      | 9 secrets            | ~$4         |
| NAT Gateway          | 1                    | ~$35        |
| **Total**            |                      | **~$280/mo**|

Reduce cost in dev: set `multiAz: false` on RDS, use `natGateways: 0` + VPC endpoints.
