export default function Logo({ size = 24, showText = true }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: 8,
          background: "linear-gradient(135deg, #1f8a5e 0%, #24c27c 100%)",
          boxShadow: "0 8px 20px rgba(20, 80, 60, 0.15)",
        }}
      />
      {showText && <span style={{ fontWeight: 700, letterSpacing: 0.5 }}>Escrow</span>}
    </div>
  );
}
