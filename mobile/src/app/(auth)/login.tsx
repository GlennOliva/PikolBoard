import { useState } from "react";
import { router } from "expo-router";
import { ScrollView, StyleSheet, Text } from "react-native";

import { Button, Card, Field, ErrorNotice } from "@/components/ui";
import { Screen, ScreenHeader, goBack } from "@/components/ui/screen";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { useAuth } from "@/lib/auth-context";

export default function LoginScreen() {
  const theme = useTheme();
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    setNotice(null);
    if (!email.trim() || password.length < 6) {
      setError("Enter your email and a password of at least 6 characters.");
      return;
    }

    setBusy(true);
    const result =
      mode === "signin"
        ? await signIn(email.trim(), password)
        : await signUp(email.trim(), password);
    setBusy(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    if (mode === "signup") {
      setNotice("Account created. If email confirmation is on, check your inbox, then sign in.");
      setMode("signin");
      return;
    }

    router.replace("/clubs");
  }

  return (
    <Screen>
      <ScreenHeader
        title={mode === "signin" ? "Organizer Sign In" : "Create Account"}
        onBack={goBack}
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card style={styles.card}>
          {error ? <ErrorNotice message={error} /> : null}
          {notice ? (
            <Text style={[styles.notice, { color: theme.success }]}>{notice}</Text>
          ) : null}

          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            placeholder="you@club.com"
          />
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            placeholder="••••••"
          />

          <Button
            label={mode === "signin" ? "Sign in" : "Create account"}
            onPress={() => void submit()}
            loading={busy}
            size="lg"
          />
          <Button
            label={mode === "signin" ? "Need an account? Sign up" : "Have an account? Sign in"}
            variant="ghost"
            onPress={() => {
              setError(null);
              setNotice(null);
              setMode(mode === "signin" ? "signup" : "signin");
            }}
          />
        </Card>

        <Text style={[styles.footnote, { color: theme.textMuted }]}>
          Organizers use the same credentials as the Pickleboard web app.
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.four, gap: Spacing.three },
  card: { gap: Spacing.three },
  notice: { fontSize: 14 },
  footnote: { fontSize: 13, textAlign: "center" },
});
