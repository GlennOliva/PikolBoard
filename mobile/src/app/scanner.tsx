import { useState } from "react";
import { router } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import { StyleSheet, Text, View } from "react-native";

import { Button, EmptyState, LoadingState } from "@/components/ui";
import { Screen, ScreenHeader, goBack } from "@/components/ui/screen";
import { Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { extractPublicTokenFromScan } from "@/lib/domain/live-board/live-board-url";

export default function ScannerScreen() {
  const theme = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [unrecognized, setUnrecognized] = useState(false);

  function handleScan(data: string) {
    if (scanned) return;
    const token = extractPublicTokenFromScan(data);
    if (!token) {
      setUnrecognized(true);
      return;
    }
    setScanned(true);
    router.replace(`/live/${token}`);
  }

  return (
    <Screen>
      <ScreenHeader title="Scan Live Board" onBack={goBack} />
      {!permission ? (
        <LoadingState label="Checking camera…" />
      ) : !permission.granted ? (
        <EmptyState
          title="Camera access needed"
          message="Pickleboard uses the camera only to read the clubhouse QR code."
          actionLabel="Allow camera"
          onAction={() => void requestPermission()}
        />
      ) : (
        <View style={styles.wrap}>
          <View style={[styles.frame, { borderColor: theme.primary }]}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              active={!scanned}
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
              onBarcodeScanned={({ data }) => handleScan(data)}
            />
          </View>
          <Text style={[styles.hint, { color: theme.textSecondary }]}>
            {unrecognized
              ? "That code is not a Pickleboard Live Board. Keep the QR in the frame."
              : "Point the camera at the Live Board QR code."}
          </Text>
          <Button label="Cancel" variant="secondary" onPress={goBack} />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: Spacing.four, gap: Spacing.four, alignItems: "center" },
  frame: {
    width: "100%",
    aspectRatio: 1,
    maxHeight: 420,
    borderRadius: Radius.lg,
    borderWidth: 3,
    overflow: "hidden",
    alignSelf: "center",
  },
  hint: { fontSize: 14, textAlign: "center" },
});
