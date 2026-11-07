import { AuthShell } from "@/components/auth/auth-shell";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function Page() {
  return (
    <AuthShell>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Thank you for signing up</CardTitle>
          <CardDescription>Check your email to confirm</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-muted-foreground">
            You&apos;ve successfully signed up. Check your email to confirm your
            account before signing in.
          </p>
        </CardContent>
      </Card>
    </AuthShell>
  );
}
