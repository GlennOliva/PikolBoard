"use client";

import { useEffect, useState } from "react";
import { Check, Copy, QrCode as QrCodeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/**
 * Share control for the public live board.
 *
 * The QR code is encoded in the browser: `qrcode` reaches for canvas, and doing
 * it on the client keeps the server component free of image generation while
 * still letting the code update if the URL ever changes. The encoder is a
 * dynamic import so it never lands in the initial bundle.
 */
export function ShareSession({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be blocked (insecure origin, denied permission).
      // The read-only input below is selectable either way.
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" size="sm" variant="outline" onClick={copy}>
        {copied ? (
          <Check className="mr-2 size-4" aria-hidden />
        ) : (
          <Copy className="mr-2 size-4" aria-hidden />
        )}
        {copied ? "Copied" : "Copy link"}
      </Button>

      <Dialog>
        <DialogTrigger asChild>
          <Button type="button" size="sm" variant="outline">
            <QrCodeIcon className="mr-2 size-4" aria-hidden />
            QR code
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Share this live board</DialogTitle>
            <DialogDescription>
              Anyone with the link can watch courts and standings. No account
              needed, and nothing private is exposed.
            </DialogDescription>
          </DialogHeader>

          <QrCode url={url} />

          <label className="sr-only" htmlFor="share-url">
            Share link
          </label>
          <input
            id="share-url"
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 font-mono text-xs"
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function QrCode({ url }: { url: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    import("qrcode")
      .then((module) =>
        module.toDataURL(url, {
          width: 480,
          margin: 2,
          errorCorrectionLevel: "M",
        }),
      )
      .then((value) => {
        if (!cancelled) setDataUrl(value);
      })
      .catch(() => {
        if (!cancelled) {
          setError("Could not draw a QR code. Copy the link instead.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  if (error) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {error}
      </p>
    );
  }

  if (!dataUrl) {
    return (
      <div
        className="mx-auto size-56 animate-pulse rounded-md bg-muted"
        aria-label="Generating QR code"
      />
    );
  }

  // A data URL from the qrcode encoder, sized inline; next/image would add an
  // optimizer round trip for no benefit.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={dataUrl}
      alt={`QR code linking to ${url}`}
      width={224}
      height={224}
      className="mx-auto size-56 rounded-md bg-white p-1"
    />
  );
}
