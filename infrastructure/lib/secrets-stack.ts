import * as cdk        from 'aws-cdk-lib'
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager'
import { Construct }   from 'constructs'

/**
 * Secrets Manager secrets for the TCM platform.
 * Secrets are created empty — fill values after deploy via AWS console or CLI.
 * Production rotation should be configured per secret after initial deployment.
 */
export class TcmSecretsStack extends cdk.Stack {
  public readonly issuerPrivateKey:    secretsmanager.Secret
  public readonly nextAuthSecret:      secretsmanager.Secret
  public readonly stripeSecretKey:     secretsmanager.Secret
  public readonly alchemyApiKey:       secretsmanager.Secret
  public readonly personaApiKey:       secretsmanager.Secret
  public readonly tcaHmacSigningKey:   secretsmanager.Secret
  public readonly tcaApiKey:           secretsmanager.Secret
  public readonly identityVaultEncKey: secretsmanager.Secret
  public readonly identityVaultSalt:   secretsmanager.Secret

  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props)

    const mk = (name: string, desc: string) =>
      new secretsmanager.Secret(this, name, {
        secretName:  `tcm/${name.toLowerCase().replace(/([A-Z])/g, '-$1').toLowerCase()}`,
        description: desc,
        generateSecretString: { excludePunctuation: true, passwordLength: 64 },
      })

    this.issuerPrivateKey    = mk('IssuerPrivateKey',    'ISSUER_ROLE wallet private key — NEVER expose. Rotate via KMS in prod.')
    this.nextAuthSecret      = mk('NextAuthSecret',      'NextAuth NEXTAUTH_SECRET — 32+ byte random string.')
    this.stripeSecretKey     = mk('StripeSecretKey',     'Stripe secret key (sk_live_...)')
    this.alchemyApiKey       = mk('AlchemyApiKey',       'Alchemy API key for Polygon PoS RPC')
    this.personaApiKey       = mk('PersonaApiKey',       'Persona KYC API key')
    this.tcaHmacSigningKey   = mk('TcaHmacSigningKey',   'HMAC-SHA256 key for TCA webhook signing/verification')
    this.tcaApiKey           = mk('TcaApiKey',           'Bearer token for TCA REST API')
    this.identityVaultEncKey = mk('IdentityVaultEncKey', 'AES-256 encryption key for Identity Vault (32 bytes hex)')
    this.identityVaultSalt   = mk('IdentityVaultSalt',   'Master salt for identity_binding derivation')

    // Output ARNs so they can be pasted into .env or app config
    const secrets = {
      IssuerPrivateKey:    this.issuerPrivateKey,
      NextAuthSecret:      this.nextAuthSecret,
      StripeSecretKey:     this.stripeSecretKey,
      AlchemyApiKey:       this.alchemyApiKey,
      PersonaApiKey:       this.personaApiKey,
      TcaHmacSigningKey:   this.tcaHmacSigningKey,
      TcaApiKey:           this.tcaApiKey,
      IdentityVaultEncKey: this.identityVaultEncKey,
      IdentityVaultSalt:   this.identityVaultSalt,
    }
    for (const [k, s] of Object.entries(secrets)) {
      new cdk.CfnOutput(this, `${k}Arn`, { value: s.secretArn, exportName: `TcmSecret-${k}` })
    }
  }
}
