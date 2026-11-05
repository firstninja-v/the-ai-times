import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#111111",
          borderRadius: 36,
        }}
      >
        <div style={{ width: 112, height: 8, background: "#F5F2EA", marginBottom: 18 }} />
        <div
          style={{
            fontSize: 92,
            fontWeight: 700,
            color: "#F5F2EA",
            fontFamily: "Georgia, Times New Roman, serif",
            lineHeight: 1,
          }}
        >
          T
        </div>
        <div style={{ width: 78, height: 6, background: "#C62828", marginTop: 16 }} />
      </div>
    ),
    size,
  );
}
