"use client";

import React, { useEffect, useState } from "react";
import QRCode from "qrcode";

interface FbrQrCodeProps {
  value: string;
  size?: number;
  className?: string;
}

function getScannableQrUrl(val: string): string {
  if (!val) return "";

  let invoiceRef = val.trim();
  if (val.includes("inv=")) {
    try {
      const parsed = new URL(val.startsWith("http") ? val : `https://dummy.com/${val}`);
      invoiceRef = parsed.searchParams.get("inv") || val;
    } catch {
      const m = val.match(/inv=([^&]+)/);
      if (m) invoiceRef = decodeURIComponent(m[1]);
    }
  }

  // If the link points to the dead e.fbr.gov.pk/verify endpoint or is just an invoice reference
  if (val.includes("e.fbr.gov.pk/verify") || !val.startsWith("http")) {
    const origin =
      typeof window !== "undefined" && window.location?.origin
        ? window.location.origin
        : (process.env.NEXT_PUBLIC_APP_URL || "");

    return origin
      ? `${origin}/verify/fbr?inv=${encodeURIComponent(invoiceRef)}`
      : `/verify/fbr?inv=${encodeURIComponent(invoiceRef)}`;
  }

  return val;
}

export function FbrQrCode({ value, size = 160, className = "" }: FbrQrCodeProps) {
  const [dataUrl, setDataUrl] = useState<string>("");
  const targetUrl = getScannableQrUrl(value);

  useEffect(() => {
    if (!targetUrl) return;

    let isMounted = true;
    QRCode.toDataURL(targetUrl, {
      width: size * 2, // 2x for retina / sharp high DPI printing
      margin: 1,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
      errorCorrectionLevel: "M",
    })
      .then((url) => {
        if (isMounted) setDataUrl(url);
      })
      .catch((err) => {
        console.error("Failed to generate local QR code:", err);
        if (isMounted) {
          // Fallback to high-reliability online QR generator
          setDataUrl(`https://api.qrserver.com/v1/create-qr-code/?size=${size * 2}x${size * 2}&data=${encodeURIComponent(targetUrl)}`);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [targetUrl, size]);

  if (!value) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`flex items-center justify-center bg-slate-100 rounded text-slate-400 text-[10px] ${className}`}
      >
        No QR Data
      </div>
    );
  }

  // Initial fallback before render or while generating
  const imgSrc = dataUrl || `https://api.qrserver.com/v1/create-qr-code/?size=${size * 2}x${size * 2}&data=${encodeURIComponent(value)}`;

  return (
    <img
      src={imgSrc}
      alt="FBR POS Verification QR Code"
      width={size}
      height={size}
      className={`block object-contain bg-white rounded shadow-2xs ${className}`}
      style={{ width: size, height: size, imageRendering: "pixelated" }}
    />
  );
}
