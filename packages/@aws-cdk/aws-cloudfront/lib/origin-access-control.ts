import * as iam from '@aws-cdk/aws-iam';
import * as cdk from '@aws-cdk/core';
import { Construct } from 'constructs';
import { CfnOriginAccessControl } from './cloudfront.generated';
import { IDistribution } from './distribution';

/**
 * Specifies which requests CloudFront signs.
 *
 * `always` is the most common (and recommended) use case.
 */
export enum SigningBehavior {
  /**
   * Sign all requests that are sent to the origin.
   */
  ALWAYS = 'always',
  /**
   * This does not sign any requests and effictively disables origin access control.
   *
   * This setting can be used instead of deleting the origin access control resource from all
   * origins and resources that use it.
   */
  NEVER = 'never',
  /**
   * Do not override the viewer `Authorization` header.
   *
   * If the viewer (client) specifies the HTTP `Authorization` header, with this setting
   * CloudFront will not sign the request (and therefore will not override the provided
   * `Authorization` header). If the viewer does not specify the `Authorization`, CloudFront
   * will sign the request to the origin.
   */
  NO_OVERRIDE = 'no-override',
}

/**
 * Specifies the type of the origin server.
 */
export enum OriginType {
  /**
   * An S3 Bucket.
   */
  S3 = 'S3',
}

/**
 * The protocol to use to sign requests.
 */
export enum SigningProtocol {
  /**
  * The AWS Signature V4 algorithm.
  */
  SIGV4 = 'sigv4'
}

/**
 * Properties to build a CloudFront Origin Access Control.
 */
export interface OriginAccessControlProps {
  /**
   * The CloudFront Distribution that leverages this Origin Access Control to sign
   * requests to the origin.
   */
  // TODO: Can there be more than one distribution? Should this be lazily provided?
  readonly distribution: IDistribution;

  /**
   * A name to identify the origin access control.
   *
   * @default a name will be generated
   */
  readonly originAccessControlName?: string;
  /**
   * A description of the origin access control.
   *
   * @default No description will be used
   */
  readonly description?: string;
  /**
   * The type of origin that this origin access control is for.
   *
   * @default S3
   */
  readonly originType?: OriginType;
  /**
   * Specifies which requests CloudFront signs (adds authentication information to).
   *
   * @default always
   */
  readonly signingBehavior?: SigningBehavior;
  /**
   * The signing protocol of the origin access control, which determines how CloudFront signs
   * (authenticates) requests.
   *
   * @default sigv4
   */
  readonly signingProtocol?: SigningProtocol;
}

/**
 * An Origin Access Control resource.
 */
export interface IOriginAccessControl extends cdk.IResource, iam.IGrantable {
  /**
   * The name to identify the origin access control.
   *
   * @attribute
   */
  readonly originAccessControlName: string;
  /**
   * The unique identifier of the origin access control.
   *
   * @attribute
   */
  readonly originAccessControlId: string;
}

/**
 * An Origin Access Control resource, used to sign requests from a CloudFront Distribution to
 * an Origin.
 */
export class OriginAccessControl extends cdk.Resource implements IOriginAccessControl {
  readonly originAccessControlName: string;
  readonly originAccessControlId: string;
  readonly grantPrincipal: iam.IPrincipal;

  constructor(scope: Construct, id: string, props: OriginAccessControlProps) {
    super(scope, id, {
      physicalName: props.originAccessControlName,
    });
    const resource = new CfnOriginAccessControl(this, 'Resource', {
      originAccessControlConfig: {
        description: props.description,
        name: this.physicalName,
        originAccessControlOriginType: props.originType ?? OriginType.S3,
        signingBehavior: props.signingBehavior ?? SigningBehavior.ALWAYS,
        signingProtocol: props.signingProtocol ?? SigningProtocol.SIGV4,
      },
    });
    // TODO: It is unclear if `Ref` actually returns the name. Need to check the
    // Resource Specification. Interestingly, the `Name` Property is not of `Name`
    // type (it's a `String`).
    this.originAccessControlName = resource.ref;
    this.originAccessControlId = resource.attrId;
    this.grantPrincipal = new iam.ServicePrincipal('cloudfront.amazonaws.com', {
      conditions: {
        StringEquals: {
          'AWS:SourceArn': props.distribution,
        },
      },
    });
  }
}
