export type EmailValidationResult =
  | { valid: true }
  | { valid: false; message: string };

// NOTE:
// - Browsers + basic regex treat `gmail.co` as "valid email syntax".
// - Product requirement here is to catch common provider typos (e.g., gmail.co -> gmail.com)
//   and show a friendly error.
export function validateEmailWithCommonTypos(rawEmail: string): EmailValidationResult {
  const email = (rawEmail || "").trim().toLowerCase();

  // Basic sanity check
  const basicEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!basicEmailRegex.test(email)) {
    return { valid: false, message: "Email format is incorrect" };
  }

  const [, domain] = email.split("@");
  if (!domain) {
    return { valid: false, message: "Email format is incorrect" };
  }

  // Block a small set of high-confidence typos.
  const typoSuggestions: Record<string, string> = {
    "gmail.co": "gmail.com",
    "gmai.com": "gmail.com",
    "gamil.com": "gmail.com",
    "gmial.com": "gmail.com",
    "gmail.con": "gmail.com",
    "yahoo.co": "yahoo.com",
    "outlook.co": "outlook.com",
    "hotmail.co": "hotmail.com",
  };

  const suggestion = typoSuggestions[domain];
  if (suggestion) {
    return { valid: false, message: `Email format is incorrect. Did you mean ${suggestion}?` };
  }

  return { valid: true };
}


