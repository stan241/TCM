import * as cdk  from 'aws-cdk-lib'
import * as ec2   from 'aws-cdk-lib/aws-ec2'
import { Construct } from 'constructs'

export class TcmNetworkStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc

  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props)

    this.vpc = new ec2.Vpc(this, 'TcmVpc', {
      maxAzs:             2,
      natGateways:        1,   // 1 NAT gateway (cost-optimized; use 2 for HA prod)
      vpcName:            'tcm-vpc',
      ipAddresses:        ec2.IpAddresses.cidr('10.0.0.0/16'),
      subnetConfiguration: [
        {
          name:       'Public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask:   24,
        },
        {
          name:       'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask:   24,
        },
        {
          name:       'Isolated',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask:   24,
        },
      ],
    })

    // VPC Flow Logs — security audit trail
    this.vpc.addFlowLog('FlowLogs', {
      destination: ec2.FlowLogDestination.toCloudWatchLogs(),
      trafficType: ec2.FlowLogTrafficType.ALL,
    })

    new cdk.CfnOutput(this, 'VpcId', { value: this.vpc.vpcId })
  }
}
