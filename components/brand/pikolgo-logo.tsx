import Image from "next/image";
import logo from "@/app/pikolgo_logo.png";
import { cn } from "@/lib/utils";

/**
 * The supplied wordmark is dark navy with a lime accent. It cannot sit directly
 * on the dark Retro-Futurism surfaces, so it is presented on a light brand plate
 * by default. The asset itself is never recoloured, stretched, or cropped.
 */
export function PikolgoLogo({
  className,
  priority = false,
  sizes = "200px",
  plate = true,
}: {
  className?: string;
  priority?: boolean;
  sizes?: string;
  plate?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        plate && "retro-logo-plate",
        className,
      )}
    >
      <Image
        src={logo}
        alt="PikolGo"
        width={2172}
        height={724}
        priority={priority}
        sizes={sizes}
        className="h-full w-auto"
      />
    </span>
  );
}
