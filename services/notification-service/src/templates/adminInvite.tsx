import { Button, Text } from "react-email";
import { EmailLayout, emailStyles } from "./emailLayout.js";

/**
 * AdminInviteEmail — single-use admin invite link.
 *
 * Rendered for the `admin.invite.created` domain event. The token in the link is
 * single-use and expires 24 hours after the invite was created; user-service
 * validates it before the setup form renders.
 */

export interface AdminInviteEmailProps {
  /** Invited address — the account will be created for exactly this address. */
  email: string;
  /** Full accept-invite URL (admin dashboard page + single-use token). */
  inviteLink: string;
  /** ISO timestamp the token stops working. */
  expiresAt: string;
}

export function AdminInviteEmail({
  email,
  inviteLink,
  expiresAt,
}: AdminInviteEmailProps) {
  const expiresAtLabel = new Date(expiresAt).toUTCString();

  return (
    <EmailLayout previewText="You have been invited as a Nexus administrator">
      <Text style={emailStyles.heading}>You have been invited</Text>

      <Text style={emailStyles.paragraph}>
        A Nexus super administrator invited{" "}
        <span style={{ fontWeight: 600 }}>{email}</span> to join the admin team.
        Set your password below to activate the account.
      </Text>

      <Button href={inviteLink} style={emailStyles.button}>
        Accept invitation
      </Button>

      <Text style={emailStyles.paragraph}>
        This invitation is single-use and expires on{" "}
        <span style={{ fontWeight: 600 }}>{expiresAtLabel}</span>.
      </Text>

      <Text style={emailStyles.paragraph}>
        If the button doesn&apos;t work, copy and paste this link into your
        browser:
      </Text>

      <Text style={emailStyles.mutedText}>{inviteLink}</Text>

      <Text style={emailStyles.paragraph}>
        If you weren&apos;t expecting this invitation, you can ignore this email
        — no account will be created unless the link above is used.
      </Text>
    </EmailLayout>
  );
}

export default AdminInviteEmail;
