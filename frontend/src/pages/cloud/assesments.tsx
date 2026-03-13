import { useEffect } from "react";
import { useRouter } from "next/router";

export default function CloudAssesmentsAliasPage() {
  const router = useRouter();

  useEffect(() => {
    void router.replace("/cloud/assessments");
  }, [router]);

  return null;
}


