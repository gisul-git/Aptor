"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../../components/dsa/ui/card";
import { Button } from "../../../components/dsa/ui/button";
import { Input } from "../../../components/dsa/ui/input";
import { Textarea } from "../../../components/dsa/ui/textarea";
import { Checkbox } from "../../../components/dsa/ui/checkbox";
import dsaApi from "../../../lib/dsa/api";
import {
  ArrowLeft,
  Sparkles,
  Loader2,
  Code,
  Database,
  Table2,
  Settings,
  AlignLeft,
  List,
  CheckSquare,
  Sliders,
  PlaySquare,
  Lock,
  FileCode,
  Eye,
  EyeOff,
  AlertCircle,
  Plus,
  Trash2,
  X,
  Wand2,
  Cpu,
  FlaskConical,
  ShieldCheck,
  Code2,
  LayoutGrid,
  Search,
  BadgeCheck,
  CheckCircle2,
} from "lucide-react";

// Question type - Coding or SQL
type QuestionType = "coding" | "sql";

type Testcase = {
  input: string | any; // Can be string or object (object will be formatted for display)
  expected_output?: string; // Optional for AI-generated questions
};

const getExpectedOutputPlaceholder = (returnType: string) => {
  const rt = (returnType || "").trim();
  switch (rt) {
    case "int":
    case "long":
      return "e.g., 5";
    case "int[]":
    case "long[]":
      return "e.g., 0 1";
    case "boolean":
      return "e.g., true";
    case "string":
      return "e.g., hello";
    default:
      return "e.g., 5";
  }
};

const getStdinPlaceholder = () => {
  return "Raw stdin only (no variable names, no JSON arrays like [1,2,3])";
};

const parseTableSchema = (
  text: string,
): { tableName?: string; columns: Record<string, string> } => {
  const lines = text.split("\n").filter((line) => line.trim());
  if (lines.length === 0) {
    throw new Error("No data found");
  }

  // Try to detect format
  const firstLine = lines[0].trim();
  const isMarkdown = firstLine.includes("|");
  const isTabSeparated = firstLine.includes("\t");

  let headerLine = 0;
  let dataStart = 1;

  // Skip markdown separator line if present
  if (
    isMarkdown &&
    lines.length > 1 &&
    lines[1].trim().match(/^\|[\s\-:]+\|/)
  ) {
    headerLine = 0;
    dataStart = 2;
  }

  // Parse header
  const header = isMarkdown
    ? firstLine
        .split("|")
        .map((h) => h.trim())
        .filter((h) => h)
    : isTabSeparated
      ? firstLine.split("\t").map((h) => h.trim())
      : firstLine.split(/\s{2,}|\t/).map((h) => h.trim());

  // Find Column and Type columns (case-insensitive)
  const columnIdx = header.findIndex(
    (h) => h.toLowerCase().includes("column") || h.toLowerCase() === "col",
  );
  const typeIdx = header.findIndex(
    (h) => h.toLowerCase().includes("type") || h.toLowerCase() === "datatype",
  );

  if (columnIdx === -1 || typeIdx === -1) {
    // If no header found, assume first two columns are Column and Type
    if (header.length < 2) {
      throw new Error("Need at least 2 columns: Column and Type");
    }
  }

  const actualColumnIdx = columnIdx >= 0 ? columnIdx : 0;
  const actualTypeIdx = typeIdx >= 0 ? typeIdx : 1;

  // Parse data rows
  const columns: Record<string, string> = {};
  for (let i = dataStart; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Skip markdown separator lines
    if (isMarkdown && line.match(/^\|[\s\-:]+\|/)) continue;

    const parts = isMarkdown
      ? line
          .split("|")
          .map((p) => p.trim())
          .filter((p) => p)
      : isTabSeparated
        ? line.split("\t").map((p) => p.trim())
        : line.split(/\s{2,}|\t/).map((p) => p.trim());

    if (parts.length < 2) continue;

    // Remove any trailing ✕ or X characters
    const colName = parts[actualColumnIdx].replace(/[\s✕×xX]+$/, "").trim();
    const colType = parts[actualTypeIdx].replace(/[\s✕×xX]+$/, "").trim();

    if (colName && colType) {
      // Normalize common type names
      const normalizedType = colType
        .toUpperCase()
        .replace(/^INT$/, "INTEGER")
        .replace(/^VARCHAR$/, "VARCHAR(255)")
        .replace(/^TEXT$/, "TEXT")
        .replace(/^BOOL$/, "BOOLEAN");

      columns[colName] = normalizedType;
    }
  }

  return { columns };
};

// Parse sample data from pasted text
// Supports formats like:
// - Tab-separated: "employee_id\temployee_name\n1\tJohn"
// - Space-separated: "employee_id employee_name\n1 John"
// - Markdown table: "| employee_id | employee_name |\n|-------------|---------------|\n| 1 | John |"
const parseSampleData = (text: string, columns: string[]): any[][] => {
  const lines = text.split("\n").filter((line) => line.trim());
  if (lines.length === 0) {
    throw new Error("No data found");
  }

  const firstLine = lines[0].trim();
  const isMarkdown = firstLine.includes("|");
  const isTabSeparated = firstLine.includes("\t");

  let headerLine = 0;
  let dataStart = 1;

  // Skip markdown separator line if present
  if (
    isMarkdown &&
    lines.length > 1 &&
    lines[1].trim().match(/^\|[\s\-:]+\|/)
  ) {
    headerLine = 0;
    dataStart = 2;
  }

  // Parse header to get column order
  const header = isMarkdown
    ? firstLine
        .split("|")
        .map((h) => h.trim())
        .filter((h) => h)
    : isTabSeparated
      ? firstLine.split("\t").map((h) => h.trim())
      : firstLine.split(/\s{2,}|\t/).map((h) => h.trim());

  // Map header columns to expected columns
  const columnMap: number[] = [];
  columns.forEach((col) => {
    const idx = header.findIndex((h) => h.toLowerCase() === col.toLowerCase());
    columnMap.push(idx >= 0 ? idx : -1);
  });

  // Parse data rows
  const rows: any[][] = [];
  for (let i = dataStart; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Skip markdown separator lines
    if (isMarkdown && line.match(/^\|[\s\-:]+\|/)) continue;

    const parts = isMarkdown
      ? line
          .split("|")
          .map((p) => p.trim())
          .filter((p) => p)
      : isTabSeparated
        ? line.split("\t").map((p) => p.trim())
        : line.split(/\s{2,}|\t/).map((p) => p.trim());

    if (parts.length === 0) continue;

    // Build row in the correct column order
    const row: any[] = [];
    columnMap.forEach((mapIdx) => {
      if (mapIdx >= 0 && mapIdx < parts.length) {
        const value = parts[mapIdx].trim();
        // Try to parse as number if it looks like a number
        if (value && !isNaN(Number(value)) && value !== "") {
          row.push(Number(value));
        } else if (value === "" || value.toLowerCase() === "null") {
          row.push(null);
        } else {
          row.push(value);
        }
      } else {
        row.push("");
      }
    });

    rows.push(row);
  }

  return rows;
};

// Helper function to safely convert input to string for display
const formatTestcaseInput = (input: any): string => {
  if (input === null || input === undefined) {
    return "";
  }
  if (typeof input === "string") {
    return input;
  }
  if (typeof input === "object") {
    // Convert object to JSON string with proper formatting
    try {
      return JSON.stringify(input, null, 2);
    } catch (e) {
      return String(input);
    }
  }
  return String(input);
};

// Helper function to safely convert expected_output to string for display
const formatTestcaseExpectedOutput = (output: any): string => {
  if (output === null || output === undefined) {
    return "";
  }
  if (typeof output === "string") {
    return output;
  }
  if (typeof output === "object") {
    try {
      return JSON.stringify(output, null, 2);
    } catch (e) {
      return String(output);
    }
  }
  return String(output);
};

// Helper function to parse testcase input back to object if it's valid JSON, otherwise keep as string
const parseTestcaseInput = (input: string): any => {
  if (!input || !input.trim()) {
    return input;
  }
  // Try to parse as JSON object
  try {
    const parsed = JSON.parse(input.trim());
    // If it's an object, return it; otherwise return the original string
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed)
    ) {
      return parsed;
    }
    // If it's an array or primitive, return original string (legacy format)
    return input;
  } catch (e) {
    // Not valid JSON, return as string (legacy stdin format)
    return input;
  }
};

// Helper to parse expected_output into JSON value when possible
const parseTestcaseExpectedOutput = (output: any): any => {
  // If it's already a non-string value (e.g., object/array/number/boolean from AI),
  // just return it as-is.
  if (output !== null && output !== undefined && typeof output !== "string") {
    return output;
  }

  const str = (output || "").toString();
  if (!str.trim()) {
    return "";
  }

  try {
    const parsed = JSON.parse(str.trim());
    return parsed;
  } catch (e) {
    // Not valid JSON, keep as string
    return str;
  }
};

// Helper function to safely check if testcase input is non-empty (handles both string and object)
const isTestcaseInputNonEmpty = (input: any): boolean => {
  if (!input) {
    return false;
  }
  if (typeof input === "string") {
    return input.trim().length > 0;
  }
  if (typeof input === "object") {
    // For objects, check if it has any properties
    return Object.keys(input).length > 0;
  }
  return false;
};

// DSA (Data Structures & Algorithms) supported languages
// These are commonly used languages for competitive programming and DSA
const SUPPORTED_LANGUAGES = [
  "python", // Python - most popular for DSA
  "javascript", // JavaScript - web-based DSA
  "cpp", // C++ - standard for competitive programming
  "java", // Java - widely used for DSA
  "c", // C - fundamental language for DSA
  "go", // Go - growing in popularity
  "rust", // Rust - modern systems language
  "csharp", // C# - used in some DSA contexts
  "kotlin", // Kotlin - Android development, DSA
  "typescript", // TypeScript - JavaScript with types
];

const DEFAULT_STARTER_CODE: Record<string, string> = {
  python: `def solution():
    # Your code here
    pass
`,
  javascript: `function solution() {
    // Your code here
}
`,
  typescript: `function solution(): void {
    // Your code here
}
`,
  cpp: `#include <iostream>
using namespace std;

int main() {
    // Your code here
    return 0;
}
`,
  java: `public class Main {
    public static void main(String[] args) {
        // Your code here
    }
}
`,
  c: `#include <stdio.h>

int main() {
    // Your code here
    return 0;
}
`,
  go: `package main

import "fmt"

func main() {
    // Your code here
}
`,
  rust: `fn main() {
    // Your code here
}
`,
  csharp: `using System;

class Program {
    static void Main(string[] args) {
        // Your code here
    }
}
`,
  kotlin: `fun main() {
    // Your code here
}
`,
};

// SQL Categories
const SQL_CATEGORIES = [
  {
    value: "select",
    label: "SELECT Queries",
    description: "Basic data retrieval",
  },
  {
    value: "join",
    label: "JOIN Operations",
    description: "INNER, LEFT, RIGHT, FULL joins",
  },
  {
    value: "aggregation",
    label: "Aggregation",
    description: "GROUP BY, HAVING, COUNT, SUM",
  },
  {
    value: "subquery",
    label: "Subqueries",
    description: "Nested queries, EXISTS, IN",
  },
  {
    value: "window",
    label: "Window Functions",
    description: "ROW_NUMBER, RANK, LAG, LEAD",
  },
];

// SQL Topics for quick selection
const SQL_TOPICS = [
  "Basic SELECT",
  "Filtering with WHERE",
  "INNER JOIN",
  "LEFT JOIN",
  "GROUP BY",
  "HAVING Clause",
  "Aggregate Functions",
  "Subqueries",
  "Window Functions",
  "RIGHT JOIN",
  "FULL OUTER JOIN",
  "CROSS JOIN",
  "UNION",
  "INTERSECT",
  "EXCEPT",
  "ORDER BY",
  "LIMIT",
  "OFFSET",
  "DISTINCT",
  "CASE WHEN",
  "NULL Handling",
  "String Functions",
  "Date Functions",
  "Numeric Functions",
  "CTEs (Common Table Expressions)",
  "Recursive CTEs",
  "PIVOT/UNPIVOT",
  "Ranking Functions",
];

// SQL Concepts for quick selection
const SQL_CONCEPTS = [
  "SELECT",
  "FROM",
  "WHERE",
  "INNER JOIN",
  "LEFT JOIN",
  "RIGHT JOIN",
  "FULL OUTER JOIN",
  "GROUP BY",
  "HAVING",
  "ORDER BY",
  "LIMIT",
  "OFFSET",
  "DISTINCT",
  "UNION",
  "INTERSECT",
  "EXCEPT",
  "CASE WHEN",
  "NULL",
  "IS NULL",
  "IS NOT NULL",
  "COUNT",
  "SUM",
  "AVG",
  "MAX",
  "MIN",
  "ROW_NUMBER",
  "RANK",
  "DENSE_RANK",
  "PARTITION BY",
  "OVER",
  "LAG",
  "LEAD",
  "FIRST_VALUE",
  "LAST_VALUE",
  "CTE",
  "WITH",
  "EXISTS",
  "IN",
  "NOT IN",
  "LIKE",
  "BETWEEN",
  "AND",
  "OR",
  "String Functions",
  "Date Functions",
  "Aggregate Functions",
  "Window Functions",
  "Subqueries",
];

type TableSchema = {
  columns: Record<string, string>;
};

const generationModalStyles = `
  @keyframes spinRing { to { transform: rotate(360deg); } }
  @keyframes floatUp { 0% { opacity: 0; transform: translateY(16px); } 100% { opacity: 1; transform: translateY(0); } }
  @keyframes bgPan { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
  @keyframes shimmerBar { 0% { background-position: -400px 0; } 100% { background-position: 400px 0; } }
  @keyframes blinkCursor { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
  @keyframes pulseDot { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(1.5); } }
  @keyframes codeSlide { 0% { opacity: 0; transform: translateY(6px); } 100% { opacity: 1; transform: translateY(0); } }
`;

