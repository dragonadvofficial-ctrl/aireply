import { LegalPage, H, CONTACT_EMAIL } from "@/components/LegalPage";

export const metadata = { title: "Data deletion — rply" };

export default async function DataDeletion({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams;
  return (
    <LegalPage title="Data deletion">
      {code && (
        <p style={{ padding: 16, borderRadius: 14, background: "var(--paper-deep)" }}>
          Your deletion request was received and processed. Confirmation code: <b>{code}</b>
        </p>
      )}

      <H>If you messaged or commented on a business that uses rply</H>
      <ol>
        <li>Open Facebook and go to Settings &amp; privacy, then Settings.</li>
        <li>Open Apps and websites, find rply, and choose Remove.</li>
        <li>Select the option to delete your data. Meta notifies us and we delete your messages and contact record automatically, then show a confirmation code here.</li>
      </ol>
      <p>You can also email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> with the account name you used. We delete your data within 30 days and reply to confirm.</p>

      <H>If you are a rply customer</H>
      <ol>
        <li>Open Accounts in your rply workspace and disconnect the Page or Instagram account. rply stops processing it immediately.</li>
        <li>To delete everything, email us from your workspace email and we delete the workspace, its tokens and its messages within 30 days.</li>
      </ol>
    </LegalPage>
  );
}
