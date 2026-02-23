import { useEffect } from "react";
import { useRouter } from "next/router";

export default function CreateAssessmentPage() {
  const router = useRouter();
  
  useEffect(() => {
    router.replace("/assessments/create-new");
  }, [router]);
  
  return null;
}
