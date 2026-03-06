import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

const DEFAULT_DEVOPS_URL = "http://localhost:8010";

function getDevopsBaseUrl(): string {
  return (
    process.env.DEVOPS_SERVICE_URL ||
    process.env.DEVOPS_API_URL ||
    DEFAULT_DEVOPS_URL
  );
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const devopsBaseUrl = getDevopsBaseUrl();
  const { id } = req.query;
  const questionId = Array.isArray(id) ? id[0] : id;

  try {
    if (req.method === "GET" && !questionId) {
      const response = await axios.get(`${devopsBaseUrl}/api/v1/devops/questions/`);
      return res.status(response.status).json(response.data);
    }

    if (req.method === "DELETE" && questionId) {
      const response = await axios.delete(`${devopsBaseUrl}/api/v1/devops/questions/${questionId}`);
      return res.status(response.status).json(response.data);
    }

    if (req.method === "PATCH" && questionId) {
      const response = await axios.patch(
        `${devopsBaseUrl}/api/v1/devops/questions/${questionId}/publish`,
        req.body || {},
      );
      return res.status(response.status).json(response.data);
    }

    return res.status(405).json({ success: false, message: "Method not allowed" });
  } catch (error: any) {
    const status = error?.response?.status || 500;
    const payload = error?.response?.data || {
      success: false,
      message: "Failed to process DevOps questions request",
      detail: error?.message || "Unknown error",
    };
    return res.status(status).json(payload);
  }
}
