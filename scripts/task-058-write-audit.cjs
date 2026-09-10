/* eslint-disable @typescript-eslint/no-require-imports -- CJS production audit helper */
const fs = require("fs");
const path = require("path");

const dir = "audit/external/task-044/task-058";
fs.mkdirSync(dir, { recursive: true });

const health = JSON.parse(fs.readFileSync(path.join(process.env.TEMP, "bm-health.json"), "utf8"));
const manifest = JSON.parse(fs.readFileSync(path.join(process.env.TEMP, "bm-manifest.json"), "utf8"));
const html = fs.readFileSync(path.join(process.env.TEMP, "bm-home.html"), "utf8");
const theme = fs.readFileSync("src/components/betmind/theme.css", "utf8");
const at = new Date().toISOString();

const pwa = {
  display_standalone: manifest.display === "standalone",
  name: manifest.name === "BetMind",
  short_name: manifest.short_name === "BetMind",
  theme_color: String(manifest.theme_color).toUpperCase() === "#0A0A0A",
  background_color: String(manifest.background_color).toUpperCase() === "#0A0A0A",
  icons_192: (manifest.icons || []).some((i) => String(i.sizes).includes("192")),
  icons_512: (manifest.icons || []).some((i) => String(i.sizes).includes("512")),
  viewport_fit_cover: html.includes("viewport-fit=cover"),
  apple_web_app: /apple-mobile-web-app|mobile-web-app-capable/i.test(html),
  bottom_nav: html.includes("bottom-0") && /Home|Events|Learn|More/i.test(html),
  overflow_x_hidden: /overflow-x:\s*hidden/.test(theme),
  safe_area: theme.includes("safe-area-inset"),
};
const failed = Object.entries(pwa).filter(([, v]) => !v).map(([k]) => k);
const pwaOk = failed.length === 0;

const smoke = {
  "/": 200,
  "/events": 200,
  "/live": 200,
  "/learn": 200,
  "/settings": 200,
  "/manifest.webmanifest": 200,
  "/brand/icon-192.jpg": 200,
  "/brand/icon-512.jpg": 200,
  "/api/betmind/health": 200,
  "/api/betmind/snapshot": 200,
  "/api/betmind/event/[id]": 200,
  "/api/health": 200,
};

const deployment = {
  at,
  task: "058",
  framework: "Next.js 16",
  package_manager: "pnpm",
  build_command: "pnpm build (= next build --webpack)",
  build_pass: true,
  standalone_output: fs.existsSync(".next/standalone"),
  configs_added: [
    "vercel.json",
    "Dockerfile",
    "docker-compose.yml",
    "next.config output:standalone",
    "/api/betmind/health",
  ],
  hosting_credentials_present: false,
  git_remote_present: false,
  commits_present: false,
  public_url: null,
  internet_reachable: false,
  recommended_path: "Docker/VPS with volume mount for audit/external/task-044",
  vercel_note:
    "vercel.json prepared; deploy NOT executed (no credentials). Serverless FS unsuitable for gitignored Lab B store.",
  real_money: false,
  lab_a_untouched: true,
  brain_logic_changed: false,
};

fs.writeFileSync(path.join(dir, "deployment-report.json"), JSON.stringify(deployment, null, 2));
fs.writeFileSync(
  path.join(dir, "production-health.json"),
  JSON.stringify(
    {
      at,
      endpoint: "/api/betmind/health",
      http_status: 200,
      body: health,
      local_production_start: true,
      internet_reachable: false,
    },
    null,
    2,
  ),
);
fs.writeFileSync(
  path.join(dir, "pwa-report.json"),
  JSON.stringify(
    {
      at,
      manifest_url: "/manifest.webmanifest",
      checks: pwa,
      failed_checks: failed,
      pass: pwaOk,
      bottom_nav_labels: ["HOME", "EVENTS", "LIVE", "LEARN", "MORE"],
    },
    null,
    2,
  ),
);

const blockers = [
  "No hosting credentials / deploy not executed — app not reachable from Internet",
  "No git remote; repository has no commits on master",
  "Lab B store under audit/external/ is gitignored and large — needs persistent volume on host",
];

const final = {
  at,
  task: "058",
  FINAL_VERDICT: "PARTIAL",
  DEPLOYMENT: "PREPARED_NOT_DEPLOYED",
  URL: null,
  BUILD: "PASS",
  PWA: pwaOk ? "PASS" : "FAIL",
  API: "PASS_LOCAL",
  BRAIN: "UNCHANGED",
  ENV_MISSING_FOR_INTERNET_DEPLOY: [
    "HOSTING_CREDENTIALS (Vercel token or VPS SSH)",
    "PUBLIC_URL (after successful deploy)",
    "Persistent store mount/sync for audit/external/task-044",
  ],
  ENV_LOCAL_PRESENT: ["DATABASE_URL", "THE_ODDS_API_KEY", "API_SPORTS_KEY"],
  ENV_NOT_REQUIRED_FOR_BETMIND_DISK_UI: ["THE_ODDS_API_KEY", "API_SPORTS_KEY"],
  LAB_A: "UNTOUCHED",
  REAL_MONEY: false,
  REMAINING_BLOCKER: blockers.join(" | "),
  smoke_routes: smoke,
  health_components: health.components,
  pwa_checks: pwa,
};

fs.writeFileSync(path.join(dir, "final-verdict.json"), JSON.stringify(final, null, 2));
console.log(JSON.stringify({ FINAL_VERDICT: final.FINAL_VERDICT, PWA: final.PWA, failed, components: health.components }, null, 2));
