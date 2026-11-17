import Link from "next/link";
import { LegalPage, H, CONTACT_EMAIL } from "@/components/LegalPage";

export const metadata = { title: "Privacy policy — rply" };

export default function Privacy() {
  return (
    <LegalPage title="Privacy policy">
      <p>rply is a tool that helps businesses answer comments and direct messages on the Facebook Pages and Instagram professional accounts they own or manage. This policy explains what data rply handles, why, and how you can have it deleted.</p>

      <H>Who this applies to</H>
      <p><b>Customers</b> are the businesses that create a rply workspace and connect their accounts. <b>People</b> are the members of the public who comment on, or message, those accounts.</p>

      <H>What we collect</H>
      <ul>
        <li>Customer account details: name, email address, and a hashed password.</li>
        <li>Connected account details from Meta: Page and Instagram account ID, name, username, profile picture, and an access token. Access tokens are encrypted at rest.</li>
        <li>Messages and comments sent to a connected account, the replies rply or the customer sends, and the sender's public name, username and Meta-scoped ID.</li>
        <li>Knowledge the customer adds to rply (product facts, prices, FAQs, reply rules).</li>
      </ul>

      <H>How we use it</H>
      <p>We use this data only to provide the service: to read new comments and messages on accounts the customer connected, draft or send replies on the customer's behalf, show the conversation history in the customer's dashboard, and hand conversations to a human when needed. We do not sell data, use it for advertising, or build profiles of people across accounts.</p>

      <H>Data we receive from Meta</H>
      <p>rply uses the Facebook and Instagram APIs with the permissions the customer grants: reading and replying to comments, reading and sending messages, and listing the Pages and Instagram accounts the customer manages. We use Meta Platform Data only for the purposes above and in line with Meta's Platform Terms.</p>

      <H>Sharing</H>
      <p>To write a reply, the text of the incoming message and relevant knowledge are sent to an AI model provider (Google Gemini or OpenAI) that processes it on our behalf and does not use it to train its models under its API terms. Our hosting and database providers (Vercel and Supabase) store data for us. We do not share data with anyone else unless the law requires it.</p>

      <H>Retention</H>
      <p>Conversation data is kept while the account stays connected to a workspace. When a customer disconnects an account or deletes the workspace, its tokens are removed and its messages are deleted within 30 days.</p>

      <H id="deletion">Deleting your data</H>
      <p>Anyone can ask us to delete their data. See <Link href="/data-deletion">Data deletion</Link> for the steps, or email us.</p>

      <H>Security</H>
      <p>Data travels over HTTPS, access tokens are encrypted, and access to the database is limited to the service itself.</p>

      <H>Contact</H>
      <p>Questions about this policy: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
    </LegalPage>
  );
}
