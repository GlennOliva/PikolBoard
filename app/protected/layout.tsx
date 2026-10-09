/**
 * The authenticated app shell lives in the root layout so the dashboard,
 * club, and session routes share it. This file only exists to keep the
 * /protected prefix working as the post-login landing page.
 */
export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="flex flex-col gap-8">{children}</div>;
}
