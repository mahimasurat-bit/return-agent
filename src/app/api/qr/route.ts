import { type NextRequest } from "next/server";
import QRCode from "qrcode";

/**
 * PNG QR image for a return code, used in digest emails (email clients can't
 * render the in-app SVG). Encodes only the text it's given.
 */
export async function GET(req: NextRequest) {
  const d = (req.nextUrl.searchParams.get("d") ?? "").slice(0, 120);
  if (!d.trim()) return new Response("Missing d", { status: 400 });
  const png = await QRCode.toBuffer(d, { errorCorrectionLevel: "M", margin: 2, width: 360, color: { dark: "#111111", light: "#ffffff" } });
  return new Response(new Uint8Array(png), {
    headers: { "content-type": "image/png", "cache-control": "public, max-age=31536000, immutable" },
  });
}
