import { useEffect, useState } from "react";

export default function PenpotTest() {
  const [penpotUrl, setPenpotUrl] = useState<string | null>(null);

  useEffect(() => {
    fetch(
      "http://localhost:3006/api/v1/design/penpot-session?candidate_id=c123&test_id=t001",
      { method: "POST" }
    )
      .then((res) => res.json())
      .then((data) => {
        console.log("Penpot session:", data);
        setPenpotUrl(data.iframe_url);
      });
  }, []);

  return (
    <div style={{ padding: "20px" }}>
      <h2>Penpot Design Playground (Next.js)</h2>

      {!penpotUrl && <p>Loading Penpot...</p>}

      {penpotUrl && (
        <iframe
          src={penpotUrl}
          width="100%"
          height="750px"
          style={{ border: "none" }}
          allow="fullscreen"
        />
      )}
    </div>
  );
}
