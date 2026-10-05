import QRCode from "qrcode";

/**
 * Generates an SVG string representation of a QR code for the given text/URL.
 */
export async function generateQrSvg(text: string): Promise<string> {
  return QRCode.toString(text, {
    type: "svg",
    margin: 2,
    color: {
      dark: "#000000",
      light: "#ffffff",
    },
  });
}

/**
 * Generates a PNG Data URL of the QR code with customizable pixel resolution.
 */
export async function generateQrPngDataUrl(text: string, width = 1024): Promise<string> {
  return QRCode.toDataURL(text, {
    width,
    margin: 2,
    color: {
      dark: "#000000",
      light: "#ffffff",
    },
  });
}
