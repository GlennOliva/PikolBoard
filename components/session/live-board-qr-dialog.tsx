"use client";

import { useEffect, useState } from "react";
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  Maximize2,
  Minimize2,
  QrCode as QrCodeIcon,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  liveBoardQrFilename,
  resolveLiveBoardUrl,
} from "@/lib/domain/live-board/live-board-url";
import { cn } from "@/lib/utils";

export interface LiveBoardQrDialogProps {
  clubSlug: string;
  publicToken: string;
  sessionName: string;
  clubName: string;
}

/** Organizer controls for one session-specific Player Live View capability. */
export function LiveBoardQrDialog(props: LiveBoardQrDialogProps) {
  const [browserOrigin, setBrowserOrigin] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => setBrowserOrigin(window.location.origin), []);

  const resolved = resolveLiveBoardUrl({
    ...props,
    appUrl: process.env.NEXT_PUBLIC_APP_URL,
    browserOrigin,
  });

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(resolved.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Dialog onOpenChange={(open) => !open && setExpanded(false)}>
        <DialogTrigger asChild>
          <Button type="button" size="sm">
            <QrCodeIcon className="mr-2 size-4" aria-hidden />
            Show Player QR Code
          </Button>
        </DialogTrigger>
        <DialogContent
          className={cn(
            "max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-xl",
            expanded && "inset-0 top-0 left-0 h-dvh max-h-none max-w-none translate-x-0 translate-y-0 rounded-none border-0 sm:max-w-none",
          )}
        >
          <DialogHeader className="text-center sm:text-center">
            <DialogTitle>Scan to open the Player Live View</DialogTitle>
            <DialogDescription>
              Scan to view Live Matches, Up Next, Queue, and Leaderboard
            </DialogDescription>
          </DialogHeader>

          <QrImage
            url={resolved.url}
            blocked={resolved.isUnreachableFromAnotherDevice}
            warning={resolved.warning}
            expanded={expanded}
            filename={liveBoardQrFilename(props.clubSlug, props.sessionName)}
          />

          <div className="text-center">
            <p className="font-semibold">{props.sessionName}</p>
            <p className="text-sm text-muted-foreground">{props.clubName}</p>
          </div>

          <p className="break-all rounded-md border bg-muted/40 p-2 text-center font-mono text-xs">
            {resolved.url}
          </p>

          <div className="flex flex-wrap justify-center gap-2">
            <Button type="button" variant="outline" onClick={copyLink}>
              {copied ? <Check className="mr-2 size-4" aria-hidden /> : <Copy className="mr-2 size-4" aria-hidden />}
              {copied ? "Copied" : "Copy Link"}
            </Button>
            <Button asChild variant="outline">
              <a href={resolved.url} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 size-4" aria-hidden />
                Open Player View
              </a>
            </Button>
            <Button type="button" variant="outline" onClick={() => setExpanded((value) => !value)}>
              {expanded ? <Minimize2 className="mr-2 size-4" aria-hidden /> : <Maximize2 className="mr-2 size-4" aria-hidden />}
              {expanded ? "Exit Full Screen" : "Full Screen"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Button type="button" size="sm" variant="outline" onClick={copyLink}>
        {copied ? <Check className="mr-2 size-4" aria-hidden /> : <Copy className="mr-2 size-4" aria-hidden />}
        {copied ? "Copied" : "Copy Link"}
      </Button>
      <Button asChild size="sm" variant="outline">
        <a href={resolved.url} target="_blank" rel="noreferrer">
          <ExternalLink className="mr-2 size-4" aria-hidden />
          Open Player View
        </a>
      </Button>
    </div>
  );
}

function QrImage({
  url,
  blocked,
  warning,
  expanded,
  filename,
}: {
  url: string;
  blocked: boolean;
  warning: string | null;
  expanded: boolean;
  filename: string;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setDataUrl(null);
    setError(null);

    // Never encode loopback. Showing the warning without drawing a scannable
    // image prevents an organizer from accidentally putting a broken QR on a
    // projector and discovering the problem only after players arrive.
    if (blocked) return;

    import("qrcode")
      .then((module) =>
        module.toDataURL(url, {
          width: 1200,
          margin: 4,
          errorCorrectionLevel: "H",
          color: { dark: "#000000", light: "#ffffff" },
        }),
      )
      .then((value) => {
        if (!cancelled) setDataUrl(value);
      })
      .catch(() => {
        if (!cancelled) setError("Could not draw the QR code. Copy the link instead.");
      });

    return () => {
      cancelled = true;
    };
  }, [blocked, url]);

  if (blocked) {
    return (
      <div role="alert" className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
        <p className="flex items-start gap-2 font-medium">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {warning}
        </p>
      </div>
    );
  }

  if (error) return <p role="alert" className="text-sm text-destructive">{error}</p>;
  if (!dataUrl) {
    return <div className="mx-auto size-72 animate-pulse rounded-lg bg-muted" aria-label="Generating QR code" />;
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {/* A PNG data URL generated locally; next/image would add an optimizer trip. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={dataUrl}
        alt={`QR code linking to the ${url} Live Board`}
        width={expanded ? 560 : 360}
        height={expanded ? 560 : 360}
        className={cn("rounded-lg bg-white p-2", expanded ? "size-[min(70vh,35rem)]" : "size-72 sm:size-[22.5rem]")}
      />
      <Button asChild type="button" variant="outline">
        <a href={dataUrl} download={filename}>
          <Download className="mr-2 size-4" aria-hidden />
          Download QR Code
        </a>
      </Button>
    </div>
  );
}
