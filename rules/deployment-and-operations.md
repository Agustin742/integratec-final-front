# Deployment and Operational Responsibility

A successful merge or build is not evidence that the product is working in a deployed environment.

## Ownership and readiness

- Frontend and backend **MUST** identify their deployment owners and compatible integration versions independently.
- Deployment configuration **MUST** reflect agreed infrastructure choices; this rule does not provision services. The frontend is planned for AWS Amplify Hosting in `us-east-2` (FD5, updated 2026-11-04; availability in that region is verified, see [AWS endpoints and quotas](https://docs.aws.amazon.com/general/latest/gr/amplify.html)). Deployment uses Amplify Hosting's GitHub App connection; long-lived AWS access keys **MUST NOT** be stored in GitHub or the repository (backend decision D6); see the [technical justification](../docs/technical-justification.md#architecture-decisions).
- Release candidates **MUST** satisfy [Git workflow](./git-workflow.md) and applicable [quality checks](./quality-and-testing.md).
- Deployment automation **MUST NOT** be claimed unless its actual trigger, permissions, and results have been verified.
- Data-changing migrations **MUST** have a backend-owned execution and recovery plan before deployment.

## Verification and recovery

- Deployment evidence **MUST** identify the environment and deployed revision, not merely the latest branch state.
- Applicable checks **MUST** verify public HTTPS access, API integration, authenticated flows, and realtime connectivity when present.
- A health check alone **MUST NOT** be presented as proof of the complete user flow.
- Releases **MUST** have a documented recovery path. Reverting frontend files **MUST NOT** be assumed to reverse database changes.
- Test accounts and datasets **MUST** be limited and safe for the target environment.
- Infrastructure changes **MUST** consider ongoing costs and cleanup ownership.

## Boundaries

Promotion and merge policy stays in [Git workflow](./git-workflow.md). Environment values belong to [Configuration](./configuration-and-environments.md); course availability and production-demo obligations belong to [Course requirements](./project-requirements.md). This document does not claim branch protection, deployment, or monitoring is already configured.
