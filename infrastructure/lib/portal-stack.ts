import * as cdk      from 'aws-cdk-lib'
import * as amplify   from 'aws-cdk-lib/aws-amplify'
import * as iam       from 'aws-cdk-lib/aws-iam'
import * as codebuild from 'aws-cdk-lib/aws-codebuild'
import { Construct }  from 'constructs'
import { TcmSecretsStack } from './secrets-stack'

export interface PortalStackProps extends cdk.StackProps {
  apiUrl:  string
  secrets: TcmSecretsStack
}

/**
 * AWS Amplify Hosting for the Next.js portal (apps/portal).
 *
 * Amplify handles:
 *   - Next.js SSR (App Router) natively
 *   - Git-based CI/CD (push to main → auto-deploy)
 *   - SSL certificate (ACM)
 *   - CDN distribution
 *
 * After deploy:
 *   1. Go to AWS Amplify console → connect GitHub repo
 *   2. Set the custom domain in Amplify → Domain management
 *   3. Fill secret values in Secrets Manager console
 */
export class TcmPortalStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: PortalStackProps) {
    super(scope, id, props)

    const { apiUrl, secrets } = props

    // ── Amplify service role ──────────────────────────────────────────────────
    const amplifyRole = new iam.Role(this, 'AmplifyRole', {
      assumedBy: new iam.ServicePrincipal('amplify.amazonaws.com'),
      roleName:  'tcm-portal-amplify-role',
    })

    // Allow Amplify to read portal-relevant secrets
    amplifyRole.addToPolicy(new iam.PolicyStatement({
      actions:   ['secretsmanager:GetSecretValue'],
      resources: [
        secrets.nextAuthSecret.secretArn,
        secrets.stripeSecretKey.secretArn,
      ],
    }))

    // ── Amplify app ───────────────────────────────────────────────────────────
    const app = new amplify.CfnApp(this, 'PortalApp', {
      name:       'tcm-portal',
      iamServiceRole: amplifyRole.roleArn,
      platform:   'WEB_COMPUTE',   // Next.js SSR

      buildSpec: codebuild.BuildSpec.fromObjectToYaml({
        version: '1.0',
        applications: [{
          frontend: {
            phases: {
              preBuild:  { commands: ['npm ci --workspace=apps/portal'] },
              build:     { commands: ['npm run build --workspace=apps/portal'] },
            },
            artifacts: {
              baseDirectory: 'apps/portal/.next',
              files:         ['**/*'],
            },
            cache: {
              paths: ['node_modules/**/*', 'apps/portal/.next/cache/**/*'],
            },
          },
          appRoot: '.',
        }],
      }).toBuildSpec(),

      environmentVariables: [
        { name: 'NEXT_PUBLIC_API_URL',                   value: apiUrl },
        { name: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',    value: 'REPLACE_WITH_STRIPE_LIVE_KEY' },
        { name: 'NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID',  value: 'REPLACE_WITH_WALLETCONNECT_ID' },
        { name: 'NEXT_PUBLIC_RPC_POLYGON',               value: 'https://polygon-mainnet.g.alchemy.com/v2/REPLACE' },
        { name: 'NEXTAUTH_URL',                          value: 'https://REPLACE_WITH_YOUR_DOMAIN.com' },
        { name: 'NODE_ENV',                              value: 'production' },
        // Secret values — set these in Amplify console → Environment variables
        // Do NOT set NEXTAUTH_SECRET here; inject from Secrets Manager
        { name: 'NEXTAUTH_SECRET',                       value: 'REPLACE_FROM_SECRETS_MANAGER' },
      ],

      customRules: [
        // Next.js App Router — let Amplify handle SSR routing
        { source: '/<*>', target: '/index.html', status: '404-200' },
      ],
    })

    // ── Main branch ───────────────────────────────────────────────────────────
    new amplify.CfnBranch(this, 'MainBranch', {
      appId:      app.attrAppId,
      branchName: 'main',
      enableAutoBuild: true,
      framework:  'Next.js - SSR',
      stage:      'PRODUCTION',
      environmentVariables: [
        { name: 'AMPLIFY_MONOREPO_APP_ROOT', value: 'apps/portal' },
        { name: 'AMPLIFY_DIFF_DEPLOY',       value: 'false' },
      ],
    })

    new cdk.CfnOutput(this, 'AmplifyAppId', {
      value:      app.attrAppId,
      exportName: 'TcmPortalAmplifyAppId',
    })
    new cdk.CfnOutput(this, 'AmplifyDefaultDomain', {
      value:      app.attrDefaultDomain,
      exportName: 'TcmPortalDomain',
    })
  }
}
