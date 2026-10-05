"use client";

import React, { useEffect, useState } from "react";
import QRCode from "qrcode";

interface FbrQrCodeProps {
  value: string;
  size?: number;
  className?: string;
}

export function FbrQrCode({ value, size = 160, className = "" }: FbrQrCodeProps) {
  const [dataUrl, setDataUrl] = useState<string>("");

  useEffect(() => {
    if (!value) return;

    let isMounted = true;
    QRCode.toDataURL(value, {
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
          setDataUrl(`https://api.qrserver.com/v1/create-qr-code/?size=${size * 2}x${size * 2}&data=${encodeURIComponent(value)}`);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [value, size]);

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
