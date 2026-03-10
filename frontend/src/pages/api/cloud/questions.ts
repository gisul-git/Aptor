import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

const DEFAULT_CLOUD_URL = "http://localhost:8010";

function getDevopsBaseUrl(): string {
  return (
    process.env.CLOUD_SERVICE_URL ||
    process.env.CLOUD_API_URL ||
    DEFAULT_CLOUD_URL
  );
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const cloudBaseUrl = getDevopsBaseUrl();
  const { id, published } = req.query;
  const questionId = Array.isArray(id) ? id[0] : id;
  const publishedOnly = Array.isArray(published) ? published[0] : published;

  try {
    if (req.method === "GET" && !questionId) {
      if (publishedOnly === "1" || publishedOnly === "true") {
        const response = await axios.get(`${cloudBaseUrl}/api/v1/cloud/questions/published`);
        return res.status(response.status).json(response.data);
      }
      const response = await axios.get(`${cloudBaseUrl}/api/v1/cloud/questions/`);
      return res.status(response.status).json(response.data);
    }

    if (req.method === "DELETE" && questionId) {
      const response = await axios.delete(`${cloudBaseUrl}/api/v1/cloud/questions/${questionId}`);
      return res.status(response.status).json(response.data);
    }

    if (req.method === "PATCH" && questionId) {
      const response = await axios.patch(
        `${cloudBaseUrl}/api/v1/cloud/questions/${questionId}/publish`,
        req.body || {},
      );
      return res.status(response.status).json(response.data);
    }

    return res.status(405).json({ success: false, message: "Method not allowed" });
  } catch (error: any) {
    const status = error?.response?.status || 500;
    const payload = error?.response?.data || {
      success: false,
      message: "Failed to process Cloud questions request",
      detail: error?.message || "Unknown error",
    };
    return res.status(status).json(payload);
  }
}

