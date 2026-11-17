import Link from "next/link";
import { LegalPage, H, CONTACT_EMAIL } from "@/components/LegalPage";

export const metadata = { title: "Terms of service — rply" };

export default function Terms() {
  return (
    <LegalPage title="Terms of service">
      <p>These terms apply when you create a rply workspace or connect an account to it. By using rply you agree to them.</p>

      <H>The service</H>
      <p>rply reads comments and direct messages sent to the Facebook Pages and Instagram professional accounts you connect, and replies to them on your behalf using the knowledge, rules and settings you provide.</p>

      <H>Your accounts</H>
      <ul>
        <li>Connect only accounts you own or are authorized to manage.</li>
        <li>You are responsible for the knowledge and rules you add, and for the replies sent from your accounts.</li>
        <li>Keep your login details private and tell us if you suspect unauthorized access.</li>
      </ul>

      <H>Acceptable use</H>
      <p>You may not use rply to send spam, unsolicited promotions, misleading or harmful content, or anything that breaks Meta's Terms, Community Standards, Platform Terms or messaging policies, including the 24-hour messaging window. We may suspend workspaces that do.</p>

      <H>AI-written replies</H>
      <p>Replies are written by AI models and can be wrong. Use the review and handoff settings to keep a person in the loop where accuracy matters.</p>

      <H>Data</H>
      <p>How we handle data is described in our <Link href="/privacy">Privacy policy</Link>. You can disconnect an account or delete your workspace at any time.</p>

      <H>Availability and liability</H>
      <p>rply is provided as is. We work to keep it running but do not guarantee it will be uninterrupted. To the extent the law allows, we are not liable for indirect losses or for replies sent based on your settings.</p>

      <H>Changes</H>
      <p>We may update these terms and will change the date above when we do.</p>

      <H>Contact</H>
      <p><a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
    </LegalPage>
  );
}
