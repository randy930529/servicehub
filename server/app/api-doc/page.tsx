import ReactSwagger from "./react-swagger";

export const metadata = {
  title: "ServiceHub API — Docs",
};

/** Interactive API documentation (Swagger UI). */
export default function ApiDocPage() {
  return (
    <main>
      <ReactSwagger />
    </main>
  );
}
