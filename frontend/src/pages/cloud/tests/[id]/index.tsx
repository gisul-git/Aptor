import { useEffect } from "react";
import { useRouter } from "next/router";

export default function CloudTestRouteForwarder() {
  const router = useRouter();
  const testId = typeof router.query.id === "string" ? router.query.id : undefined;
  const token = typeof router.query.token === "string" ? router.query.token : undefined;

  useEffect(() => {
    if (!router.isReady || !testId) return;
    if (token) {
      router.replace(`/cloud/tests/${testId}/entry?token=${encodeURIComponent(token)}`);
      return;
    }
    router.replace(`/cloud/tests/${testId}/take`);
  }, [router, testId, token]);

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <p>Redirecting...</p>
    </div>
  );
}
