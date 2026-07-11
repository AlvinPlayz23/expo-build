import { NextRequest } from "next/server";
import QRCode from "qrcode";

// Renders any text (an exp:// URL) as an SVG QR code. Kept as a tiny GET route
// so the client can just point an <img> at /api/qr?data=… .
export async function GET(req: NextRequest) {
  const data = req.nextUrl.searchParams.get("data");
  if (!data) {
    return new Response("Missing ?data=", { status: 400 });
  }
  const svg = await QRCode.toString(data, {
    type: "svg",
    margin: 1,
    width: 240,
    errorCorrectionLevel: "M",
  });
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
