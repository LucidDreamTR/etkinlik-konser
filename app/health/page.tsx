const HEALTH_VERSION = "480f052";

export default function HealthPage() {
  return (
    <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
      <h1>OK {HEALTH_VERSION}</h1>
    </main>
  );
}
