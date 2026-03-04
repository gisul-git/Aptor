import { useEffect } from "react";
import { useRouter } from "next/router";

export default function CloudRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/devops");
  }, [router]);

  return null;
}
