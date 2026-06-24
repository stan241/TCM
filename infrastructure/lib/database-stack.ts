import * as cdk  from 'aws-cdk-lib'
import * as ec2   from 'aws-cdk-lib/aws-ec2'
import * as rds   from 'aws-cdk-lib/aws-rds'
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager'
import { Construct }       from 'constructs'
import { TcmSecretsStack } from './secrets-stack'

export interface DatabaseStackProps extends cdk.StackProps {
  vpc:     ec2.Vpc
  secrets: TcmSecretsStack
}

/**
 * Two RDS PostgreSQL 16 instances (post-consolidation Jun 2026):
 *
 *   Instance 1: identity-vault    — PII-isolated, separate credentials
 *   Instance 2: tcm-engine        — 7 schemas: credential-mirror, outcome-store,
 *                                   audit-log, chain-registry, commercial,
 *                                   kyc-workflow, doc-attestation
 *
 * Both instances:
 *   - db.t3.medium (upgrade to db.r6g.large for prod load)
 *   - Multi-AZ enabled (can disable for cost in dev)
 *   - Encrypted at rest (KMS)
 *   - Automated backups 7 days retention
 *   - Performance Insights enabled
 *   - Private subnets only — no public access
 */
export class TcmDatabaseStack extends cdk.Stack {
  public readonly identityVaultCredentials:   rds.DatabaseInstanceFromSnapshot | rds.DatabaseInstance
  public readonly engineCredentials:          rds.DatabaseInstance
  public readonly identityVaultSecret:        secretsmanager.Secret
  public readonly engineSecret:               secretsmanager.Secret
  public readonly dbSecurityGroup:            ec2.SecurityGroup

  // Connection endpoint exports
  public readonly identityVaultEndpoint: string
  public readonly engineEndpoint:        string

  constructor(scope: Construct, id: string, props: DatabaseStackProps) {
    super(scope, id, props)

    const { vpc } = props

    // Security group shared by both RDS instances — only ECS tasks may connect
    this.dbSecurityGroup = new ec2.SecurityGroup(this, 'DbSg', {
      vpc,
      description:   'TCM RDS — allow inbound 5432 from ECS only',
      allowAllOutbound: false,
    })

    const isolatedSubnets = { subnetType: ec2.SubnetType.PRIVATE_ISOLATED }

    const commonProps: Partial<rds.DatabaseInstanceProps> = {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_16_3,
      }),
      instanceType:       ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MEDIUM),
      vpc,
      vpcSubnets:         isolatedSubnets,
      securityGroups:     [this.dbSecurityGroup],
      multiAz:            true,
      storageEncrypted:   true,
      monitoringInterval: cdk.Duration.seconds(60),
      enablePerformanceInsights: true,
      backupRetention:    cdk.Duration.days(7),
      deletionProtection: true,
      removalPolicy:      cdk.RemovalPolicy.SNAPSHOT,
    }

    // ── Instance 1: Identity Vault (PII-isolated) ─────────────────────────────
    this.identityVaultSecret = new secretsmanager.Secret(this, 'IdentityVaultDbSecret', {
      secretName:  'tcm/db/identity-vault',
      description: 'RDS credentials for TCM Identity Vault (PII-isolated)',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'tcm_idvault' }),
        generateStringKey:    'password',
        excludePunctuation:   true,
        passwordLength:       32,
      },
    })

    const identityVaultInstance = new rds.DatabaseInstance(this, 'IdentityVaultDb', {
      ...(commonProps as rds.DatabaseInstanceProps),
      databaseName:  'tcm_identity_vault',
      credentials:   rds.Credentials.fromSecret(this.identityVaultSecret),
      instanceIdentifier: 'tcm-identity-vault',
    })
    this.identityVaultCredentials = identityVaultInstance
    this.identityVaultEndpoint    = identityVaultInstance.instanceEndpoint.hostname

    // ── Instance 2: TCM Engine (7 consolidated schemas) ───────────────────────
    this.engineSecret = new secretsmanager.Secret(this, 'EngineDbSecret', {
      secretName:  'tcm/db/engine',
      description: 'RDS credentials for TCM Engine instance (7 schemas)',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'tcm_engine' }),
        generateStringKey:    'password',
        excludePunctuation:   true,
        passwordLength:       32,
      },
    })

    const engineInstance = new rds.DatabaseInstance(this, 'EngineDb', {
      ...(commonProps as rds.DatabaseInstanceProps),
      databaseName:  'tcm_engine',
      credentials:   rds.Credentials.fromSecret(this.engineSecret),
      instanceIdentifier: 'tcm-engine',
    })
    this.engineCredentials = engineInstance
    this.engineEndpoint    = engineInstance.instanceEndpoint.hostname

    // Outputs
    new cdk.CfnOutput(this, 'IdentityVaultEndpoint', {
      value:       identityVaultInstance.instanceEndpoint.hostname,
      exportName:  'TcmDb-IdentityVaultEndpoint',
    })
    new cdk.CfnOutput(this, 'EngineEndpoint', {
      value:       engineInstance.instanceEndpoint.hostname,
      exportName:  'TcmDb-EngineEndpoint',
    })
  }
}
