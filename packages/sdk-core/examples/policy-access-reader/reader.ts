/**
 * A clinic's patient portal reading one policy-gated lab report.
 *
 * This file deliberately imports nothing from TinyCloud Share. It is the
 * executable proof that `@tinycloud/sdk-core/policy-access` is usable by an
 * arbitrary application.
 */
import {
  beginEmailCredentialAcquisition,
  createEphemeralHolderKey,
  decryptLocally,
  openPolicyAccess,
  type EphemeralHolderKey,
  type PolicyAccessTransport,
} from "@tinycloud/sdk-core/policy-access";
import type {
  CredentialFlowDescriptor,
  CredentialRequirement,
} from "@tinycloud/sdk-core";

export interface LabReportInvitation {
  /** Everything below comes from the portal's own trusted configuration. */
  readonly issuerOrigin: string;
  readonly policyEngine: {
    readonly endpoint: string;
    readonly audience: string;
    readonly grantIssuerDid: string;
  };
  readonly ownerNode: { readonly endpoint: string; readonly spaceId: string };
  readonly policyId: string;
  readonly capabilitySpace: string;
  readonly reportPath: string;
  readonly requirementId: string;
  readonly patientEmail: string;
  readonly requirement: CredentialRequirement;
  readonly descriptor: CredentialFlowDescriptor;
  readonly portalOrigin: string;
}

export interface LabReportReader {
  readonly holder: EphemeralHolderKey;
  /** Send the one-time code to the patient's mailbox. */
  sendCode(): Promise<void>;
  /** Exchange the code for a credential, then read and decrypt the report. */
  readReport(otp: string, contentKey: Uint8Array): Promise<string>;
}

export function createLabReportReader(
  invitation: LabReportInvitation,
  transport: PolicyAccessTransport,
  invoke: Parameters<typeof openPolicyAccess>[0]["invoke"],
): LabReportReader {
  // One key per reader. It is never persisted, so closing the tab ends access
  // even if the grant has not expired yet.
  const holder = createEphemeralHolderKey();
  let acquisition:
    | Awaited<ReturnType<typeof beginEmailCredentialAcquisition>>
    | undefined;

  return {
    holder,
    async sendCode() {
      acquisition = await beginEmailCredentialAcquisition({
        issuerOrigin: invitation.issuerOrigin,
        transport,
        holder,
        email: invitation.patientEmail,
        requirement: invitation.requirement,
        descriptor: invitation.descriptor,
        audience: "tinycloud://credentials",
        openerOrigin: invitation.portalOrigin,
        completionOrigin: invitation.portalOrigin,
        completionContext: "clinic-lab-report",
      });
      await acquisition.requestOtp();
    },
    async readReport(otp: string, contentKey: Uint8Array) {
      if (acquisition === undefined) {
        throw new Error("call sendCode() before readReport()");
      }
      const credential = await acquisition.submitOtp(otp);

      const session = await openPolicyAccess({
        descriptor: {
          policyId: invitation.policyId,
          policyEngine: invitation.policyEngine,
          ownerNode: invitation.ownerNode,
          requestedCapabilities: [
            {
              service: "tinycloud.kv",
              space: invitation.capabilitySpace,
              path: invitation.reportPath,
              actions: ["tinycloud.kv/get"],
            },
          ],
        },
        holder,
        transport,
        evidence: [
          {
            requirementId: invitation.requirementId,
            presentation: { sdJwt: credential.credential },
          },
        ],
        invoke,
      });

      const { ciphertext } = await session.readEncrypted(invitation.reportPath);
      // The clinic's node handed back opaque bytes; only this line can read them.
      const plaintext = await decryptLocally({
        ciphertext,
        key: contentKey,
        versionByte: 0x01,
      });
      return new TextDecoder().decode(plaintext);
    },
  };
}
