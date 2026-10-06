import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy · Return Agent" };

/** Public privacy page. Google requires a privacy policy URL to publish the OAuth app. */
export default function Privacy() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-16 text-[15px] leading-relaxed text-ink-2 sm:px-8">
      <h1 className="mb-6 text-3xl font-semibold tracking-tight text-ink">Return Agent privacy policy</h1>
      <p className="mb-4">
        Return Agent is a personal tool that helps its owner track online shopping returns. Only Google accounts on the
        owner’s allowed list can sign in.
      </p>
      <h2 className="mb-2 mt-8 text-lg font-semibold text-ink">What it reads</h2>
      <p className="mb-4">
        With read-only Gmail access, Return Agent searches only for shopping-related email: order confirmations, shipping
        and delivery updates, return confirmations and refund confirmations. It never sends, deletes or changes email.
      </p>
      <h2 className="mb-2 mt-8 text-lg font-semibold text-ink">What it stores</h2>
      <p className="mb-4">
        Purchase details (retailer, item, price, order number, dates), a trimmed copy of the shopping emails they came
        from, return and refund status, and an encrypted Gmail access token. Emails that turn out not to be shopping are
        not stored.
      </p>
      <h2 className="mb-2 mt-8 text-lg font-semibold text-ink">Who it’s shared with</h2>
      <p className="mb-4">
        Shopping emails are sent to Anthropic’s Claude API to extract order details. Data is stored in the owner’s
        Supabase database. Nothing is sold or used for advertising.
      </p>
      <h2 className="mb-2 mt-8 text-lg font-semibold text-ink">Deleting your data</h2>
      <p className="mb-4">
        In the app, choose “Disconnect Gmail and delete data” to revoke access and delete everything stored. You can also
        remove access at myaccount.google.com/permissions.
      </p>
      <p className="mt-10 text-[13px] text-muted">Use of Gmail data adheres to the Google API Services User Data Policy, including its Limited Use requirements.</p>
    </main>
  );
}
