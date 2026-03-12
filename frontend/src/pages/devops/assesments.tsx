import { useEffect } from "react";
import { useRouter } from "next/router";

export default function DevOpsAssesmentsAliasPage() {
  const router = useRouter();

  useEffect(() => {
    void router.replace("/devops/assessments");
  }, [router]);

  return null;
}
