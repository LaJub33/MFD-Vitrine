/**
 * Lambda — Commit index.html vers GitHub
 *
 * Variables d'environnement requises :
 *   GITHUB_TOKEN   : Personal Access Token (scope: repo)
 *   GITHUB_OWNER   : ex. "monorg"
 *   GITHUB_REPO    : ex. "mon-site"
 *   GITHUB_BRANCH  : ex. "main"
 *   GITHUB_FILE    : ex. "index.html"
 *   ADMIN_API_KEY  : clé secrète que l'admin doit envoyer dans le header X-Api-Key
 */

const {
  GITHUB_TOKEN,
  GITHUB_OWNER,
  GITHUB_REPO,
  GITHUB_BRANCH = "main",
  GITHUB_FILE   = "index.html",
  ADMIN_API_KEY,
} = process.env;

const GH_API = "https://api.github.com";

const headers = {
  Authorization: `Bearer ${GITHUB_TOKEN}`,
  Accept:        "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "Content-Type": "application/json",
  "User-Agent":   "mfd-admin-lambda",
};

// ── Réponse CORS helper ──────────────────────────────────────────────────────
function response(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin":  "*",
      "Access-Control-Allow-Headers": "Content-Type,X-Api-Key",
      "Access-Control-Allow-Methods": "POST,OPTIONS",
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  };
}

// ── Handler principal ────────────────────────────────────────────────────────
export const handler = async (event) => {

  // Preflight CORS
  if (event.httpMethod === "OPTIONS") {
    return response(200, {});
  }

  // Authentification par API key
  const apiKey = event.headers?.["x-api-key"] || event.headers?.["X-Api-Key"];
  if (!apiKey || apiKey !== ADMIN_API_KEY) {
    return response(401, { error: "Unauthorized" });
  }

  // Parse du body
  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return response(400, { error: "Invalid JSON body" });
  }

  const { html, commitMessage } = body;

  if (!html || typeof html !== "string") {
    return response(400, { error: "Missing 'html' field in body" });
  }

  // ── Étape 1 : récupérer le SHA actuel du fichier (nécessaire pour l'update) ─
  let currentSha = null;
  try {
    const getRes = await fetch(
      `${GH_API}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_FILE}?ref=${GITHUB_BRANCH}`,
      { headers }
    );
    if (getRes.ok) {
      const data = await getRes.json();
      currentSha = data.sha;
    } else if (getRes.status !== 404) {
      const err = await getRes.json();
      return response(502, { error: "GitHub GET failed", detail: err });
    }
  } catch (e) {
    return response(502, { error: "GitHub GET error", detail: e.message });
  }

  // ── Étape 2 : encoder le HTML en base64 ─────────────────────────────────────
  const contentB64 = Buffer.from(html, "utf-8").toString("base64");

  // ── Étape 3 : créer ou mettre à jour le fichier via l'API GitHub ─────────────
  const putPayload = {
    message: commitMessage || `chore: mise à jour index.html via admin [${new Date().toISOString()}]`,
    content: contentB64,
    branch:  GITHUB_BRANCH,
    ...(currentSha ? { sha: currentSha } : {}),
  };

  let putRes, putData;
  try {
    putRes  = await fetch(
      `${GH_API}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_FILE}`,
      { method: "PUT", headers, body: JSON.stringify(putPayload) }
    );
    putData = await putRes.json();
  } catch (e) {
    return response(502, { error: "GitHub PUT error", detail: e.message });
  }

  if (!putRes.ok) {
    return response(502, { error: "GitHub PUT failed", detail: putData });
  }

  // ── Succès ───────────────────────────────────────────────────────────────────
  return response(200, {
    success: true,
    commit:  putData.commit?.sha,
    url:     putData.commit?.html_url,
    message: `index.html mis à jour sur ${GITHUB_BRANCH}. Amplify va redéployer automatiquement.`,
  });
};
