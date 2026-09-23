/** PWA 아이콘 (ImageResponse 용). 상승·하락 캔들 두 개 */
export function AppIcon({ size }: { size: number }) {
  const u = size / 16;
  return (
    <div style={{ width: size, height: size, background: "#0e0f13", display: "flex", alignItems: "center", justifyContent: "center", gap: u * 1.5 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ width: u * 0.5, height: u * 1.5, background: "#f04452" }} />
        <div style={{ width: u * 3, height: u * 6, background: "#f04452", borderRadius: u * 0.5 }} />
        <div style={{ width: u * 0.5, height: u * 1.5, background: "#f04452" }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: u * 3 }}>
        <div style={{ width: u * 0.5, height: u * 1, background: "#3182f6" }} />
        <div style={{ width: u * 3, height: u * 4, background: "#3182f6", borderRadius: u * 0.5 }} />
        <div style={{ width: u * 0.5, height: u * 1.5, background: "#3182f6" }} />
      </div>
    </div>
  );
}
