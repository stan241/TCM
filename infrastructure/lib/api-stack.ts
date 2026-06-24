import * as cdk         from 'aws-cdk-lib'
import * as ec2          from 'aws-cdk-lib/aws-ec2'
import * as ecs          from 'aws-cdk-lib/aws-ecs'
import * as ecsPatterns  from 'aws-cdk-lib/aws-ecs-patterns'
import * as ecr          from 'aws-cdk-lib/aws-ecr'
import * as iam          from 'aws-cdk-lib/aws-iam'
import * as logs         from 'aws-cdk-lib/aws-logs'
import { Construct }     from 'constructs'
import { TcmDatabaseStack } from './database-stack'
import { TcmSecretsStack }  from './secrets-stack'

export interface ApiStackProps extends cdk.StackProps {
  vpc:      ec2.Vpc
  database: TcmDatabaseStack
  secrets:  TcmSecretsStack
}

/**
 * ECS Fargate service for the TCM API (packages/api).
 *
 * - ALB (public) → Fargate task (private subnet)
 * - ECR repository for the API Docker image
 * - Task role with Secrets Manager read access
 * - 2 tasks minimum (HA), auto-scales 2–10 on CPU/request count
 * - Health check: GET /health
 */
export class TcmApiStack extends cdk.Stack {
  public readonly apiUrl:          string
  public readonly ecsSecurityGroup: ec2.SecurityGroup
  public readonly cluster:          ecs.Cluster

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props)

    const { vpc, database, secrets } = props

    // ── ECR repository ────────────────────────────────────────────────────────
    const repo = new ecr.Repository(this, 'ApiRepo', {
      repositoryName:     'tcm-api',
      imageScanOnPush:    true,
      lifecycleRules:     [{ maxImageCount: 10, description: 'Keep last 10 images' }],
      removalPolicy:      cdk.RemovalPolicy.RETAIN,
    })

    // ── ECS Cluster ───────────────────────────────────────────────────────────
    this.cluster = new ecs.Cluster(this, 'TcmCluster', {
      vpc,
      clusterName:        'tcm-cluster',
      containerInsights:  true,
    })

    // ── Task execution role ───────────────────────────────────────────────────
    const taskRole = new iam.Role(this, 'TaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      roleName:  'tcm-api-task-role',
    })

    // Grant read access to all TCM secrets
    const secretArns = [
      secrets.issuerPrivateKey.secretArn,
      secrets.nextAuthSecret.secretArn,
      secrets.stripeSecretKey.secretArn,
      secrets.alchemyApiKey.secretArn,
      secrets.personaApiKey.secretArn,
      secrets.tcaHmacSigningKey.secretArn,
      secrets.tcaApiKey.secretArn,
      secrets.identityVaultEncKey.secretArn,
      secrets.identityVaultSalt.secretArn,
      database.identityVaultSecret.secretArn,
      database.engineSecret.secretArn,
    ]
    taskRole.addToPolicy(new iam.PolicyStatement({
      actions:   ['secretsmanager:GetSecretValue'],
      resources: secretArns,
    }))

    // ── Security groups ───────────────────────────────────────────────────────
    this.ecsSecurityGroup = new ec2.SecurityGroup(this, 'EcsSg', {
      vpc,
      description: 'TCM API ECS tasks',
    })

    // Allow ECS → RDS
    database.dbSecurityGroup.addIngressRule(
      this.ecsSecurityGroup,
      ec2.Port.tcp(5432),
      'Allow ECS tasks to connect to RDS'
    )

    // ── Log group ─────────────────────────────────────────────────────────────
    const logGroup = new logs.LogGroup(this, 'ApiLogs', {
      logGroupName:  '/tcm/api',
      retention:     logs.RetentionDays.THREE_MONTHS,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    })

    // ── Fargate ALB service ───────────────────────────────────────────────────
    const service = new ecsPatterns.ApplicationLoadBalancedFargateService(this, 'ApiService', {
      cluster:       this.cluster,
      serviceName:   'tcm-api',
      cpu:           512,
      memoryLimitMiB: 1024,
      desiredCount:  2,
      taskSubnets:   { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [this.ecsSecurityGroup],
      publicLoadBalancer: true,
      taskImageOptions: {
        image:          ecs.ContainerImage.fromEcrRepository(repo, 'latest'),
        containerPort:  4000,
        taskRole,
        logDriver: ecs.LogDrivers.awsLogs({
          streamPrefix: 'tcm-api',
          logGroup,
        }),
        environment: {
          NODE_ENV:                       'production',
          PORT:                           '4000',
          CHAIN_ID_POLYGON:               '137',
          CHAIN_ID_AMOY:                  '80002',
          FINALITY_SOFT:                  '32',
          FINALITY_OPERATIONAL:           '64',
          FINALITY_AUDIT:                 '128',
          RECON_MIRROR_VS_CHAIN_INTERVAL: '300000',
          RECON_AUDIT_VS_MIRROR_INTERVAL: '900000',
          RECON_BILLING_VS_EVENTS_INTERVAL: '3600000',
          // Database host endpoints — connection strings built at runtime from secrets
          DB_IDENTITY_VAULT_HOST:         database.identityVaultEndpoint,
          DB_ENGINE_HOST:                 database.engineEndpoint,
        },
        secrets: {
          ISSUER_PRIVATE_KEY:          ecs.Secret.fromSecretsManager(secrets.issuerPrivateKey),
          NEXTAUTH_SECRET:             ecs.Secret.fromSecretsManager(secrets.nextAuthSecret),
          STRIPE_SECRET_KEY:           ecs.Secret.fromSecretsManager(secrets.stripeSecretKey),
          ALCHEMY_API_KEY:             ecs.Secret.fromSecretsManager(secrets.alchemyApiKey),
          PERSONA_API_KEY:             ecs.Secret.fromSecretsManager(secrets.personaApiKey),
          TCA_HMAC_SIGNING_KEY:        ecs.Secret.fromSecretsManager(secrets.tcaHmacSigningKey),
          TCA_API_KEY:                 ecs.Secret.fromSecretsManager(secrets.tcaApiKey),
          IDENTITY_VAULT_ENCRYPTION_KEY: ecs.Secret.fromSecretsManager(secrets.identityVaultEncKey),
          IDENTITY_VAULT_SALT_MASTER:  ecs.Secret.fromSecretsManager(secrets.identityVaultSalt),
          DB_IDENTITY_VAULT_PASSWORD:  ecs.Secret.fromSecretsManager(database.identityVaultSecret, 'password'),
          DB_ENGINE_PASSWORD:          ecs.Secret.fromSecretsManager(database.engineSecret, 'password'),
        },
      },
      healthCheck: {
        command:     ['CMD-SHELL', 'curl -sf http://localhost:4000/health || exit 1'],
        interval:    cdk.Duration.seconds(30),
        timeout:     cdk.Duration.seconds(5),
        retries:     3,
        startPeriod: cdk.Duration.seconds(60),
      },
    })

    // ── Auto-scaling ──────────────────────────────────────────────────────────
    const scaling = service.service.autoScaleTaskCount({ minCapacity: 2, maxCapacity: 10 })
    scaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 70,
      scaleInCooldown:  cdk.Duration.seconds(120),
      scaleOutCooldown: cdk.Duration.seconds(60),
    })
    scaling.scaleOnRequestCount('RequestScaling', {
      requestsPerTarget: 500,
      targetGroup:       service.targetGroup,
      scaleInCooldown:   cdk.Duration.seconds(120),
      scaleOutCooldown:  cdk.Duration.seconds(60),
    })

    this.apiUrl = `http://${service.loadBalancer.loadBalancerDnsName}`

    new cdk.CfnOutput(this, 'ApiUrl',    { value: this.apiUrl, exportName: 'TcmApiUrl' })
    new cdk.CfnOutput(this, 'EcrRepo',   { value: repo.repositoryUri, exportName: 'TcmApiEcrRepo' })
  }
}
