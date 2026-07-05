export default function Home() {
  return (
    <main
      style={{
        fontFamily: "system-ui, sans-serif",
        padding: "2rem",
        lineHeight: 1.6,
      }}
    >
      <h1>ServiceHub API</h1>
      <p>Minimal backend for the services catalog.</p>
      <ul>
        <li>
          <a href="/api/services">GET /api/services</a> — paginated catalog
        </li>
        <li>
          <a href="/api-doc">/api-doc</a> — Swagger UI
        </li>
        <li>
          <a href="/api/openapi.json">/api/openapi.json</a> — OpenAPI spec
        </li>
      </ul>
    </main>
  );
}