export default function QuestionCreatePage() {
  const router = useRouter();

  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [codeLines, setCodeLines] = useState<string[]>([]);
  const [genElapsed, setGenElapsed] = useState(0);
  const [genDots, setGenDots] = useState(".");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const genStartRef = useRef<number | null>(null);
  const genTickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const genCodeRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const genCodeIdxRef = useRef(0);

  const [loadingSeededSchema, setLoadingSeededSchema] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Question Type selector
  const [questionType, setQuestionType] = useState<QuestionType>("coding");

  // AI Generation fields
  const [aiTopic, setAiTopic] = useState("");
  const [aiConcepts, setAiConcepts] = useState("");
  const [aiDifficulty, setAiDifficulty] = useState("medium");

  const [title, setTitle] = useState("");
  // LeetCode-style 3-part description
  const [description, setDescription] = useState(
    "Describe the problem here. What needs to be solved? What is the task?",
  );
  const [examples, setExamples] = useState<
    Array<{ input: string; output: string; explanation: string }>
  >([{ input: "", output: "", explanation: "" }]);
  const [constraints, setConstraints] = useState<string[]>([""]);

  const [difficulty, setDifficulty] = useState("medium");
  const [languages, setLanguages] = useState<string[]>(["python"]);
  const [isPublished, setIsPublished] = useState(false);
  const [starterCode, setStarterCode] = useState<Record<string, string>>({
    python: DEFAULT_STARTER_CODE.python,
    javascript: DEFAULT_STARTER_CODE.javascript,
    cpp: DEFAULT_STARTER_CODE.cpp,
    java: DEFAULT_STARTER_CODE.java,
  });
  const [publicTestcases, setPublicTestcases] = useState<Testcase[]>([
    { input: "", expected_output: "" },
  ]);
  const [hiddenTestcases, setHiddenTestcases] = useState<Testcase[]>([
    { input: "", expected_output: "" },
  ]);

  // Secure Mode settings (blocks I/O code, wraps user function)
  const [secureMode, setSecureMode] = useState(false);
  const [functionName, setFunctionName] = useState("");
  const [returnType, setReturnType] = useState("int");
  const [parameters, setParameters] = useState<
    Array<{ name: string; type: string }>
  >([{ name: "", type: "int" }]);
  const [isAiGenerated, setIsAiGenerated] = useState(false);

  // SQL-specific state
  const [sqlCategory, setSqlCategory] = useState("select");
  const [schemas, setSchemas] = useState<Record<string, TableSchema>>({});
  const [sampleData, setSampleData] = useState<Record<string, any[][]>>({});
  const [starterQuery, setStarterQuery] = useState(
    "-- Write your SQL query here\n\nSELECT ",
  );
  const [referenceQuery, setReferenceQuery] = useState(""); // Correct SQL answer for evaluation
  // Optional manual expected result snapshot for SQL questions
  const [sqlExpectedOutput, setSqlExpectedOutput] = useState("");
  const [hints, setHints] = useState<string[]>([""]);
  const [orderSensitive, setOrderSensitive] = useState(false);

  const toggleLanguage = (lang: string) => {
    setLanguages((prev) =>
      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang],
    );
  };

  const updateTestcase = (
    idx: number,
    type: "public" | "hidden",
    field: keyof Testcase,
    value: string,
  ) => {
    if (type === "public") {
      setPublicTestcases((prev) => {
        const copy = [...prev];
        // Ensure input is always stored as string
        if (field === "input") {
          copy[idx] = { ...copy[idx], [field]: value };
        } else {
          copy[idx] = { ...copy[idx], [field]: value };
        }
        return copy;
      });
    } else {
      setHiddenTestcases((prev) => {
        const copy = [...prev];
        // Ensure input is always stored as string
        if (field === "input") {
          copy[idx] = { ...copy[idx], [field]: value };
        } else {
          copy[idx] = { ...copy[idx], [field]: value };
        }
        return copy;
      });
    }
  };

  const addTestcase = (type: "public" | "hidden") => {
    if (type === "public") {
      setPublicTestcases((prev) => [
        ...prev,
        { input: "", expected_output: "" },
      ]);
    } else {
      setHiddenTestcases((prev) => [
        ...prev,
        { input: "", expected_output: "" },
      ]);
    }
  };

  const removeTestcase = (type: "public" | "hidden", idx: number) => {
    if (type === "public") {
      setPublicTestcases((prev) =>
        prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev,
      );
    } else {
      setHiddenTestcases((prev) =>
        prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev,
      );
    }
  };

  // AI Generation handler - handles both Coding and SQL
  const handleGenerateWithAI = async () => {
    if (!aiTopic.trim() && !aiConcepts.trim()) {
      setError("Please provide a topic or concepts for AI generation");
      return;
    }

    // For coding questions, ensure at least one language is selected
    if (questionType === "coding" && languages.length === 0) {
      setError(
        "Please select at least one language for starter code generation",
      );
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      // Different endpoint based on question type
      const endpoint =
        questionType === "sql"
          ? "/admin/generate-sql-question"
          : "/admin/generate-question";

      const response = await dsaApi.post(endpoint, {
        difficulty: aiDifficulty,
        topic: aiTopic || undefined,
        concepts: aiConcepts || undefined,
        // Only pass languages for coding questions (not SQL)
        ...(questionType === "coding" && languages.length > 0
          ? { languages }
          : {}),
      });

      const data = response.data;

      // Common fields
      setTitle(data.title || "");
      setDescription(data.description || "");
      setDifficulty(data.difficulty || "medium");

      if (questionType === "sql") {
        // SQL-specific fields
        setSqlCategory(data.sql_category || "select");
        setSchemas(data.schemas || {});
        setSampleData(data.sample_data || {});
        setConstraints(data.constraints?.length > 0 ? data.constraints : [""]);
        setStarterQuery(
          data.starter_query || "-- Write your SQL query here\n\nSELECT ",
        );
        setHints(data.hints?.length > 0 ? data.hints : [""]);
        setOrderSensitive(data.evaluation?.order_sensitive || false);
        // Set reference query if generated
        setReferenceQuery(data.reference_query || "");
        // Set expected output if generated (from reference query execution)
        // sql_expected_output is stored as JSON string, format it nicely for display
        if (data.sql_expected_output) {
          try {
            // Parse and pretty-print JSON for readability
            const parsed = JSON.parse(data.sql_expected_output);
            // Format as nicely indented JSON
            setSqlExpectedOutput(JSON.stringify(parsed, null, 2));
          } catch (e) {
            // Not JSON, use as-is
            setSqlExpectedOutput(data.sql_expected_output);
          }
        }
      } else {
        // Coding-specific fields
        // Preserve user's selected languages (don't override from response)
        // The backend generates starter code for the languages we sent in the request
        // If no languages were selected, use the response languages as fallback
        if (
          languages.length === 0 &&
          data.languages &&
          data.languages.length > 0
        ) {
          setLanguages(data.languages);
        }

        // Set examples (LeetCode style)
        if (data.examples && data.examples.length > 0) {
          setExamples(
            data.examples.map((ex: any) => ({
              input: ex.input || "",
              output: ex.output || "",
              explanation: ex.explanation || "",
            })),
          );
        }

        // Set constraints (LeetCode style)
        if (data.constraints && data.constraints.length > 0) {
          setConstraints(data.constraints);
        }

        // Set starter code only for selected languages
        if (data.starter_code) {
          const newStarterCode: Record<string, string> = {};
          // Only include starter code for languages that were selected and generated
          languages.forEach((lang) => {
            newStarterCode[lang] =
              data.starter_code[lang] || DEFAULT_STARTER_CODE[lang] || "";
          });
          setStarterCode(newStarterCode);
        } else {
          // Fallback: use default starter code for selected languages only
          const newStarterCode: Record<string, string> = {};
          languages.forEach((lang) => {
            newStarterCode[lang] = DEFAULT_STARTER_CODE[lang] || "";
          });
          setStarterCode(newStarterCode);
        }

        // Set function signature if provided
        if (data.function_signature) {
          setFunctionName(data.function_signature.name || "");
          setReturnType(data.function_signature.return_type || "int");
          if (
            data.function_signature.parameters &&
            data.function_signature.parameters.length > 0
          ) {
            setParameters(data.function_signature.parameters);
          }
          setSecureMode(true);
        }

        // Set public testcases - ensure input is always a string
        if (data.public_testcases && data.public_testcases.length > 0) {
          setPublicTestcases(
            data.public_testcases.map((tc: any) => {
              // Always convert input to string for state storage
              const inputStr =
                typeof tc.input === "string"
                  ? tc.input
                  : formatTestcaseInput(tc.input);
              return {
                input: inputStr,
                expected_output: tc.expected_output ?? undefined,
              };
            }),
          );
        }

        // Set hidden testcases - ensure input is always a string
        if (data.hidden_testcases && data.hidden_testcases.length > 0) {
          setHiddenTestcases(
            data.hidden_testcases.map((tc: any) => {
              // Always convert input to string for state storage
              const inputStr =
                typeof tc.input === "string"
                  ? tc.input
                  : formatTestcaseInput(tc.input);
              return {
                input: inputStr,
                expected_output: tc.expected_output ?? undefined,
              };
            }),
          );
        }
      }

      // Mark as AI-generated
      setIsAiGenerated(true);
      setSuccessMessage(
        `${questionType === "sql" ? "SQL" : "Coding"} question generated! Review and edit the details below.`,
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
      setTimeout(() => setSuccessMessage(null), 6000);
    } catch (err: any) {
      console.error("AI generation error:", err);
      console.error("Error response:", err.response?.data);
      console.error("Error status:", err.response?.status);

      let errorMessage = "Failed to generate question with AI.";

      // Try to extract detailed error message from response
      if (err.response?.data) {
        // Check for detail field (FastAPI standard)
        if (err.response.data.detail) {
          errorMessage = err.response.data.detail;
        }
        // Check for message field
        else if (err.response.data.message) {
          errorMessage = err.response.data.message;
        }
        // Check for error field
        else if (err.response.data.error) {
          errorMessage = err.response.data.error;
        }
      }
      // Network errors
      else if (
        err.code === "ERR_NETWORK" ||
        err.message?.includes("Network Error")
      ) {
        errorMessage =
          "Network error. Make sure the backend server is running.";
      }
      // Other errors
      else if (err.message) {
        errorMessage = `${errorMessage} ${err.message}`;
      }

      setError(errorMessage);
    } finally {
      setGenerating(false);
    }
  };

  // Fetch preloaded/default database schema from SQL execution engine
  const handleLoadSeededSchema = async () => {
    setLoadingSeededSchema(true);
    setError(null);

    try {
      // Use the admin endpoint to fetch the default/preloaded database schema
      // This endpoint calls the SQL engine with empty body to get the default seed
      // Note: dsaApi already has baseURL set to /api/v1/dsa, so we only need the path
      console.log(
        "[Load Seeded Schema] Fetching default/preloaded database schema from admin endpoint...",
      );

      const response = await dsaApi.get("/admin/seeded-schema");
      const data = response.data?.data || response.data;

      console.log("[Load Seeded Schema] Received schema data:", data);

      if (data.schemas && Object.keys(data.schemas).length > 0) {
        // Set schemas
        setSchemas(data.schemas);

        // Set sample data (convert from list-of-lists format if needed)
        const normalizedSampleData: Record<string, any[][]> = {};
        for (const [tableName, rows] of Object.entries(
          data.sample_data || {},
        )) {
          // Ensure rows are in list-of-lists format
          if (Array.isArray(rows)) {
            normalizedSampleData[tableName] = rows.map((row) =>
              Array.isArray(row) ? row : Object.values(row),
            );
          } else {
            normalizedSampleData[tableName] = [];
          }
        }
        setSampleData(normalizedSampleData);

        alert(
          ` Successfully loaded ${Object.keys(data.schemas).length} table(s) from preloaded database!`,
        );
      } else {
        alert(" No tables found in preloaded database");
      }
    } catch (err: any) {
      console.error("Error loading seeded schema:", err);
      let errorMessage = "Failed to load preloaded database schema.";
      if (err.response?.data?.detail) {
        errorMessage = err.response.data.detail;
      } else if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.message) {
        errorMessage = `${errorMessage} Error: ${err.message}`;
      } else if (err.code === "ERR_NETWORK") {
        errorMessage = `Network error. Make sure the SQL execution engine is running and the backend is accessible.`;
      }
      setError(errorMessage);
      alert(`❌ ${errorMessage}`);
    } finally {
      setLoadingSeededSchema(false);
    }
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    // Validation based on question type
    if (questionType === "coding") {
      if (languages.length === 0) {
        setError("Select at least one language");
        return;
      }

      // Validate secure mode settings
      if (secureMode) {
        if (!functionName.trim()) {
          setError("Function name is required when secure mode is enabled");
          return;
        }
        const validParams = parameters.filter((p) => p.name.trim());
        if (validParams.length === 0) {
          setError(
            "At least one parameter is required when secure mode is enabled",
          );
          return;
        }
      }
    } else {
      // SQL validation - schemas are optional for manual creation
      // They can be added via AI generation or later via edit
    }

    setSaving(true);
    setError(null);

    try {
      let payload: any;

      if (questionType === "sql") {
        // SQL question payload
        payload = {
          title,
          description,
          difficulty,
          question_type: "SQL",
          sql_category: sqlCategory,
          schemas,
          sample_data: sampleData,
          constraints: constraints.filter((c) => c.trim()),
          starter_query: starterQuery,
          reference_query: referenceQuery.trim() || null, // Correct SQL for evaluation
          // Optional manual expected result snapshot (admin-entered)
          sql_expected_output: sqlExpectedOutput.trim() || null,
          hints: hints.filter((h) => h.trim()),
          evaluation: {
            engine: "postgres",
            comparison: "result_set",
            order_sensitive: orderSensitive,
          },
          is_published: isPublished,
          // Empty coding fields for SQL
          languages: [],
          starter_code: {},
          public_testcases: [],
          hidden_testcases: [],
        };
      } else {
        // Coding question payload
        let functionSignature = null;
        if (secureMode && functionName.trim()) {
          functionSignature = {
            name: functionName.trim(),
            parameters: parameters
              .filter((p) => p.name.trim())
              .map((p) => ({ name: p.name.trim(), type: p.type })),
            return_type: returnType,
          };
        }

        payload = {
          title,
          description,
          examples: examples
            .filter((ex) => ex.input.trim() || ex.output.trim())
            .map((ex) => ({
              input: ex.input,
              output: ex.output,
              explanation: ex.explanation || null,
            })),
          constraints: constraints.filter((c) => c.trim()),
          difficulty,
          languages,
          starter_code: starterCode,
          public_testcases: (() => {
            // Filter out empty testcases - only store testcases with actual data
            const nonEmptyTestcases = publicTestcases.filter((tc) => {
              const hasInput = isTestcaseInputNonEmpty(tc.input);
              const hasExpectedOutput =
                tc.expected_output &&
                typeof tc.expected_output === "string" &&
                tc.expected_output.trim();
              return hasInput || hasExpectedOutput;
            });

            // Always include expected_output when present (for both AI-generated and manual questions)
            return nonEmptyTestcases.map((tc) => {
              // Ensure input is always a string, default to empty string if missing
              const inputStr = tc.input
                ? typeof tc.input === "string"
                  ? tc.input
                  : formatTestcaseInput(tc.input)
                : "";
              return {
                input: parseTestcaseInput(inputStr),
                // Parse expected_output so objects/arrays/numbers are stored correctly
                expected_output: parseTestcaseExpectedOutput(
                  tc.expected_output || "",
                ),
                is_hidden: false,
              };
            });
          })(),
          hidden_testcases: (() => {
            // Filter out empty testcases - only store testcases with actual data
            const nonEmptyTestcases = hiddenTestcases.filter((tc) => {
              const hasInput = isTestcaseInputNonEmpty(tc.input);
              const hasExpectedOutput =
                tc.expected_output &&
                typeof tc.expected_output === "string" &&
                tc.expected_output.trim();
              return hasInput || hasExpectedOutput;
            });

            // Always include expected_output when present (for both AI-generated and manual questions)
            return nonEmptyTestcases.map((tc) => {
              // Ensure input is always a string, default to empty string if missing
              const inputStr = tc.input
                ? typeof tc.input === "string"
                  ? tc.input
                  : formatTestcaseInput(tc.input)
                : "";
              return {
                input: parseTestcaseInput(inputStr),
                // Parse expected_output so objects/arrays/numbers are stored correctly
                expected_output: parseTestcaseExpectedOutput(
                  tc.expected_output || "",
                ),
                is_hidden: true,
              };
            });
          })(),
          function_signature: functionSignature,
          secure_mode: secureMode,
          is_published: isPublished,
        };
      }

      await dsaApi.post("/questions", payload);
      const typeLabel = questionType === "sql" ? "SQL" : "Coding";
      alert(`${typeLabel} Question created successfully!`);
      router.push("/dsa/questions");
    } catch (err: any) {
      console.error("Error creating question:", err);
      console.error("Error response:", err.response?.data);
      console.error("Error status:", err.response?.status);

      let errorMessage = "Failed to create question";
      if (err.response?.data?.detail) {
        errorMessage = err.response.data.detail;
      } else if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.message) {
        errorMessage = `Error: ${err.message}`;
      }

      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const CODING_STAGES = [
    {
      id: "narrative",
      icon: <Wand2 size={18} />,
      title: "Crafting the Scenario",
      subtitle: "Inventing a unique real-world narrative…",
      color: "#7C3AED",
      duration: 6000,
    },
    {
      id: "algorithm",
      icon: <Cpu size={18} />,
      title: "Selecting the Algorithm",
      subtitle: "Matching difficulty with the right data structure…",
      color: "#0891B2",
      duration: 5000,
    },
    {
      id: "testcases",
      icon: <FlaskConical size={18} />,
      title: "Generating Test Cases",
      subtitle: "Computing ground-truth inputs & outputs…",
      color: "#00684A",
      duration: 8000,
    },
    {
      id: "verify",
      icon: <ShieldCheck size={18} />,
      title: "Verifying Correctness",
      subtitle: "Executing reference solution in sandbox…",
      color: "#D97706",
      duration: 6000,
    },
    {
      id: "code",
      icon: <Code2 size={18} />,
      title: "Writing Starter Code",
      subtitle: "Generating boilerplate for selected languages…",
      color: "#DC2626",
      duration: 5000,
    },
  ];

  const SQL_STAGES = [
    {
      id: "schema",
      icon: <LayoutGrid size={18} />,
      title: "Designing Table Schema",
      subtitle: "Creating realistic database structures…",
      color: "#7C3AED",
      duration: 6000,
    },
    {
      id: "data",
      icon: <Database size={18} />,
      title: "Seeding Sample Data",
      subtitle: "Populating tables with meaningful rows…",
      color: "#0891B2",
      duration: 5000,
    },
    {
      id: "query",
      icon: <Search size={18} />,
      title: "Writing Reference Query",
      subtitle: "Crafting the correct SQL answer…",
      color: "#00684A",
      duration: 8000,
    },
    {
      id: "validate",
      icon: <BadgeCheck size={18} />,
      title: "Validating Query Output",
      subtitle: "Running query against seeded data…",
      color: "#D97706",
      duration: 5000,
    },
  ];

  const fn = functionName || "solution";
  const param1 = parameters[0]?.name || "input";
  const param2 = parameters[1]?.name || "target";
  const GEN_CODE_SNIPPETS = [
    `# Topic: ${aiTopic || "DSA"} — ${aiDifficulty.toUpperCase()}`,
    `# Concepts: ${aiConcepts || "general algorithm"}`,
    ``,
    `# Executing testcase 1…`,
    `# ✓ output verified`,
    `# Executing testcase 2…`,
    `# ✓ output verified`,
    `# Executing testcase 3…`,
    `# ✓ output verified`,
  ];

  const genStages = questionType === "sql" ? SQL_STAGES : CODING_STAGES;
  const totalGenDuration = genStages.reduce((a, s) => a + s.duration, 0);

  const genActiveIdx = (() => {
    let cum = 0;
    for (let i = 0; i < genStages.length; i++) {
      cum += genStages[i].duration;
      if (genElapsed * 1000 < cum) return i;
    }
    return genStages.length - 1;
  })();

  const genCompletedSet = (() => {
    const done = new Set<number>();
    let cum = 0;
    for (let i = 0; i < genStages.length; i++) {
      cum += genStages[i].duration;
      if (genElapsed * 1000 >= cum) done.add(i);
    }
    return done;
  })();

  const genProgress = Math.min(
    100,
    ((genElapsed * 1000) / totalGenDuration) * 100,
  );
  const genActiveStage = genStages[genActiveIdx];
  const showCodeStream = ["testcases", "verify", "validate", "query"].includes(
    genActiveStage?.id,
  );

  useEffect(() => {
    if (generating) {
      genStartRef.current = Date.now();
      setGenElapsed(0);
      setCodeLines([]);
      genCodeIdxRef.current = 0;

      genTickRef.current = setInterval(() => {
        setGenElapsed(Math.floor((Date.now() - genStartRef.current!) / 1000));
      }, 200);

      genCodeRef.current = setInterval(() => {
        const line =
          GEN_CODE_SNIPPETS[genCodeIdxRef.current % GEN_CODE_SNIPPETS.length];
        genCodeIdxRef.current++;
        setCodeLines((prev) => [...prev.slice(-7), line]);
      }, 260);

      const dotsInterval = setInterval(() => {
        setGenDots((d) => (d.length >= 3 ? "." : d + "."));
      }, 500);

      return () => {
        clearInterval(genTickRef.current!);
        clearInterval(genCodeRef.current!);
        clearInterval(dotsInterval);
      };
    } else {
      setGenElapsed(0);
      setCodeLines([]);
    }
  }, [generating]);

  return (
    <div
      style={{
        backgroundColor: "#FAFCFB",
        minHeight: "100vh",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <div
        style={{ maxWidth: "1200px", margin: "0 auto", padding: "3rem 1.5rem" }}
      >
        {/* ── Refactored AI Generation Modal (Strict Single-Color & Size Constrained) ── */}
        <style>{generationModalStyles}</style>
        {generating && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 9999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(17, 24, 39, 0.7)",
              backdropFilter: "blur(4px)",
              animation: "floatUp 0.3s ease",
              padding: "1rem", // Prevents touching screen edges on mobile
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: "600px", // Fixed maximum width
                maxHeight: "90vh", // Prevents it from growing taller than the screen
                display: "flex",
                flexDirection: "column",
                background: "#ffffff",
                borderRadius: "1.5rem",
                border: "1px solid #E5E7EB",
                overflow: "hidden", // Keeps the top bar rounded
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
                animation: "floatUp 0.4s ease",
              }}
            >
              {/* Solid Emerald top bar */}
              <div
                style={{
                  height: "6px",
                  backgroundColor: "#00684A",
                  flexShrink: 0,
                }}
              />

              {/* Scrollable interior so long generations don't break the layout */}
              <div style={{ padding: "2rem", overflowY: "auto", flex: 1 }}>
                {/* Header row */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "1.25rem",
                    marginBottom: "1.5rem",
                  }}
                >
                  {/* Spinning ring + icon (Strict Emerald) */}
                  <div
                    style={{
                      position: "relative",
                      width: 54,
                      height: 54,
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        borderRadius: "50%",
                        border: "3px solid #00684A",
                        borderTopColor: "transparent",
                        animation: "spinRing 1s linear infinite",
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        inset: 6,
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: "#F0F9F4", // Light emerald tint
                        color: "#00684A",
                      }}
                    >
                      {genActiveStage?.icon}
                    </div>
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: "1.125rem",
                        fontWeight: 700,
                        color: "#111827",
                        letterSpacing: "-0.01em",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {genActiveStage?.title}
                      <span style={{ color: "#00684A", marginLeft: "0.1rem" }}>
                        {genDots}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: "0.8rem",
                        color: "#6B7280",
                        marginTop: "0.25rem",
                        fontWeight: 500,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {genActiveStage?.subtitle}
                      {aiConcepts && (
                        <span
                          style={{
                            color: "#4B5563",
                            marginLeft: "0.4rem",
                            fontWeight: 600,
                          }}
                        >
                          · {aiConcepts}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Elapsed timer */}
                  <div
                    style={{
                      fontFamily: "monospace",
                      fontSize: "0.8rem",
                      fontWeight: 700,
                      color: "#00684A",
                      background: "#F0F9F4",
                      border: "1px solid #A8E8BC",
                      padding: "0.4rem 0.75rem",
                      borderRadius: "9999px",
                      flexShrink: 0,
                    }}
                  >
                    {genElapsed}s
                  </div>
                </div>

                {/* Progress bar */}
                <div
                  style={{
                    height: 6,
                    backgroundColor: "#F3F4F6",
                    borderRadius: 9999,
                    marginBottom: "1.75rem",
                    overflow: "hidden",
                    boxShadow: "inset 0 1px 2px rgba(0,0,0,0.05)",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${genProgress}%`,
                      borderRadius: 9999,
                      backgroundColor: "#00684A",
                      transition: "width 0.5s ease",
                    }}
                  />
                </div>

                {/* Stage pills (Strict Single Color Logic) */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                    marginBottom: "1.5rem",
                  }}
                >
                  {genStages.map((stage, i) => {
                    const isDone = genCompletedSet.has(i);
                    const isActive = i === genActiveIdx;
                    const isWaiting = !isDone && !isActive;

                    return (
                      <div
                        key={stage.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.75rem",
                          padding: "0.625rem 1rem",
                          borderRadius: "0.75rem",
                          border: `1px solid ${isActive ? "#00684A" : isDone ? "#E5E7EB" : "#E5E7EB"}`,
                          backgroundColor: isActive ? "#F0F9F4" : "#ffffff",
                          opacity: isWaiting ? 0.6 : 1,
                          transition: "all 0.4s ease",
                        }}
                      >
                        <span
                          style={{
                            color: isDone
                              ? "#00684A"
                              : isActive
                                ? "#00684A"
                                : "#9CA3AF",
                            display: "flex",
                            alignItems: "center",
                          }}
                        >
                          {isDone ? <CheckCircle2 size={18} /> : stage.icon}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: "0.85rem",
                              fontWeight: isActive || isDone ? 600 : 500,
                              color: isActive
                                ? "#00684A"
                                : isDone
                                  ? "#111827"
                                  : "#6B7280",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {stage.title}
                          </div>
                          {isActive && (
                            <div
                              style={{
                                fontSize: "0.75rem",
                                color: "#6B7280",
                                marginTop: "0.1rem",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {stage.subtitle}
                            </div>
                          )}
                        </div>
                        {isActive && (
                          <div
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              backgroundColor: "#00684A",
                              animation: "pulseDot 1s ease-in-out infinite",
                              flexShrink: 0,
                            }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Code stream terminal (Light theme, word-break to prevent widening) */}
                {showCodeStream && (
                  <div
                    style={{
                      fontFamily: "monospace",
                      fontSize: "0.75rem",
                      lineHeight: 1.6,
                      color: "#374151",
                      background: "#F9FAFB",
                      borderRadius: "0.75rem",
                      padding: "1rem 1.25rem",
                      maxHeight: "200px", // Constrain height
                      overflowY: "auto",
                      overflowX: "hidden", // Prevent horizontal scrolling
                      border: "1px solid #E5E7EB",
                      position: "relative",
                      boxShadow: "inset 0 2px 4px rgba(0,0,0,0.02)",
                    }}
                  >
                    <div
                      style={{
                        color: "#9CA3AF",
                        marginBottom: "0.5rem",
                        fontSize: "0.65rem",
                        fontWeight: 700,
                        letterSpacing: "0.1em",
                      }}
                    >
                      ● SANDBOX EXECUTION
                    </div>
                    <div
                      style={{ wordBreak: "break-all", whiteSpace: "pre-wrap" }}
                    >
                      {codeLines.map((line, i) => (
                        <span
                          key={i}
                          style={{
                            opacity: i === codeLines.length - 1 ? 1 : 0.6,
                            animation:
                              i === codeLines.length - 1
                                ? "codeSlide 0.2s ease"
                                : undefined,
                          }}
                        >
                          {line || "\n"}
                        </span>
                      ))}
                      <span
                        style={{
                          display: "inline-block",
                          width: 8,
                          height: 14,
                          backgroundColor: "#00684A",
                          verticalAlign: "text-bottom",
                          marginLeft: 4,
                          animation: "blinkCursor 1s step-end infinite",
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Footer */}
                <div
                  style={{
                    marginTop: "1.5rem",
                    textAlign: "center",
                    fontSize: "0.75rem",
                    fontWeight: 500,
                    color: "#6B7280",
                    letterSpacing: "0.025em",
                  }}
                >
                  <span style={{ color: "#00684A" }}>✦</span> Crafting a unique{" "}
                  {aiDifficulty} {aiTopic ? `"${aiTopic}"` : "DSA"} problem
                  <span style={{ color: "#00684A" }}>✦</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Back Button --*/}
        <div style={{ marginBottom: "2rem" }}>
          <button
            type="button"
            onClick={() => router.back()}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.5rem 0",
              fontSize: "0.875rem",
              color: "#6B7280",
              backgroundColor: "transparent",
              border: "none",
              fontWeight: 600,
              cursor: "pointer",
              transition: "color 0.2s ease",
            }}
            onMouseOver={(e) => (e.currentTarget.style.color = "#00684A")}
            onMouseOut={(e) => (e.currentTarget.style.color = "#6B7280")}
          >
            <ArrowLeft size={16} strokeWidth={2.5} /> Back
          </button>
        </div>

        {/* Header */}
        <div style={{ marginBottom: "2.5rem" }}>
          <h1
            style={{
              margin: "0 0 0.5rem 0",
              color: "#111827",
              fontSize: "2.25rem",
              fontWeight: 800,
              letterSpacing: "-0.025em",
            }}
          >
            Create DSA Question
          </h1>
          <p style={{ color: "#6B7280", fontSize: "1rem", margin: 0 }}>
            Author a new {questionType === "sql" ? "SQL" : "Coding"} problem
            manually or generate one instantly using AI.
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div
            style={{
              backgroundColor: "#FEF2F2",
              border: "1px solid #EF4444",
              color: "#991B1B",
              padding: "1rem 1.25rem",
              borderRadius: "0.75rem",
              marginBottom: "2rem",
              fontSize: "0.9375rem",
              fontWeight: 500,
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
            }}
          >
            <AlertCircle size={20} />
            {error}
          </div>
        )}

        {successMessage && (
  <div
    style={{
      backgroundColor: "#F0FDF4",
      border: "1px solid #86EFAC",
      color: "#166534",
      padding: "1rem 1.25rem",
      borderRadius: "0.75rem",
      marginBottom: "2rem",
      fontSize: "0.9375rem",
      fontWeight: 500,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "0.75rem",
      animation: "floatUp 0.3s ease",
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
      <CheckCircle2 size={20} color="#16A34A" />
      {successMessage}
    </div>
    <button
      type="button"
      onClick={() => setSuccessMessage(null)}
      style={{
        background: "transparent",
        border: "none",
        cursor: "pointer",
        color: "#16A34A",
        padding: 0,
        display: "flex",
        alignItems: "center",
      }}
    >
      <X size={16} />
    </button>
  </div>
)}

        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          {/* Question Type Selector */}
          <div
            style={{
              backgroundColor: "#ffffff",
              padding: "2rem",
              borderRadius: "1rem",
              border: "1px solid #E5E7EB",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                marginBottom: "1.5rem",
                paddingBottom: "1rem",
                borderBottom: "1px solid #F3F4F6",
              }}
            >
              <Settings size={20} color="#00684A" />
              <h2
                style={{
                  margin: 0,
                  fontSize: "1.25rem",
                  fontWeight: 700,
                  color: "#111827",
                }}
              >
                Question Type
              </h2>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "1.5rem",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setQuestionType("coding");
                  setIsAiGenerated(false);
                  setTitle("");
                  setDescription("");
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "1rem",
                  padding: "1.5rem",
                  borderRadius: "0.75rem",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  textAlign: "left",
                  backgroundColor:
                    questionType === "coding" ? "#F0F9F4" : "#ffffff",
                  border:
                    questionType === "coding"
                      ? "2px solid #00684A"
                      : "1px solid #D1D5DB",
                  boxShadow:
                    questionType === "coding"
                      ? "0 4px 12px rgba(0, 104, 74, 0.1)"
                      : "none",
                }}
              >
                <div
                  style={{
                    padding: "0.75rem",
                    backgroundColor:
                      questionType === "coding" ? "#E1F2E9" : "#F3F4F6",
                    borderRadius: "0.5rem",
                    color: questionType === "coding" ? "#00684A" : "#6B7280",
                  }}
                >
                  <Code size={24} />
                </div>
                <div>
                  <h3
                    style={{
                      margin: "0 0 0.25rem 0",
                      fontSize: "1.125rem",
                      fontWeight: 700,
                      color: questionType === "coding" ? "#00684A" : "#374151",
                    }}
                  >
                    Coding Question
                  </h3>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "0.875rem",
                      color: "#6B7280",
                    }}
                  >
                    Algorithms, Data Structures (Python, Java, C++, etc.)
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setQuestionType("sql");
                  setIsAiGenerated(false);
                  setTitle("");
                  setDescription("");
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "1rem",
                  padding: "1.5rem",
                  borderRadius: "0.75rem",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  textAlign: "left",
                  backgroundColor:
                    questionType === "sql" ? "#F0F9F4" : "#ffffff",
                  border:
                    questionType === "sql"
                      ? "2px solid #00684A"
                      : "1px solid #D1D5DB",
                  boxShadow:
                    questionType === "sql"
                      ? "0 4px 12px rgba(0, 104, 74, 0.1)"
                      : "none",
                }}
              >
                <div
                  style={{
                    padding: "0.75rem",
                    backgroundColor:
                      questionType === "sql" ? "#E1F2E9" : "#F3F4F6",
                    borderRadius: "0.5rem",
                    color: questionType === "sql" ? "#00684A" : "#6B7280",
                  }}
                >
                  <Database size={24} />
                </div>
                <div>
                  <h3
                    style={{
                      margin: "0 0 0.25rem 0",
                      fontSize: "1.125rem",
                      fontWeight: 700,
                      color: questionType === "sql" ? "#00684A" : "#374151",
                    }}
                  >
                    SQL Question
                  </h3>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "0.875rem",
                      color: "#6B7280",
                    }}
                  >
                    Database queries, JOINs, Aggregations, Window Functions
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* AI Question Generator Card */}
          <div
            style={{
              backgroundColor: "#F0F9F4",
              padding: "2rem",
              borderRadius: "1rem",
              border: "1px solid #A8E8BC",
              boxShadow: "0 4px 12px rgba(0, 104, 74, 0.05)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                marginBottom: "1rem",
              }}
            >
              <Sparkles size={20} color="#00684A" />
              <h2
                style={{
                  margin: 0,
                  fontSize: "1.25rem",
                  fontWeight: 700,
                  color: "#00684A",
                }}
              >
                Generate {questionType === "sql" ? "SQL" : "Coding"} Question
                with AI
              </h2>
            </div>

            <p
              style={{
                fontSize: "0.95rem",
                color: "#2D7A52",
                margin: "0 0 1.5rem 0",
              }}
            >
              {questionType === "sql"
                ? "Describe the SQL topic and concepts, and AI will generate table schemas, sample data, and the problem description."
                : "Describe the topic and concepts, and AI will generate a complete question with description, starter code, and test cases."}
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: "1.5rem",
                marginBottom: "1.5rem",
              }}
            >
              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "0.5rem",
                    fontWeight: 600,
                    color: "#1E5A3B",
                    fontSize: "0.875rem",
                  }}
                >
                  Topic
                </label>
                <input
                  type="text"
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                  placeholder={
                    questionType === "sql"
                      ? "e.g., Joins, Aggregation"
                      : "e.g., Arrays, Trees, Graphs"
                  }
                  disabled={generating}
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: "1px solid #A8E8BC",
                    borderRadius: "0.5rem",
                    outline: "none",
                    boxSizing: "border-box",
                    backgroundColor: "#ffffff",
                  }}
                />
                {questionType === "sql" && (
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "0.5rem",
                      marginTop: "0.5rem",
                    }}
                  >
                    {SQL_TOPICS.slice(0, 4).map((topic) => (
                      <button
                        key={topic}
                        type="button"
                        onClick={() => setAiTopic(topic)}
                        disabled={generating}
                        style={{
                          fontSize: "0.75rem",
                          padding: "0.25rem 0.5rem",
                          backgroundColor: "#E1F2E9",
                          color: "#00684A",
                          border: "1px solid #A8E8BC",
                          borderRadius: "0.25rem",
                          cursor: "pointer",
                        }}
                      >
                        {topic}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "0.5rem",
                    fontWeight: 600,
                    color: "#1E5A3B",
                    fontSize: "0.875rem",
                  }}
                >
                  Concepts
                </label>
                <input
                  type="text"
                  value={aiConcepts}
                  onChange={(e) => setAiConcepts(e.target.value)}
                  placeholder={
                    questionType === "sql"
                      ? "e.g., LEFT JOIN, GROUP BY"
                      : "e.g., Two pointers, BFS"
                  }
                  disabled={generating}
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: "1px solid #A8E8BC",
                    borderRadius: "0.5rem",
                    outline: "none",
                    boxSizing: "border-box",
                    backgroundColor: "#ffffff",
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "0.5rem",
                    fontWeight: 600,
                    color: "#1E5A3B",
                    fontSize: "0.875rem",
                  }}
                >
                  Difficulty
                </label>
                <select
                  value={aiDifficulty}
                  onChange={(e) => setAiDifficulty(e.target.value)}
                  disabled={generating}
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: "1px solid #A8E8BC",
                    borderRadius: "0.5rem",
                    outline: "none",
                    boxSizing: "border-box",
                    backgroundColor: "#ffffff",
                  }}
                >
                  {questionType === "sql" ? (
                    <>
                      <option value="easy">Easy - Basic SELECT, WHERE</option>
                      <option value="medium">Medium - JOINs, GROUP BY</option>
                      <option value="hard">
                        Hard - Window Functions, CTEs
                      </option>
                    </>
                  ) : (
                    <>
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </>
                  )}
                </select>
              </div>
            </div>

            {/* Language Selection - Coding Only */}
            {questionType === "coding" && (
              <div style={{ marginBottom: "1.5rem" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "0.25rem",
                    fontWeight: 600,
                    color: "#1E5A3B",
                    fontSize: "0.875rem",
                  }}
                >
                  Select Languages for Starter Code{" "}
                  <span style={{ color: "#DC2626" }}>*</span>
                </label>
                <p
                  style={{
                    fontSize: "0.8rem",
                    color: "#2D7A52",
                    marginBottom: "0.75rem",
                  }}
                >
                  AI will generate starter code only for the selected languages.
                </p>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "1rem",
                    padding: "1rem",
                    backgroundColor: "#ffffff",
                    border: "1px solid #A8E8BC",
                    borderRadius: "0.5rem",
                  }}
                >
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <label
                      key={lang}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        fontSize: "0.875rem",
                        cursor: "pointer",
                        color: "#374151",
                        fontWeight: 500,
                        textTransform: "capitalize",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={languages.includes(lang)}
                        onChange={() => toggleLanguage(lang)}
                        disabled={generating}
                        style={{
                          accentColor: "#00684A",
                          width: "16px",
                          height: "16px",
                          cursor: "pointer",
                        }}
                      />
                      {lang}
                    </label>
                  ))}
                </div>
                {languages.length === 0 && (
                  <p
                    style={{
                      fontSize: "0.8rem",
                      color: "#DC2626",
                      marginTop: "0.5rem",
                    }}
                  >
                    Please select at least one language.
                  </p>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={handleGenerateWithAI}
              disabled={generating}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.75rem 1.5rem",
                backgroundColor: "#00684A",
                color: "#ffffff",
                border: "none",
                borderRadius: "0.5rem",
                fontWeight: 600,
                fontSize: "0.95rem",
                cursor: generating ? "not-allowed" : "pointer",
                opacity: generating ? 0.7 : 1,
                transition: "all 0.2s ease",
                boxShadow: "0 4px 6px -1px rgba(0, 104, 74, 0.2)",
              }}
              onMouseEnter={(e) => {
                if (!generating)
                  e.currentTarget.style.backgroundColor = "#084A2A";
              }}
              onMouseLeave={(e) => {
                if (!generating)
                  e.currentTarget.style.backgroundColor = "#00684A";
              }}
            >
              {generating ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Sparkles size={18} />
              )}
              {generating
                ? `Generating ${questionType === "sql" ? "SQL" : "Coding"} Question...`
                : `Generate ${questionType === "sql" ? "SQL" : "Coding"} Question`}
            </button>
          </div>

          {/* Divider */}
          <div
            style={{ display: "flex", alignItems: "center", margin: "1rem 0" }}
          >
            <div
              style={{ flex: 1, height: "1px", backgroundColor: "#E5E7EB" }}
            ></div>
            <span
              style={{
                padding: "0 1rem",
                color: "#9CA3AF",
                fontSize: "0.75rem",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              {isAiGenerated ? "Review and Edit Details" : "Or Create Manually"}
            </span>
            <div
              style={{ flex: 1, height: "1px", backgroundColor: "#E5E7EB" }}
            ></div>
          </div>

          {/* Basic Details */}
          <div
            style={{
              backgroundColor: "#ffffff",
              padding: "2rem",
              borderRadius: "1rem",
              border: "1px solid #E5E7EB",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                marginBottom: "1.5rem",
                paddingBottom: "1rem",
                borderBottom: "1px solid #F3F4F6",
              }}
            >
              <AlignLeft size={20} color="#00684A" />
              <h2
                style={{
                  margin: 0,
                  fontSize: "1.25rem",
                  fontWeight: 700,
                  color: "#111827",
                }}
              >
                Basic Details
              </h2>
            </div>

            <div style={{ marginBottom: "1.5rem" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "0.5rem",
                  fontWeight: 600,
                  color: "#374151",
                  fontSize: "0.875rem",
                }}
              >
                Title <span style={{ color: "#DC2626" }}>*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  questionType === "sql"
                    ? "e.g., Employee Salary Analysis"
                    : "e.g., Two Sum"
                }
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid #D1D5DB",
                  borderRadius: "0.5rem",
                  outline: "none",
                  boxSizing: "border-box",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#00684A")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#D1D5DB")}
              />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "1.5rem",
                marginBottom: "1.5rem",
              }}
            >
              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "0.5rem",
                    fontWeight: 600,
                    color: "#374151",
                    fontSize: "0.875rem",
                  }}
                >
                  Difficulty
                </label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: "1px solid #D1D5DB",
                    borderRadius: "0.5rem",
                    outline: "none",
                    boxSizing: "border-box",
                    backgroundColor: "#ffffff",
                  }}
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>

              {questionType === "sql" && (
                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "0.5rem",
                      fontWeight: 600,
                      color: "#374151",
                      fontSize: "0.875rem",
                    }}
                  >
                    SQL Category
                  </label>
                  <select
                    value={sqlCategory}
                    onChange={(e) => setSqlCategory(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.75rem",
                      border: "1px solid #D1D5DB",
                      borderRadius: "0.5rem",
                      outline: "none",
                      boxSizing: "border-box",
                      backgroundColor: "#ffffff",
                    }}
                  >
                    {SQL_CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "0.5rem",
                    fontWeight: 600,
                    color: "#374151",
                    fontSize: "0.875rem",
                  }}
                >
                  Publish Status
                </label>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    padding: "0.75rem 0",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isPublished}
                    onChange={(e) => setIsPublished(e.target.checked)}
                    style={{
                      accentColor: "#00684A",
                      width: "16px",
                      height: "16px",
                    }}
                  />
                  <span style={{ fontSize: "0.95rem", color: "#4B5563" }}>
                    Published (visible to users)
                  </span>
                </label>
              </div>
            </div>

            {questionType === "coding" && (
              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "0.5rem",
                    fontWeight: 600,
                    color: "#374151",
                    fontSize: "0.875rem",
                  }}
                >
                  Supported Languages{" "}
                  <span style={{ color: "#DC2626" }}>*</span>
                </label>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "1rem",
                    padding: "1rem",
                    backgroundColor: "#F9FAFB",
                    border: "1px solid #E5E7EB",
                    borderRadius: "0.5rem",
                  }}
                >
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <label
                      key={lang}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        fontSize: "0.875rem",
                        cursor: "pointer",
                        color: "#374151",
                        fontWeight: 500,
                        textTransform: "capitalize",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={languages.includes(lang)}
                        onChange={() => toggleLanguage(lang)}
                        style={{
                          accentColor: "#00684A",
                          width: "16px",
                          height: "16px",
                          cursor: "pointer",
                        }}
                      />
                      {lang}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Problem Description */}
          <div
            style={{
              backgroundColor: "#ffffff",
              padding: "2rem",
              borderRadius: "1rem",
              border: "1px solid #E5E7EB",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                marginBottom: "1.5rem",
                paddingBottom: "1rem",
                borderBottom: "1px solid #F3F4F6",
              }}
            >
              <AlignLeft size={20} color="#00684A" />
              <h2
                style={{
                  margin: 0,
                  fontSize: "1.25rem",
                  fontWeight: 700,
                  color: "#111827",
                }}
              >
                Problem Description
              </h2>
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={8}
              placeholder={
                questionType === "sql"
                  ? "Describe the business problem and what data needs to be retrieved..."
                  : "Write a function that takes an integer as an input and checks if it is a prime number or not..."
              }
              style={{
                width: "100%",
                padding: "1rem",
                border: "1px solid #D1D5DB",
                borderRadius: "0.5rem",
                outline: "none",
                boxSizing: "border-box",
                fontSize: "0.95rem",
                fontFamily: "inherit",
                resize: "vertical",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#00684A")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#D1D5DB")}
            />
          </div>

          {/* ======================= SQL SPECIFIC SECTIONS ======================= */}
          {questionType === "sql" && (
            <>
              {/* Table Schemas */}
              <div
                style={{
                  backgroundColor: "#ffffff",
                  padding: "2rem",
                  borderRadius: "1rem",
                  border: "1px solid #E5E7EB",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "1.5rem",
                    paddingBottom: "1rem",
                    borderBottom: "1px solid #F3F4F6",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                    }}
                  >
                    <Table2 size={20} color="#00684A" />
                    <h2
                      style={{
                        margin: 0,
                        fontSize: "1.25rem",
                        fontWeight: 700,
                        color: "#111827",
                      }}
                    >
                      Table Schemas
                    </h2>
                    {isAiGenerated && (
                      <span
                        style={{
                          fontSize: "0.7rem",
                          backgroundColor: "#E1F2E9",
                          color: "#00684A",
                          padding: "0.2rem 0.5rem",
                          borderRadius: "1rem",
                          fontWeight: 600,
                          marginLeft: "0.5rem",
                        }}
                      >
                        AI Generated
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button
                      type="button"
                      onClick={handleLoadSeededSchema}
                      disabled={loadingSeededSchema}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.375rem",
                        padding: "0.4rem 0.75rem",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        color: "#00684A",
                        backgroundColor: "#F0F9F4",
                        border: "1px solid #A8E8BC",
                        borderRadius: "0.375rem",
                        cursor: loadingSeededSchema ? "not-allowed" : "pointer",
                      }}
                    >
                      {loadingSeededSchema ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Database size={14} />
                      )}
                      {loadingSeededSchema ? "Loading..." : "Use Existing DB"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const tableName = prompt("Enter table name:");
                        if (tableName && tableName.trim()) {
                          setSchemas({
                            ...schemas,
                            [tableName.trim()]: { columns: { id: "INTEGER" } },
                          });
                          setSampleData({
                            ...sampleData,
                            [tableName.trim()]: [],
                          });
                        }
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.375rem",
                        padding: "0.4rem 0.75rem",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        color: "#374151",
                        backgroundColor: "#ffffff",
                        border: "1px solid #D1D5DB",
                        borderRadius: "0.375rem",
                        cursor: "pointer",
                      }}
                    >
                      <Plus size={14} /> Add Table
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const tableName = prompt("Enter table name:");
                        if (!tableName || !tableName.trim()) return;
                        const pasteText = prompt(
                          "Paste table schema (format: Column\tType, one per line, or markdown table):",
                        );
                        if (pasteText && pasteText.trim()) {
                          try {
                            const parsed = parseTableSchema(pasteText.trim());
                            if (
                              parsed.columns &&
                              Object.keys(parsed.columns).length > 0
                            ) {
                              setSchemas({
                                ...schemas,
                                [tableName.trim()]: { columns: parsed.columns },
                              });
                              if (!sampleData[tableName.trim()]) {
                                setSampleData({
                                  ...sampleData,
                                  [tableName.trim()]: [],
                                });
                              }
                              alert(
                                `Successfully parsed table "${tableName.trim()}" with ${Object.keys(parsed.columns).length} columns`,
                              );
                            } else {
                              alert(
                                "Failed to parse table schema. Please check the format.",
                              );
                            }
                          } catch (e) {
                            alert(`Error parsing schema: ${e}`);
                          }
                        }
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.375rem",
                        padding: "0.4rem 0.75rem",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        color: "#374151",
                        backgroundColor: "#ffffff",
                        border: "1px solid #D1D5DB",
                        borderRadius: "0.375rem",
                        cursor: "pointer",
                      }}
                    >
                      <List size={14} /> Paste Schema
                    </button>
                  </div>
                </div>

                {Object.keys(schemas).length === 0 ? (
                  <div
                    style={{
                      textAlign: "center",
                      padding: "3rem",
                      backgroundColor: "#F9FAFB",
                      border: "1px dashed #D1D5DB",
                      borderRadius: "0.5rem",
                    }}
                  >
                    <p
                      style={{
                        color: "#6B7280",
                        fontSize: "0.95rem",
                        marginBottom: "1rem",
                      }}
                    >
                      No schemas yet. Use the options above to load from a
                      database, generate with AI, or add manually.
                    </p>
                  </div>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "1rem",
                    }}
                  >
                    {Object.entries(schemas).map(([tableName, schema]) => (
                      <div
                        key={tableName}
                        style={{
                          border: "1px solid #E5E7EB",
                          borderRadius: "0.5rem",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "0.75rem 1rem",
                            backgroundColor: "#F9FAFB",
                            borderBottom: "1px solid #E5E7EB",
                          }}
                        >
                          <span
                            style={{
                              fontWeight: 600,
                              color: "#00684A",
                              fontFamily: "monospace",
                            }}
                          >
                            {tableName}
                          </span>
                          <div style={{ display: "flex", gap: "0.5rem" }}>
                            <button
                              type="button"
                              onClick={() => {
                                const colName = prompt("Enter column name:");
                                if (colName && colName.trim()) {
                                  const colType =
                                    prompt(
                                      "Enter column type (e.g., INTEGER, VARCHAR(255), DATE):",
                                    ) || "VARCHAR(255)";
                                  setSchemas({
                                    ...schemas,
                                    [tableName]: {
                                      columns: {
                                        ...schema.columns,
                                        [colName.trim()]: colType.trim(),
                                      },
                                    },
                                  });
                                }
                              }}
                              style={{
                                fontSize: "0.75rem",
                                color: "#00684A",
                                backgroundColor: "transparent",
                                border: "none",
                                cursor: "pointer",
                                fontWeight: 600,
                              }}
                            >
                              + Column
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const newSchemas = { ...schemas };
                                delete newSchemas[tableName];
                                setSchemas(newSchemas);
                                const newSampleData = { ...sampleData };
                                delete newSampleData[tableName];
                                setSampleData(newSampleData);
                              }}
                              style={{
                                fontSize: "0.75rem",
                                color: "#DC2626",
                                backgroundColor: "transparent",
                                border: "none",
                                cursor: "pointer",
                                fontWeight: 600,
                              }}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                        <table
                          style={{
                            width: "100%",
                            borderCollapse: "collapse",
                            fontSize: "0.875rem",
                          }}
                        >
                          <thead
                            style={{
                              backgroundColor: "#ffffff",
                              borderBottom: "1px solid #E5E7EB",
                              textAlign: "left",
                            }}
                          >
                            <tr>
                              <th
                                style={{
                                  padding: "0.5rem 1rem",
                                  color: "#6B7280",
                                  fontWeight: 500,
                                }}
                              >
                                Column
                              </th>
                              <th
                                style={{
                                  padding: "0.5rem 1rem",
                                  color: "#6B7280",
                                  fontWeight: 500,
                                }}
                              >
                                Type
                              </th>
                              <th
                                style={{
                                  padding: "0.5rem 1rem",
                                  width: "40px",
                                }}
                              ></th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(schema.columns).map(
                              ([colName, colType]) => (
                                <tr
                                  key={colName}
                                  style={{
                                    borderBottom: "1px solid #F3F4F6",
                                    backgroundColor: "#ffffff",
                                  }}
                                >
                                  <td
                                    style={{
                                      padding: "0.5rem 1rem",
                                      fontWeight: 500,
                                      color: "#111827",
                                      fontFamily: "monospace",
                                    }}
                                  >
                                    {colName}
                                  </td>
                                  <td
                                    style={{
                                      padding: "0.5rem 1rem",
                                      color: "#00684A",
                                      fontFamily: "monospace",
                                    }}
                                  >
                                    {String(colType)}
                                  </td>
                                  <td
                                    style={{
                                      padding: "0.5rem 1rem",
                                      textAlign: "right",
                                    }}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const newColumns = {
                                          ...schema.columns,
                                        };
                                        delete newColumns[colName];
                                        setSchemas({
                                          ...schemas,
                                          [tableName]: { columns: newColumns },
                                        });
                                      }}
                                      style={{
                                        color: "#DC2626",
                                        backgroundColor: "transparent",
                                        border: "none",
                                        cursor: "pointer",
                                      }}
                                    >
                                      <X size={14} />
                                    </button>
                                  </td>
                                </tr>
                              ),
                            )}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Sample Data */}
              <div
                style={{
                  backgroundColor: "#ffffff",
                  padding: "2rem",
                  borderRadius: "1rem",
                  border: "1px solid #E5E7EB",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    marginBottom: "1.5rem",
                    paddingBottom: "1rem",
                    borderBottom: "1px solid #F3F4F6",
                  }}
                >
                  <Database size={20} color="#00684A" />
                  <h2
                    style={{
                      margin: 0,
                      fontSize: "1.25rem",
                      fontWeight: 700,
                      color: "#111827",
                    }}
                  >
                    Sample Data
                  </h2>
                  {isAiGenerated && (
                    <span
                      style={{
                        fontSize: "0.7rem",
                        backgroundColor: "#E1F2E9",
                        color: "#00684A",
                        padding: "0.2rem 0.5rem",
                        borderRadius: "1rem",
                        fontWeight: 600,
                        marginLeft: "0.5rem",
                      }}
                    >
                      AI Generated
                    </span>
                  )}
                </div>

                {Object.keys(sampleData).length === 0 ? (
                  <div
                    style={{
                      textAlign: "center",
                      padding: "3rem",
                      backgroundColor: "#F9FAFB",
                      border: "1px dashed #D1D5DB",
                      borderRadius: "0.5rem",
                    }}
                  >
                    <p style={{ color: "#6B7280", fontSize: "0.95rem" }}>
                      {Object.keys(schemas).length === 0
                        ? "Add table schemas first, then sample data will appear here."
                        : "No sample data yet. Add rows to your tables."}
                    </p>
                  </div>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "1rem",
                    }}
                  >
                    {Object.entries(sampleData).map(([tableName, rows]) => {
                      const schema = schemas[tableName];
                      const columns = schema ? Object.keys(schema.columns) : [];
                      return (
                        <div
                          key={tableName}
                          style={{
                            border: "1px solid #E5E7EB",
                            borderRadius: "0.5rem",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              padding: "0.75rem 1rem",
                              backgroundColor: "#F9FAFB",
                              borderBottom: "1px solid #E5E7EB",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "0.5rem",
                              }}
                            >
                              <span
                                style={{
                                  fontWeight: 600,
                                  color: "#00684A",
                                  fontFamily: "monospace",
                                }}
                              >
                                {tableName}
                              </span>
                              <span
                                style={{
                                  fontSize: "0.75rem",
                                  color: "#6B7280",
                                }}
                              >
                                ({rows.length} rows)
                              </span>
                            </div>
                            <div style={{ display: "flex", gap: "0.5rem" }}>
                              <button
                                type="button"
                                onClick={() => {
                                  const newRow = columns.map(() => "");
                                  setSampleData({
                                    ...sampleData,
                                    [tableName]: [...rows, newRow],
                                  });
                                }}
                                style={{
                                  fontSize: "0.75rem",
                                  color: "#00684A",
                                  backgroundColor: "transparent",
                                  border: "none",
                                  cursor: "pointer",
                                  fontWeight: 600,
                                }}
                              >
                                + Add Row
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const pasteText = prompt(
                                    "Paste sample data (format: tab-separated with header row, or markdown table):",
                                  );
                                  if (pasteText && pasteText.trim()) {
                                    try {
                                      const parsedRows = parseSampleData(
                                        pasteText.trim(),
                                        columns,
                                      );
                                      if (parsedRows.length > 0) {
                                        setSampleData({
                                          ...sampleData,
                                          [tableName]: [...rows, ...parsedRows],
                                        });
                                        alert(
                                          `Successfully parsed ${parsedRows.length} row(s)`,
                                        );
                                      } else {
                                        alert("No data rows found.");
                                      }
                                    } catch (e) {
                                      alert(`Error parsing: ${e}`);
                                    }
                                  }
                                }}
                                style={{
                                  fontSize: "0.75rem",
                                  color: "#00684A",
                                  backgroundColor: "transparent",
                                  border: "none",
                                  cursor: "pointer",
                                  fontWeight: 600,
                                }}
                              >
                                Paste Data
                              </button>
                            </div>
                          </div>
                          <div style={{ overflowX: "auto", padding: "1rem" }}>
                            <table
                              style={{
                                width: "100%",
                                borderCollapse: "collapse",
                                fontSize: "0.875rem",
                              }}
                            >
                              <thead
                                style={{ textAlign: "left", color: "#6B7280" }}
                              >
                                <tr>
                                  {columns.map((col) => (
                                    <th
                                      key={col}
                                      style={{
                                        padding: "0.5rem",
                                        fontWeight: 500,
                                      }}
                                    >
                                      {col}
                                    </th>
                                  ))}
                                  <th style={{ width: "40px" }}></th>
                                </tr>
                              </thead>
                              <tbody>
                                {rows.map((row, rowIdx) => (
                                  <tr
                                    key={rowIdx}
                                    style={{ borderTop: "1px solid #F3F4F6" }}
                                  >
                                    {row.map((cell, cellIdx) => (
                                      <td
                                        key={cellIdx}
                                        style={{ padding: "0.5rem" }}
                                      >
                                        <input
                                          type="text"
                                          value={
                                            cell === null ? "" : String(cell)
                                          }
                                          onChange={(e) => {
                                            const newRows = [...rows];
                                            newRows[rowIdx] = [
                                              ...newRows[rowIdx],
                                            ];
                                            newRows[rowIdx][cellIdx] =
                                              e.target.value;
                                            setSampleData({
                                              ...sampleData,
                                              [tableName]: newRows,
                                            });
                                          }}
                                          style={{
                                            width: "100%",
                                            padding: "0.4rem",
                                            border: "1px solid #E5E7EB",
                                            borderRadius: "0.25rem",
                                            fontFamily: "monospace",
                                            fontSize: "0.8rem",
                                            outline: "none",
                                          }}
                                          onFocus={(e) =>
                                            (e.currentTarget.style.borderColor =
                                              "#00684A")
                                          }
                                          onBlur={(e) =>
                                            (e.currentTarget.style.borderColor =
                                              "#E5E7EB")
                                          }
                                        />
                                      </td>
                                    ))}
                                    <td
                                      style={{
                                        padding: "0.5rem",
                                        textAlign: "right",
                                      }}
                                    >
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const newRows = rows.filter(
                                            (_, i) => i !== rowIdx,
                                          );
                                          setSampleData({
                                            ...sampleData,
                                            [tableName]: newRows,
                                          });
                                        }}
                                        style={{
                                          color: "#DC2626",
                                          backgroundColor: "transparent",
                                          border: "none",
                                          cursor: "pointer",
                                        }}
                                      >
                                        <X size={14} />
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Starter & Reference Query (Grouped) */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "1.5rem",
                }}
              >
                <div
                  style={{
                    backgroundColor: "#ffffff",
                    padding: "2rem",
                    borderRadius: "1rem",
                    border: "1px solid #E5E7EB",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      marginBottom: "1rem",
                      paddingBottom: "1rem",
                      borderBottom: "1px solid #F3F4F6",
                    }}
                  >
                    <FileCode size={20} color="#00684A" />
                    <h2
                      style={{
                        margin: 0,
                        fontSize: "1.125rem",
                        fontWeight: 700,
                        color: "#111827",
                      }}
                    >
                      Starter Query
                    </h2>
                  </div>
                  <textarea
                    value={starterQuery}
                    onChange={(e) => setStarterQuery(e.target.value)}
                    rows={8}
                    placeholder="-- Write your SQL query here"
                    style={{
                      width: "100%",
                      padding: "1rem",
                      border: "1px solid #D1D5DB",
                      borderRadius: "0.5rem",
                      outline: "none",
                      boxSizing: "border-box",
                      fontSize: "0.875rem",
                      fontFamily: "monospace",
                      backgroundColor: "#F9FAFB",
                    }}
                    onFocus={(e) =>
                      (e.currentTarget.style.borderColor = "#00684A")
                    }
                    onBlur={(e) =>
                      (e.currentTarget.style.borderColor = "#D1D5DB")
                    }
                  />
                </div>

                <div
                  style={{
                    backgroundColor: "#ffffff",
                    padding: "2rem",
                    borderRadius: "1rem",
                    border: "1px solid #E5E7EB",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      marginBottom: "1rem",
                      paddingBottom: "1rem",
                      borderBottom: "1px solid #F3F4F6",
                    }}
                  >
                    <CheckSquare size={20} color="#00684A" />
                    <h2
                      style={{
                        margin: 0,
                        fontSize: "1.125rem",
                        fontWeight: 700,
                        color: "#111827",
                      }}
                    >
                      Reference Query (Answer)
                    </h2>
                  </div>
                  <textarea
                    value={referenceQuery}
                    onChange={(e) => setReferenceQuery(e.target.value)}
                    rows={8}
                    placeholder="SELECT column1, column2 FROM table_name WHERE condition ORDER BY column1;"
                    style={{
                      width: "100%",
                      padding: "1rem",
                      border: "1px solid #D1D5DB",
                      borderRadius: "0.5rem",
                      outline: "none",
                      boxSizing: "border-box",
                      fontSize: "0.875rem",
                      fontFamily: "monospace",
                      backgroundColor: "#F0F9F4",
                    }}
                    onFocus={(e) =>
                      (e.currentTarget.style.borderColor = "#00684A")
                    }
                    onBlur={(e) =>
                      (e.currentTarget.style.borderColor = "#D1D5DB")
                    }
                  />
                </div>
              </div>

              {/* SQL Evaluation Settings */}
              <div
                style={{
                  backgroundColor: "#ffffff",
                  padding: "2rem",
                  borderRadius: "1rem",
                  border: "1px solid #E5E7EB",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    marginBottom: "1.5rem",
                    paddingBottom: "1rem",
                    borderBottom: "1px solid #F3F4F6",
                  }}
                >
                  <Sliders size={20} color="#00684A" />
                  <h2
                    style={{
                      margin: 0,
                      fontSize: "1.25rem",
                      fontWeight: 700,
                      color: "#111827",
                    }}
                  >
                    Evaluation Settings
                  </h2>
                </div>

                <label
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "0.75rem",
                    cursor: "pointer",
                    padding: "1rem",
                    backgroundColor: orderSensitive ? "#F0F9F4" : "#F9FAFB",
                    border: `1px solid ${orderSensitive ? "#A8E8BC" : "#E5E7EB"}`,
                    borderRadius: "0.5rem",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={orderSensitive}
                    onChange={(e) => setOrderSensitive(e.target.checked)}
                    style={{
                      marginTop: "0.25rem",
                      width: "16px",
                      height: "16px",
                      accentColor: "#00684A",
                    }}
                  />
                  <div>
                    <div style={{ fontWeight: 600, color: "#111827" }}>
                      Order Sensitive Evaluation
                    </div>
                    <div
                      style={{
                        fontSize: "0.875rem",
                        color: "#6B7280",
                        marginTop: "0.25rem",
                      }}
                    >
                      When enabled, candidate results must be in the exact same
                      order as expected (useful when testing ORDER BY clauses).
                    </div>
                  </div>
                </label>

                <div style={{ marginTop: "1.5rem" }}>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "0.5rem",
                      fontWeight: 600,
                      color: "#374151",
                      fontSize: "0.875rem",
                    }}
                  >
                    Expected Output Preview (Optional)
                  </label>
                  <p
                    style={{
                      fontSize: "0.8rem",
                      color: "#6B7280",
                      marginBottom: "0.75rem",
                    }}
                  >
                    Paste a text representation of the expected result set to
                    show candidates what the output should look like.
                  </p>
                  <textarea
                    value={sqlExpectedOutput}
                    onChange={(e) => setSqlExpectedOutput(e.target.value)}
                    rows={4}
                    placeholder="e.g., markdown table or plain-text rows"
                    style={{
                      width: "100%",
                      padding: "1rem",
                      border: "1px solid #D1D5DB",
                      borderRadius: "0.5rem",
                      outline: "none",
                      boxSizing: "border-box",
                      fontSize: "0.875rem",
                      fontFamily: "monospace",
                    }}
                    onFocus={(e) =>
                      (e.currentTarget.style.borderColor = "#00684A")
                    }
                    onBlur={(e) =>
                      (e.currentTarget.style.borderColor = "#D1D5DB")
                    }
                  />
                </div>
              </div>
            </>
          )}

          {/* ======================= CODING SPECIFIC SECTIONS ======================= */}
          {questionType === "coding" && (
            <>
              {/* Examples */}
              <div
                style={{
                  backgroundColor: "#ffffff",
                  padding: "2rem",
                  borderRadius: "1rem",
                  border: "1px solid #E5E7EB",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "1.5rem",
                    paddingBottom: "1rem",
                    borderBottom: "1px solid #F3F4F6",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                    }}
                  >
                    <PlaySquare size={20} color="#00684A" />
                    <h2
                      style={{
                        margin: 0,
                        fontSize: "1.25rem",
                        fontWeight: 700,
                        color: "#111827",
                      }}
                    >
                      Examples
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setExamples([
                        ...examples,
                        { input: "", output: "", explanation: "" },
                      ])
                    }
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.375rem",
                      padding: "0.4rem 0.75rem",
                      fontSize: "0.875rem",
                      fontWeight: 600,
                      color: "#00684A",
                      backgroundColor: "#F0F9F4",
                      border: "1px solid #A8E8BC",
                      borderRadius: "0.5rem",
                      cursor: "pointer",
                    }}
                  >
                    <Plus size={16} /> Add Example
                  </button>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "1.5rem",
                  }}
                >
                  {examples.map((example, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: "1.5rem",
                        border: "1px solid #E5E7EB",
                        borderRadius: "0.75rem",
                        backgroundColor: "#F9FAFB",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: "1rem",
                        }}
                      >
                        <h4
                          style={{
                            margin: 0,
                            fontWeight: 700,
                            color: "#374151",
                          }}
                        >
                          Example {idx + 1}
                        </h4>
                        {examples.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              setExamples(examples.filter((_, i) => i !== idx))
                            }
                            style={{
                              color: "#DC2626",
                              backgroundColor: "transparent",
                              border: "none",
                              cursor: "pointer",
                              fontSize: "0.875rem",
                              fontWeight: 600,
                              display: "flex",
                              alignItems: "center",
                              gap: "0.25rem",
                            }}
                          >
                            <Trash2 size={14} /> Remove
                          </button>
                        )}
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: "1rem",
                          marginBottom: "1rem",
                        }}
                      >
                        <div>
                          <label
                            style={{
                              display: "block",
                              marginBottom: "0.25rem",
                              fontWeight: 600,
                              color: "#4B5563",
                              fontSize: "0.8rem",
                              textTransform: "uppercase",
                            }}
                          >
                            Input
                          </label>
                          <input
                            type="text"
                            value={example.input}
                            onChange={(e) => {
                              const newExamples = [...examples];
                              newExamples[idx].input = e.target.value;
                              setExamples(newExamples);
                            }}
                            placeholder="n = 7"
                            style={{
                              width: "100%",
                              padding: "0.625rem",
                              border: "1px solid #D1D5DB",
                              borderRadius: "0.5rem",
                              outline: "none",
                              boxSizing: "border-box",
                              fontFamily: "monospace",
                              fontSize: "0.875rem",
                            }}
                            onFocus={(e) =>
                              (e.currentTarget.style.borderColor = "#00684A")
                            }
                            onBlur={(e) =>
                              (e.currentTarget.style.borderColor = "#D1D5DB")
                            }
                          />
                        </div>
                        <div>
                          <label
                            style={{
                              display: "block",
                              marginBottom: "0.25rem",
                              fontWeight: 600,
                              color: "#4B5563",
                              fontSize: "0.8rem",
                              textTransform: "uppercase",
                            }}
                          >
                            Output
                          </label>
                          <input
                            type="text"
                            value={example.output}
                            onChange={(e) => {
                              const newExamples = [...examples];
                              newExamples[idx].output = e.target.value;
                              setExamples(newExamples);
                            }}
                            placeholder='"Prime"'
                            style={{
                              width: "100%",
                              padding: "0.625rem",
                              border: "1px solid #D1D5DB",
                              borderRadius: "0.5rem",
                              outline: "none",
                              boxSizing: "border-box",
                              fontFamily: "monospace",
                              fontSize: "0.875rem",
                            }}
                            onFocus={(e) =>
                              (e.currentTarget.style.borderColor = "#00684A")
                            }
                            onBlur={(e) =>
                              (e.currentTarget.style.borderColor = "#D1D5DB")
                            }
                          />
                        </div>
                      </div>
                      <div>
                        <label
                          style={{
                            display: "block",
                            marginBottom: "0.25rem",
                            fontWeight: 600,
                            color: "#4B5563",
                            fontSize: "0.8rem",
                            textTransform: "uppercase",
                          }}
                        >
                          Explanation (Optional)
                        </label>
                        <textarea
                          value={example.explanation}
                          onChange={(e) => {
                            const newExamples = [...examples];
                            newExamples[idx].explanation = e.target.value;
                            setExamples(newExamples);
                          }}
                          rows={2}
                          placeholder="7 has only 2 factors: 1 and 7"
                          style={{
                            width: "100%",
                            padding: "0.625rem",
                            border: "1px solid #D1D5DB",
                            borderRadius: "0.5rem",
                            outline: "none",
                            boxSizing: "border-box",
                            fontSize: "0.875rem",
                            resize: "vertical",
                          }}
                          onFocus={(e) =>
                            (e.currentTarget.style.borderColor = "#00684A")
                          }
                          onBlur={(e) =>
                            (e.currentTarget.style.borderColor = "#D1D5DB")
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Secure Mode Settings */}
              <div
                style={{
                  backgroundColor: "#ffffff",
                  padding: "2rem",
                  borderRadius: "1rem",
                  border: "1px solid #E5E7EB",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    marginBottom: "1.5rem",
                    paddingBottom: "1rem",
                    borderBottom: "1px solid #F3F4F6",
                  }}
                >
                  <Lock size={20} color="#00684A" />
                  <h2
                    style={{
                      margin: 0,
                      fontSize: "1.25rem",
                      fontWeight: 700,
                      color: "#111827",
                    }}
                  >
                    Secure Mode
                  </h2>
                  <span
                    style={{
                      fontSize: "0.7rem",
                      backgroundColor: "#FEE2E2",
                      color: "#B91C1C",
                      padding: "0.2rem 0.5rem",
                      borderRadius: "1rem",
                      fontWeight: 600,
                      marginLeft: "0.5rem",
                      textTransform: "uppercase",
                    }}
                  >
                    Anti-Cheat
                  </span>
                </div>

                <label
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "0.75rem",
                    cursor: isAiGenerated ? "not-allowed" : "pointer",
                    padding: "1rem",
                    backgroundColor: secureMode ? "#F0F9F4" : "#F9FAFB",
                    border: `1px solid ${secureMode ? "#A8E8BC" : "#E5E7EB"}`,
                    borderRadius: "0.75rem",
                    marginBottom: "1.5rem",
                    opacity: isAiGenerated ? 0.7 : 1,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={secureMode}
                    onChange={(e) => setSecureMode(e.target.checked)}
                    disabled={isAiGenerated}
                    style={{
                      marginTop: "0.25rem",
                      width: "18px",
                      height: "18px",
                      accentColor: "#00684A",
                      cursor: isAiGenerated ? "not-allowed" : "pointer",
                    }}
                  />
                  <div>
                    <div
                      style={{
                        fontWeight: 600,
                        color: "#111827",
                        fontSize: "1rem",
                      }}
                    >
                      Enable Secure Mode
                    </div>
                    <div
                      style={{
                        fontSize: "0.875rem",
                        color: "#6B7280",
                        marginTop: "0.25rem",
                        lineHeight: "1.5",
                      }}
                    >
                      When enabled, candidates only write the core function
                      body. I/O manipulation is completely blocked.
                    </div>
                  </div>
                </label>

                {secureMode && (
                  <div
                    style={{
                      padding: "1.5rem",
                      backgroundColor: "#F9FAFB",
                      border: "1px solid #E5E7EB",
                      borderRadius: "0.75rem",
                    }}
                  >
                    <h4
                      style={{
                        margin: "0 0 1rem 0",
                        fontWeight: 700,
                        color: "#374151",
                      }}
                    >
                      Function Signature
                    </h4>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "1.5rem",
                        marginBottom: "1.5rem",
                      }}
                    >
                      <div>
                        <label
                          style={{
                            display: "block",
                            marginBottom: "0.5rem",
                            fontWeight: 600,
                            color: "#374151",
                            fontSize: "0.875rem",
                          }}
                        >
                          Function Name *
                        </label>
                        <input
                          type="text"
                          value={functionName}
                          onChange={(e) => setFunctionName(e.target.value)}
                          placeholder="e.g., twoSum"
                          disabled={isAiGenerated}
                          style={{
                            width: "100%",
                            padding: "0.75rem",
                            border: "1px solid #D1D5DB",
                            borderRadius: "0.5rem",
                            outline: "none",
                            boxSizing: "border-box",
                            fontFamily: "monospace",
                          }}
                        />
                      </div>
                      <div>
                        <label
                          style={{
                            display: "block",
                            marginBottom: "0.5rem",
                            fontWeight: 600,
                            color: "#374151",
                            fontSize: "0.875rem",
                          }}
                        >
                          Return Type *
                        </label>
                        <select
                          value={returnType}
                          onChange={(e) => setReturnType(e.target.value)}
                          disabled={isAiGenerated}
                          style={{
                            width: "100%",
                            padding: "0.75rem",
                            border: "1px solid #D1D5DB",
                            borderRadius: "0.5rem",
                            outline: "none",
                            boxSizing: "border-box",
                            fontFamily: "monospace",
                            backgroundColor: "#ffffff",
                          }}
                        >
                          <option value="int">int</option>
                          <option value="long">long</option>
                          <option value="double">double</option>
                          <option value="boolean">boolean</option>
                          <option value="string">string</option>
                          <option value="int[]">int[]</option>
                          <option value="string[]">string[]</option>
                          <option value="int[][]">int[][]</option>
                          <option value="List<Integer>">
                            List&lt;Integer&gt;
                          </option>
                          <option value="List<String>">
                            List&lt;String&gt;
                          </option>
                          <option value="void">void</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ marginBottom: "1.5rem" }}>
                      <label
                        style={{
                          display: "block",
                          marginBottom: "0.5rem",
                          fontWeight: 600,
                          color: "#374151",
                          fontSize: "0.875rem",
                        }}
                      >
                        Parameters *
                      </label>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.75rem",
                        }}
                      >
                        {parameters.map((param, idx) => (
                          <div
                            key={idx}
                            style={{
                              display: "flex",
                              gap: "0.75rem",
                              alignItems: "center",
                            }}
                          >
                            <input
                              type="text"
                              value={param.name}
                              onChange={(e) => {
                                const newParams = [...parameters];
                                newParams[idx].name = e.target.value;
                                setParameters(newParams);
                              }}
                              placeholder="Name"
                              disabled={isAiGenerated}
                              style={{
                                flex: 1,
                                padding: "0.625rem",
                                border: "1px solid #D1D5DB",
                                borderRadius: "0.5rem",
                                outline: "none",
                                fontFamily: "monospace",
                              }}
                            />
                            <select
                              value={param.type}
                              onChange={(e) => {
                                const newParams = [...parameters];
                                newParams[idx].type = e.target.value;
                                setParameters(newParams);
                              }}
                              disabled={isAiGenerated}
                              style={{
                                padding: "0.625rem",
                                border: "1px solid #D1D5DB",
                                borderRadius: "0.5rem",
                                outline: "none",
                                fontFamily: "monospace",
                                backgroundColor: "#ffffff",
                              }}
                            >
                              <option value="int">int</option>
                              <option value="long">long</option>
                              <option value="double">double</option>
                              <option value="boolean">boolean</option>
                              <option value="string">string</option>
                              <option value="int[]">int[]</option>
                              <option value="string[]">string[]</option>
                              <option value="int[][]">int[][]</option>
                              <option value="List<Integer>">
                                List&lt;Integer&gt;
                              </option>
                              <option value="List<String>">
                                List&lt;String&gt;
                              </option>
                            </select>
                            <button
                              type="button"
                              onClick={() => {
                                if (parameters.length > 1)
                                  setParameters(
                                    parameters.filter((_, i) => i !== idx),
                                  );
                              }}
                              disabled={
                                parameters.length === 1 || isAiGenerated
                              }
                              style={{
                                padding: "0.5rem",
                                color:
                                  parameters.length === 1 || isAiGenerated
                                    ? "#9CA3AF"
                                    : "#DC2626",
                                backgroundColor: "transparent",
                                border: "none",
                                cursor:
                                  parameters.length === 1 || isAiGenerated
                                    ? "not-allowed"
                                    : "pointer",
                              }}
                            >
                              <X size={20} />
                            </button>
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setParameters([
                            ...parameters,
                            { name: "", type: "int" },
                          ])
                        }
                        disabled={isAiGenerated}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.375rem",
                          marginTop: "0.75rem",
                          padding: "0.4rem 0.75rem",
                          fontSize: "0.8rem",
                          fontWeight: 600,
                          color: "#374151",
                          backgroundColor: "#ffffff",
                          border: "1px solid #D1D5DB",
                          borderRadius: "0.375rem",
                          cursor: isAiGenerated ? "not-allowed" : "pointer",
                        }}
                      >
                        <Plus size={14} /> Add Parameter
                      </button>
                    </div>

                    <div
                      style={{
                        backgroundColor: "#111827",
                        borderRadius: "0.5rem",
                        padding: "1rem",
                      }}
                    >
                      <p
                        style={{
                          margin: "0 0 0.5rem 0",
                          color: "#9CA3AF",
                          fontSize: "0.75rem",
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                        }}
                      >
                        Java Preview
                      </p>
                      <code
                        style={{
                          color: "#34D399",
                          fontFamily: "monospace",
                          fontSize: "0.9rem",
                        }}
                      >
                        public static {returnType}{" "}
                        {functionName || "functionName"}(
                        {parameters
                          .filter((p) => p.name)
                          .map((p) => `${p.type} ${p.name}`)
                          .join(", ")}
                        )
                      </code>
                    </div>
                  </div>
                )}
              </div>

              {/* Starter Code */}
              <div
                style={{
                  backgroundColor: "#ffffff",
                  padding: "2rem",
                  borderRadius: "1rem",
                  border: "1px solid #E5E7EB",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    marginBottom: "1.5rem",
                    paddingBottom: "1rem",
                    borderBottom: "1px solid #F3F4F6",
                  }}
                >
                  <FileCode size={20} color="#00684A" />
                  <h2
                    style={{
                      margin: 0,
                      fontSize: "1.25rem",
                      fontWeight: 700,
                      color: "#111827",
                    }}
                  >
                    Starter Code (Boilerplate)
                  </h2>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "1.5rem",
                  }}
                >
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <div key={lang}>
                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                          marginBottom: "0.5rem",
                          fontWeight: 600,
                          color: "#374151",
                          fontSize: "0.875rem",
                          textTransform: "capitalize",
                        }}
                      >
                        {lang}
                        {languages.includes(lang) && (
                          <span
                            style={{
                              fontSize: "0.65rem",
                              backgroundColor: "#D1FAE5",
                              color: "#059669",
                              padding: "0.1rem 0.4rem",
                              borderRadius: "1rem",
                              textTransform: "uppercase",
                            }}
                          >
                            Enabled
                          </span>
                        )}
                      </label>
                      <textarea
                        rows={6}
                        value={starterCode[lang] || ""}
                        onChange={(e) =>
                          setStarterCode((prev) => ({
                            ...prev,
                            [lang]: e.target.value,
                          }))
                        }
                        disabled={isAiGenerated}
                        placeholder={
                          isAiGenerated
                            ? "AI-generated starter code (cannot be edited)"
                            : "Enter starter code for this language"
                        }
                        style={{
                          width: "100%",
                          padding: "1rem",
                          border: "1px solid #D1D5DB",
                          borderRadius: "0.5rem",
                          outline: "none",
                          boxSizing: "border-box",
                          fontSize: "0.875rem",
                          fontFamily: "monospace",
                          backgroundColor: isAiGenerated
                            ? "#F9FAFB"
                            : "#ffffff",
                        }}
                        onFocus={(e) => {
                          if (!isAiGenerated)
                            e.currentTarget.style.borderColor = "#00684A";
                        }}
                        onBlur={(e) => {
                          if (!isAiGenerated)
                            e.currentTarget.style.borderColor = "#D1D5DB";
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Public Test Cases */}
              <div
                style={{
                  backgroundColor: "#ffffff",
                  padding: "2rem",
                  borderRadius: "1rem",
                  border: "1px solid #E5E7EB",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "1.5rem",
                    paddingBottom: "1rem",
                    borderBottom: "1px solid #F3F4F6",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                    }}
                  >
                    <Eye size={20} color="#00684A" />
                    <h2
                      style={{
                        margin: 0,
                        fontSize: "1.25rem",
                        fontWeight: 700,
                        color: "#111827",
                      }}
                    >
                      Public Test Cases
                    </h2>
                    <span
                      style={{
                        fontSize: "0.7rem",
                        backgroundColor: "#E0E7FF",
                        color: "#4F46E5",
                        padding: "0.2rem 0.5rem",
                        borderRadius: "1rem",
                        fontWeight: 600,
                        marginLeft: "0.5rem",
                      }}
                    >
                      Visible to candidates
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => addTestcase("public")}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.375rem",
                      padding: "0.4rem 0.75rem",
                      fontSize: "0.875rem",
                      fontWeight: 600,
                      color: "#00684A",
                      backgroundColor: "#F0F9F4",
                      border: "1px solid #A8E8BC",
                      borderRadius: "0.5rem",
                      cursor: "pointer",
                    }}
                  >
                    <Plus size={16} /> Add Test Case
                  </button>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "1.5rem",
                  }}
                >
                  {publicTestcases.map((tc, idx) => (
                    <div
                      key={`public-${idx}`}
                      style={{
                        padding: "1.5rem",
                        border: "1px solid #E5E7EB",
                        borderRadius: "0.75rem",
                        backgroundColor: "#F9FAFB",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: "1rem",
                        }}
                      >
                        <h4
                          style={{
                            margin: 0,
                            fontWeight: 700,
                            color: "#374151",
                          }}
                        >
                          Public Case {idx + 1}
                        </h4>
                        <button
                          type="button"
                          onClick={() => removeTestcase("public", idx)}
                          disabled={publicTestcases.length === 1}
                          style={{
                            color:
                              publicTestcases.length === 1
                                ? "#9CA3AF"
                                : "#DC2626",
                            backgroundColor: "transparent",
                            border: "none",
                            cursor:
                              publicTestcases.length === 1
                                ? "not-allowed"
                                : "pointer",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                            display: "flex",
                            alignItems: "center",
                            gap: "0.25rem",
                          }}
                        >
                          <Trash2 size={14} /> Remove
                        </button>
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: "1.5rem",
                        }}
                      >
                        <div>
                          <label
                            style={{
                              display: "block",
                              marginBottom: "0.25rem",
                              fontWeight: 600,
                              color: "#4B5563",
                              fontSize: "0.8rem",
                              textTransform: "uppercase",
                            }}
                          >
                            Input (stdin)
                          </label>
                          <textarea
                            rows={3}
                            value={formatTestcaseInput(tc.input)}
                            onChange={(e) =>
                              updateTestcase(
                                idx,
                                "public",
                                "input",
                                e.target.value,
                              )
                            }
                            placeholder={getStdinPlaceholder()}
                            style={{
                              width: "100%",
                              padding: "0.75rem",
                              border: "1px solid #D1D5DB",
                              borderRadius: "0.5rem",
                              outline: "none",
                              boxSizing: "border-box",
                              fontFamily: "monospace",
                              fontSize: "0.875rem",
                            }}
                            onFocus={(e) =>
                              (e.currentTarget.style.borderColor = "#00684A")
                            }
                            onBlur={(e) =>
                              (e.currentTarget.style.borderColor = "#D1D5DB")
                            }
                          />
                        </div>
                        <div>
                          <label
                            style={{
                              display: "block",
                              marginBottom: "0.25rem",
                              fontWeight: 600,
                              color: "#4B5563",
                              fontSize: "0.8rem",
                              textTransform: "uppercase",
                            }}
                          >
                            Expected Output
                          </label>
                          <textarea
                            rows={3}
                            value={formatTestcaseExpectedOutput(
                              tc.expected_output,
                            )}
                            onChange={(e) =>
                              updateTestcase(
                                idx,
                                "public",
                                "expected_output",
                                e.target.value,
                              )
                            }
                            placeholder={getExpectedOutputPlaceholder(
                              returnType,
                            )}
                            style={{
                              width: "100%",
                              padding: "0.75rem",
                              border: "1px solid #D1D5DB",
                              borderRadius: "0.5rem",
                              outline: "none",
                              boxSizing: "border-box",
                              fontFamily: "monospace",
                              fontSize: "0.875rem",
                            }}
                            onFocus={(e) =>
                              (e.currentTarget.style.borderColor = "#00684A")
                            }
                            onBlur={(e) =>
                              (e.currentTarget.style.borderColor = "#D1D5DB")
                            }
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Hidden Test Cases */}
              <div
                style={{
                  backgroundColor: "#ffffff",
                  padding: "2rem",
                  borderRadius: "1rem",
                  border: "1px solid #E5E7EB",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "1.5rem",
                    paddingBottom: "1rem",
                    borderBottom: "1px solid #F3F4F6",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                    }}
                  >
                    <EyeOff size={20} color="#00684A" />
                    <h2
                      style={{
                        margin: 0,
                        fontSize: "1.25rem",
                        fontWeight: 700,
                        color: "#111827",
                      }}
                    >
                      Hidden Test Cases
                    </h2>
                    <span
                      style={{
                        fontSize: "0.7rem",
                        backgroundColor: "#FEF9C3",
                        color: "#D97706",
                        padding: "0.2rem 0.5rem",
                        borderRadius: "1rem",
                        fontWeight: 600,
                        marginLeft: "0.5rem",
                      }}
                    >
                      Hidden from candidates
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => addTestcase("hidden")}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.375rem",
                      padding: "0.4rem 0.75rem",
                      fontSize: "0.875rem",
                      fontWeight: 600,
                      color: "#00684A",
                      backgroundColor: "#F0F9F4",
                      border: "1px solid #A8E8BC",
                      borderRadius: "0.5rem",
                      cursor: "pointer",
                    }}
                  >
                    <Plus size={16} /> Add Hidden Case
                  </button>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "1.5rem",
                  }}
                >
                  {hiddenTestcases.map((tc, idx) => (
                    <div
                      key={`hidden-${idx}`}
                      style={{
                        padding: "1.5rem",
                        border: "1px solid #FDE68A",
                        borderRadius: "0.75rem",
                        backgroundColor: "#FEFCE8",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: "1rem",
                        }}
                      >
                        <h4
                          style={{
                            margin: 0,
                            fontWeight: 700,
                            color: "#92400E",
                          }}
                        >
                          Hidden Case {idx + 1}
                        </h4>
                        <button
                          type="button"
                          onClick={() => removeTestcase("hidden", idx)}
                          disabled={hiddenTestcases.length === 1}
                          style={{
                            color:
                              hiddenTestcases.length === 1
                                ? "#D1D5DB"
                                : "#DC2626",
                            backgroundColor: "transparent",
                            border: "none",
                            cursor:
                              hiddenTestcases.length === 1
                                ? "not-allowed"
                                : "pointer",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                            display: "flex",
                            alignItems: "center",
                            gap: "0.25rem",
                          }}
                        >
                          <Trash2 size={14} /> Remove
                        </button>
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: "1.5rem",
                        }}
                      >
                        <div>
                          <label
                            style={{
                              display: "block",
                              marginBottom: "0.25rem",
                              fontWeight: 600,
                              color: "#92400E",
                              fontSize: "0.8rem",
                              textTransform: "uppercase",
                            }}
                          >
                            Input (stdin)
                          </label>
                          <textarea
                            rows={3}
                            value={formatTestcaseInput(tc.input)}
                            onChange={(e) =>
                              updateTestcase(
                                idx,
                                "hidden",
                                "input",
                                e.target.value,
                              )
                            }
                            placeholder={getStdinPlaceholder()}
                            style={{
                              width: "100%",
                              padding: "0.75rem",
                              border: "1px solid #FCD34D",
                              borderRadius: "0.5rem",
                              outline: "none",
                              boxSizing: "border-box",
                              fontFamily: "monospace",
                              fontSize: "0.875rem",
                              backgroundColor: "#ffffff",
                            }}
                            onFocus={(e) =>
                              (e.currentTarget.style.borderColor = "#D97706")
                            }
                            onBlur={(e) =>
                              (e.currentTarget.style.borderColor = "#FCD34D")
                            }
                          />
                        </div>
                        <div>
                          <label
                            style={{
                              display: "block",
                              marginBottom: "0.25rem",
                              fontWeight: 600,
                              color: "#92400E",
                              fontSize: "0.8rem",
                              textTransform: "uppercase",
                            }}
                          >
                            Expected Output
                          </label>
                          <textarea
                            rows={3}
                            value={formatTestcaseExpectedOutput(
                              tc.expected_output,
                            )}
                            onChange={(e) =>
                              updateTestcase(
                                idx,
                                "hidden",
                                "expected_output",
                                e.target.value,
                              )
                            }
                            placeholder={getExpectedOutputPlaceholder(
                              returnType,
                            )}
                            style={{
                              width: "100%",
                              padding: "0.75rem",
                              border: "1px solid #FCD34D",
                              borderRadius: "0.5rem",
                              outline: "none",
                              boxSizing: "border-box",
                              fontFamily: "monospace",
                              fontSize: "0.875rem",
                              backgroundColor: "#ffffff",
                            }}
                            onFocus={(e) =>
                              (e.currentTarget.style.borderColor = "#D97706")
                            }
                            onBlur={(e) =>
                              (e.currentTarget.style.borderColor = "#FCD34D")
                            }
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Constraints */}
          <div
            style={{
              backgroundColor: "#ffffff",
              padding: "2rem",
              borderRadius: "1rem",
              border: "1px solid #E5E7EB",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "1.5rem",
                paddingBottom: "1rem",
                borderBottom: "1px solid #F3F4F6",
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
              >
                <AlertCircle size={20} color="#00684A" />
                <h2
                  style={{
                    margin: 0,
                    fontSize: "1.25rem",
                    fontWeight: 700,
                    color: "#111827",
                  }}
                >
                  Constraints
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setConstraints([...constraints, ""])}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.375rem",
                  padding: "0.4rem 0.75rem",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color: "#00684A",
                  backgroundColor: "#F0F9F4",
                  border: "1px solid #A8E8BC",
                  borderRadius: "0.5rem",
                  cursor: "pointer",
                }}
              >
                <Plus size={16} /> Add Constraint
              </button>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
              }}
            >
              {constraints.map((constraint, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    gap: "0.5rem",
                    alignItems: "center",
                  }}
                >
                  <input
                    type="text"
                    value={constraint}
                    onChange={(e) => {
                      const newConstraints = [...constraints];
                      newConstraints[idx] = e.target.value;
                      setConstraints(newConstraints);
                    }}
                    placeholder={
                      questionType === "sql"
                        ? "e.g., Results must be ordered by salary DESC"
                        : "e.g., 0 <= n <= 5 * 10^6"
                    }
                    style={{
                      flex: 1,
                      padding: "0.75rem",
                      border: "1px solid #D1D5DB",
                      borderRadius: "0.5rem",
                      outline: "none",
                      boxSizing: "border-box",
                      fontFamily: "monospace",
                      fontSize: "0.95rem",
                    }}
                    onFocus={(e) =>
                      (e.currentTarget.style.borderColor = "#00684A")
                    }
                    onBlur={(e) =>
                      (e.currentTarget.style.borderColor = "#D1D5DB")
                    }
                  />
                  {constraints.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setConstraints(constraints.filter((_, i) => i !== idx))
                      }
                      style={{
                        padding: "0.5rem",
                        color: "#DC2626",
                        backgroundColor: "transparent",
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      <X size={20} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sticky Form Actions (Bottom) */}
        <div
          style={{
            position: "sticky",
            bottom: "0",
            backgroundColor: "rgba(255, 255, 255, 0.95)",
            backdropFilter: "blur(12px)",
            padding: "1rem 0",
            borderTop: "1px solid #E5E7EB",
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            gap: "0.75rem",
            marginTop: "2rem",
            zIndex: 10,
          }}
        >
          <button
            type="button"
            onClick={() => router.push("/dsa/questions")}
            style={{
              padding: "0.5rem 1.25rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              color: "#4B5563",
              backgroundColor: "#ffffff",
              border: "1px solid #D1D5DB",
              borderRadius: "9999px",
              cursor: "pointer",
              transition: "all 0.2s",
              boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#F9FAFB";
              e.currentTarget.style.borderColor = "#9CA3AF";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "#ffffff";
              e.currentTarget.style.borderColor = "#D1D5DB";
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={saving}
            style={{
              padding: "0.5rem 1.5rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              color: "#ffffff",
              backgroundColor: "#00684A",
              border: "1px solid #00684A",
              borderRadius: "9999px",
              cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.7 : 1,
              boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              if (!saving) {
                e.currentTarget.style.backgroundColor = "#084A2A";
                e.currentTarget.style.borderColor = "#084A2A";
              }
            }}
            onMouseLeave={(e) => {
              if (!saving) {
                e.currentTarget.style.backgroundColor = "#00684A";
                e.currentTarget.style.borderColor = "#00684A";
              }
            }}
          >
            {saving
              ? "Creating..."
              : `Create ${questionType === "sql" ? "SQL" : "Coding"} Question`}
          </button>
        </div>
      </div>
    </div>
  );
}
