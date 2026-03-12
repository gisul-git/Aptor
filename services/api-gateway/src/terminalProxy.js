const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const WebSocket = require("ws");

function wsToHttpBase(wsUrl) {
  const normalized = String(wsUrl || "").trim();
  if (!normalized) return "http://localhost:4040";
  return normalized
    .replace(/^wss:/i, "https:")
    .replace(/^ws:/i, "http:")
    .replace(/\/terminal\/?$/i, "");
}

function normalizeCloseReason(reason) {
  const value = String(reason || "").trim().toLowerCase();
  if (!value) return "disconnect";
  if (["disconnect", "idle_timeout", "explicit_end", "sandbox_close", "backend_shutdown"].includes(value)) {
    return value;
  }
  return "disconnect";
}

function createTerminalProxy(options) {
  const { app, server, services } = options;
  const sandboxWsBase = process.env.DEVOPS_SANDBOX_WS_URL || "ws://localhost:4040/terminal";
  const sandboxHttpBase = process.env.DEVOPS_SANDBOX_HTTP_URL || wsToHttpBase(sandboxWsBase);
  const idleMs = Math.max(10_000, Number(process.env.TERMINAL_IDLE_TIMEOUT_MS || 15 * 60 * 1000));
  const internalSubmitPath = process.env.DEVOPS_SANDBOX_SUBMIT_PATH || "/submit";
  const persistencePath =
    process.env.DEVOPS_TERMINAL_PERSIST_PATH || "/api/internal/terminal-sessions";
  const sessions = new Map();

  const observability = (eventName, payload) => {
    console.log(`[terminal:${eventName}]`, {
      at: new Date().toISOString(),
      ...payload,
    });
  };

  const safeClientError = (ws, message = "Terminal connection failed") => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(
      JSON.stringify({
        type: "error",
        message,
      })
    );
  };

  const setIdleTimer = (session) => {
    if (session.idleTimer) clearTimeout(session.idleTimer);
    session.idleTimer = setTimeout(() => {
      submitAndPersist(session, "idle_timeout").finally(() => {
        try {
          session.clientWs.close(1000, "idle timeout");
        } catch {}
        try {
          session.sandboxWs.close(1000, "idle timeout");
        } catch {}
      });
    }, idleMs);
  };

  const persistTerminalSession = async (session, submitResponse, status, closeReason) => {
    const payload = {
      user_id: session.userId || "anonymous",
      session_id: session.sessionId,
      started_at: new Date(session.startedAt).toISOString(),
      ended_at: new Date().toISOString(),
      status,
      close_reason: normalizeCloseReason(closeReason),
      transcript: session.transcript.join(""),
      command_history: submitResponse?.history || session.commandHistory,
    };

    await axios.post(`${services.devops}${persistencePath}`, payload, {
      timeout: 12000,
      headers: {
        "x-internal-terminal": "1",
      },
    });
  };

  const submitAndPersist = async (session, closeReason) => {
    if (!session || session.submitting || session.submitted) return;
    session.submitting = true;
    const reason = normalizeCloseReason(closeReason);
    let submitResponse = null;
    let status = "submitted";
    try {
      const response = await axios.post(
        `${sandboxHttpBase}${internalSubmitPath}`,
        { session_id: session.sessionId },
        { timeout: 15000 }
      );
      submitResponse = response?.data || null;
      observability("session_submitted", {
        session_id: session.sessionId,
        user_id: session.userId || "anonymous",
        close_reason: reason,
      });
    } catch (error) {
      status = "failed";
      observability("session_failed", {
        session_id: session.sessionId,
        user_id: session.userId || "anonymous",
        close_reason: reason,
        error: error?.message || "submit failed",
      });
    }

    try {
      await persistTerminalSession(session, submitResponse, status, reason);
    } catch (persistError) {
      observability("session_failed", {
        session_id: session.sessionId,
        user_id: session.userId || "anonymous",
        close_reason: reason,
        error: persistError?.message || "persist failed",
      });
    } finally {
      session.submitting = false;
      session.submitted = true;
      if (session.idleTimer) clearTimeout(session.idleTimer);
      sessions.delete(session.sessionId);
    }
  };

  const buildSandboxWsUrl = (sessionId) => {
    const sid = String(sessionId || "").trim();
    if (!sid) return sandboxWsBase;
    const hasQuery = sandboxWsBase.includes("?");
    return `${sandboxWsBase}${hasQuery ? "&" : "?"}session_id=${encodeURIComponent(sid)}`;
  };

  app.post("/api/internal/terminal/end-session", expressJsonFallback, async (req, res) => {
    const requestedId = String(req.body?.session_id || "").trim();
    if (!requestedId) {
      return res.status(400).json({
        success: false,
        message: "session_id is required",
      });
    }

    const active = sessions.get(requestedId);
    if (!active) {
      return res.status(200).json({
        success: true,
        message: "Session not active",
      });
    }

    await submitAndPersist(active, "explicit_end");
    try {
      active.clientWs.close(1000, "session ended");
    } catch {}
    try {
      active.sandboxWs.close(1000, "session ended");
    } catch {}

    return res.status(200).json({
      success: true,
      message: "Session ended",
      session_id: requestedId,
    });
  });

  const handleUpgrade = (req, socket, head) => {
    if (!req.url || !req.url.startsWith("/terminal")) return false;

    const hostHeader = req.headers.host || "localhost";
    const parsedUrl = new URL(req.url, `http://${hostHeader}`);
    const requestedSessionId = String(parsedUrl.searchParams.get("session_id") || "").trim();
    const requestedUserId =
      String(req.headers["x-user-id"] || parsedUrl.searchParams.get("user_id") || "").trim() ||
      "anonymous";

    const clientWss = new WebSocket.Server({ noServer: true });
    clientWss.handleUpgrade(req, socket, head, (clientWs) => {
      if (requestedSessionId) {
        const existing = sessions.get(requestedSessionId);
        if (existing) {
          try {
            existing.clientWs.close(1000, "replaced by reconnect");
          } catch {}
          try {
            existing.sandboxWs.close(1000, "replaced by reconnect");
          } catch {}
        }
      }

      const provisionalId = requestedSessionId || uuidv4();
      const sandboxWs = new WebSocket(buildSandboxWsUrl(requestedSessionId));
      const session = {
        sessionId: provisionalId,
        requestedSessionId,
        userId: requestedUserId,
        startedAt: new Date(),
        lastActivityAt: new Date(),
        transcript: [],
        commandHistory: [],
        submitting: false,
        submitted: false,
        clientWs,
        sandboxWs,
        idleTimer: null,
      };
      sessions.set(provisionalId, session);
      setIdleTimer(session);

      sandboxWs.on("open", () => {
        if (requestedSessionId) {
          observability("session_attached", {
            session_id: requestedSessionId,
            user_id: requestedUserId,
          });
        }
      });

      sandboxWs.on("message", (raw) => {
        session.lastActivityAt = new Date();
        setIdleTimer(session);
        const text = typeof raw === "string" ? raw : raw.toString("utf8");
        let payload = null;
        try {
          payload = JSON.parse(text);
        } catch {
          payload = { type: "output", data: text };
        }

        if (payload?.type === "session" && typeof payload?.session_id === "string") {
          const assigned = payload.session_id.trim();
          if (assigned && assigned !== session.sessionId) {
            sessions.delete(session.sessionId);
            session.sessionId = assigned;
            sessions.set(assigned, session);
          }
          if (!requestedSessionId) {
            observability("session_created", {
              session_id: session.sessionId,
              user_id: requestedUserId,
            });
          }
        }

        if (payload?.type === "output" && typeof payload?.data === "string") {
          session.transcript.push(payload.data);
        }

        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(JSON.stringify(payload));
        }
      });

      sandboxWs.on("error", () => {
        safeClientError(clientWs, "Terminal backend unavailable");
      });

      sandboxWs.on("close", () => {
        submitAndPersist(session, "sandbox_close").finally(() => {
          try {
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.close(1011, "terminal closed");
            }
          } catch {}
        });
      });

      clientWs.on("message", (raw) => {
        session.lastActivityAt = new Date();
        setIdleTimer(session);
        const text = typeof raw === "string" ? raw : raw.toString("utf8");
        let payload = null;
        try {
          payload = JSON.parse(text);
        } catch {
          payload = null;
        }
        if (!payload || typeof payload !== "object") return;
        if (payload.type === "input" && typeof payload.data === "string") {
          session.commandHistory.push({
            command: payload.data,
            at: new Date().toISOString(),
          });
        }
        if (sandboxWs.readyState === WebSocket.OPEN) {
          sandboxWs.send(JSON.stringify(payload));
        }
      });

      clientWs.on("close", () => {
        submitAndPersist(session, "disconnect").finally(() => {
          try {
            if (sandboxWs.readyState === WebSocket.OPEN) {
              sandboxWs.close(1000, "client disconnected");
            }
          } catch {}
        });
      });

      clientWs.on("error", () => {
        submitAndPersist(session, "disconnect").finally(() => {
          try {
            sandboxWs.close(1000, "client error");
          } catch {}
        });
      });
    });

    return true;
  };

  const shutdown = async () => {
    const running = Array.from(sessions.values());
    for (const session of running) {
      await submitAndPersist(session, "backend_shutdown");
    }
  };

  server.on("close", () => {
    shutdown().catch(() => {});
  });

  return { handleUpgrade };
}

function expressJsonFallback(req, _res, next) {
  if (req.body && typeof req.body === "object") return next();
  let raw = "";
  req.on("data", (chunk) => {
    raw += chunk;
  });
  req.on("end", () => {
    try {
      req.body = raw ? JSON.parse(raw) : {};
    } catch {
      req.body = {};
    }
    next();
  });
}

module.exports = {
  createTerminalProxy,
};
