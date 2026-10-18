"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

/** 참가 QR — 수산시장 딜러 콘솔의 「📲 참가 QR」과 같은 방식.
 *  - QR은 `{origin}/?code=방코드` 를 담는다(입장 화면이 code를 읽어 방 코드를 미리 채운다).
 *  - origin은 hydration 불일치를 피해 마운트 후 window에서 읽는다.
 *  - QR은 반드시 흰 바탕 위에 그린다(어두운 화면 위에 직접 그리면 인식률이 떨어진다). */
export function JoinQr({ code, size = 360 }: { code: string; size?: number }) {
  const [qr, setQr] = useState<{ dataUrl: string; href: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const url = `${window.location.origin}/?code=${encodeURIComponent(code)}`;
    QRCode.toDataURL(url, { width: size, margin: 1 }).then((d) => {
      if (!cancelled) setQr({ dataUrl: d, href: url });
    });
    return () => {
      cancelled = true;
    };
  }, [code, size]);

  return (
    <div className="flex flex-col items-center gap-3" data-testid="join-qr">
      <div className="rounded-2xl bg-white p-4" style={{ width: size + 32, height: size + 32 }}>
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr.dataUrl} alt="참가 QR 코드" width={size} height={size} />
        ) : (
          <div style={{ width: size, height: size }} className="animate-pulse bg-zinc-200" />
        )}
      </div>
      {qr && <p className="sr-only">{qr.href}</p>}
    </div>
  );
}
