import type { NextApiRequest, NextApiResponse } from "next";

import fastApiClient from "../../../lib/fastapi";

interface SignupPayload {
  name: string;
  email: string;
  password: string;
  organization?: string;
  phone?: string;
  country?: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const { name, email, password, organization, phone, country } = req.body as SignupPayload;

  if (!name || !email || !password) {
    return res.status(400).json({ message: "Name, email, and password are required" });
  }

  try {
    const payload: any = {
      name,
      email,
      password,
    };
    
    // Add optional fields if provided
    if (organization) {
      payload.organization = organization;
    }
    if (phone) {
      payload.phone = phone;
    }
    if (country) {
      payload.country = country;
    }
    
    const response = await fastApiClient.post("/api/v1/auth/org-signup-email", payload);
    return res.status(response.status).json(response.data);
  } catch (error: any) {
    const statusCode = error?.response?.status || 500;
    const errorMessage = error?.response?.data?.detail || 
                        error?.response?.data?.message || 
                        error?.message || 
                        "Signup failed";
    return res.status(statusCode).json({ message: errorMessage });
  }
}


