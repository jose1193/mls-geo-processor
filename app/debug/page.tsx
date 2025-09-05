// Script para debuggear las variables de entorno en Railway
console.log("🔍 Debugging Environment Variables:");
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("AUTH_URL:", process.env.AUTH_URL);
console.log("NEXTAUTH_URL:", process.env.NEXTAUTH_URL);
console.log("AUTH_TRUST_HOST:", process.env.AUTH_TRUST_HOST);
console.log("PORT:", process.env.PORT);

// También podemos verificar las headers del request
export default function DebugPage() {
  return (
    <div style={{ padding: "20px", fontFamily: "monospace" }}>
      <h1>🔍 Environment Debug</h1>
      <pre>
        NODE_ENV: {process.env.NODE_ENV}
        {"\n"}
        AUTH_URL: {process.env.AUTH_URL}
        {"\n"}
        NEXTAUTH_URL: {process.env.NEXTAUTH_URL}
        {"\n"}
        AUTH_TRUST_HOST: {process.env.AUTH_TRUST_HOST}
        {"\n"}
        PORT: {process.env.PORT}
      </pre>
    </div>
  );
}
