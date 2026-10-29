#!/usr/bin/env bash
# TIER 2 — the product a bootstrap produces builds, migrates, deploys (dry)
# and serves.
#
# placement.test.sh proves the tree a bootstrap ends with is the right tree.
# This proves it WORKS, by doing to it what its own pipelines will:
#
#   1. at the 01-product landing (the commit its one pull request merges),
#      install with the lockfile the product ships, render the wrangler
#      fixture and check the committed config IS that render, typecheck,
#      lint, test, build. The landing's own PR runs `plan` alone (an
#      `orun/BASE-*` branch), so THIS is where a product those steps refuse
#      is caught: before the tag, not after a build has merged it;
#   2. the stage lanes' own steps, rendered by `orun plan` in the product and
#      run IN THE TREE THE RUNNER STAGES for each job (testing/lib/stage-job.py),
#      with the dependency layout the pinned composition produces and with the
#      job's secrets in its environment as the platform resolves them (the
#      component's secretEnv):
#      - web, from a pull request's plan (the verify profile: the deploy
#        profile has no dry run) — `verify-app-structure` (which checks the
#        wrangler config exists BEFORE anything is built), `build-app` (the
#        component's buildCommand: the live wiring render, then the build,
#        with OAuth keys and an auth secret PLANTED in its environment, none
#        of which may reach the bundle), `verify-build-output` and
#        `deploy-dry-run` (`wrangler deploy --dry-run --name
#        <reponame>-web-stage`): the database id, the namespace and the
#        bucket in the built config asserted to be the stage documents', not
#        the fixture's, and the Worker within Workers Free's 3 MiB;
#      - db-migrate: its install and build, the pull request's `plan` (offline,
#        every checksum verified), then the merge's `apply` — the step a push
#        to main runs — against a stand-in for D1's REST API over real SQLite
#        (testing/lib/d1-api.py), which refuses any account, database or token
#        but the ones the job resolves: better-auth's tables and the generated
#        auth secret created and every migration recorded; then the apply
#        again, which applies nothing;
#   3. serve the built Worker with `wrangler dev` (local D1, KV and R2 behind
#      the same bindings): with no schema the health route says so and the
#      component's OWN `smokeCommand` REFUSES it; after the product's own
#      `db:migrate:local` the smoke passes, verbatim — the check the real
#      deploy ends with. Then everything a visitor does with no provider
#      connected (a fresh product), driven by testing/lib/auth-flows.py: the
#      sign-in page carries the product's name, links its repository and
#      says how to add a provider; email sign-up writes the user to D1 and
#      the session to KV, and a foreign Origin is refused; the redirects
#      between / and /dashboard; the dashboard; a file uploaded to R2,
#      listed, downloaded byte for byte, refused to another user while
#      private, and deleted; sign-out, a wrong password, sign-in again;
#      anonymous sign-in; the OpenAPI reference; better-auth's rate limit
#      (kept in D1). And then CONNECTED: GitHub's keys handed to the Worker
#      the way the deploy hands them (tooling/wire/worker-secrets.mjs, here
#      as .dev.vars) — the page offers GitHub, and sign-in starts the OAuth
#      flow with this deployment's own callback URL.
#
# What it cannot do is the platform's half: create the repository, mint the
# brokered Cloudflare tokens, apply the database, the namespace and the
# bucket, migrate and deploy for real, and probe workers.dev — nor a real
# GitHub consent screen. The D1, KV and R2 roots are verified to
# `terraform validate` and their plans are part of every pull request's
# lanes; the applies need an account.
#
# Needs: orun, node, pnpm, python3 (+PyYAML), git, curl, and the network for
# `pnpm install` (or a warm store) and the build's Google Fonts. A few
# minutes: three installs and two builds.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/.." && pwd)"
# shellcheck source=lib/bootstrap.sh
source "$here/lib/bootstrap.sh"

for bin in orun node pnpm python3 git curl; do
  command -v "$bin" >/dev/null || { echo "e2e.test.sh needs $bin on PATH" >&2; exit 1; }
done

scratch="$(mktemp -d)"
dev_pid=""
api_pid=""
# wrangler dev runs under pnpm, node and two workerd processes; a TERM to the
# first does not reach the rest, and waiting on it then never returns. So it is
# started as its own process group (setsid) and the whole group is stopped.
stop_group() {
  kill -TERM -- "-$1" 2>/dev/null || true
  for _ in 1 2 3 4 5 6 7 8 9 10; do kill -0 -- "-$1" 2>/dev/null || break; sleep 0.5; done
  kill -KILL -- "-$1" 2>/dev/null || true
}
cleanup() {
  [ -z "$dev_pid" ] || stop_group "$dev_pid"
  [ -z "$api_pid" ] || stop_group "$api_pid"
  rm -rf "$scratch"
}
trap cleanup EXIT
values="$here/fixtures/acme.json"
repo="$(python3 -c "import json,sys;print(json.load(open(sys.argv[1]))['reponame'])" "$values")"
export CI=1 WRANGLER_SEND_METRICS=false NEXT_TELEMETRY_DISABLED=1 TURBO_TELEMETRY_DISABLED=1

# The landing's own checks, step for step: what a pull request in the product
# verifies through its lanes, run here at once on the whole tree.
LANDING_CHECKS=(
  "pnpm install --frozen-lockfile"
  "pnpm run wire:fixture"
  "git diff --exit-code"
  "pnpm typecheck"
  "pnpm lint"
  "pnpm test"
  "pnpm build"
)
checks() { # DIR LOG
  local dir="$1" log="$2" cmd
  for cmd in "${LANDING_CHECKS[@]}"; do
    echo "   \$ $cmd" | tee -a "$log"
    if ! (cd "$dir" && bash -c "$cmd") >> "$log" 2>&1; then
      echo "FAIL: \`$cmd\` failed in $dir" >&2; tail -40 "$log" >&2; return 1
    fi
  done
}

# A job's steps out of a plan, by component and environment: each step's
# script (named by its id, or by a fixed name for the composition steps this
# file runs), the job's path, its env and the names of its secrets.
extract() { # PLAN COMPONENT ENV OUTDIR
  python3 - "$@" <<'PY'
import json, pathlib, re, sys
plan, comp, env, out = json.load(open(sys.argv[1])), sys.argv[2], sys.argv[3], pathlib.Path(sys.argv[4])
out.mkdir(parents=True, exist_ok=True)
job = next(j for j in plan["jobs"] if j["component"] == comp and j["environment"] == env)
for s in job["steps"]:
    run = s.get("run") or ""
    if not run:
        continue
    sid = s["id"]
    if "dist/runner/cli.js apply" in run:
        sid = "migrate-apply"
    elif "dist/runner/cli.js plan" in run:
        sid = "migrate-plan"
    (out / f"{re.sub(r'[^A-Za-z0-9_-]', '_', sid)}.sh").write_text(run)
    if s["id"] in ("install-workspace-dependencies", "install-dependencies"):
        (out / "install.sh").write_text(run)
        (out / "install.wd").write_text(s.get("working-directory") or ".")
        (out / "install.scope").write_text(s.get("scope") or "job")
(out / "path").write_text(job.get("path") or ".")
(out / "env").write_text("".join(f"export {k}={json.dumps(v)}\n" for k, v in (job.get("env") or {}).items()))
(out / "secrets").write_text("\n".join(r["asEnv"] for r in job.get("secretRefs") or []))
PY
}

# A job's private tree, staged as orun stages it. The source checkout carries
# no build output (nothing was built in it), and its dependencies are what the
# pinned composition says: a lane-scoped install ran once in the source tree
# and is linked in, or the job installs its own.
stage_job() { # STEPS-DIR WORK-DIR LOG
  local steps="$1" work="$2" log="$3"
  [ -f "$steps/install.sh" ] || { echo "FAIL: the lane has no install step" >&2; return 1; }
  if [ "$(cat "$steps/install.scope")" = lane ]; then
    (cd "$tree" && bash -e "$steps/install.sh") > "$log" 2>&1 \
      || { echo "FAIL: the lane's install step" >&2; tail -30 "$log" >&2; return 1; }
    python3 "$here/lib/stage-job.py" "$tree" "$work" --shared-deps
    [ -L "$work/node_modules" ] || { echo "FAIL: the staged tree's node_modules is not the lane's symlink" >&2; return 1; }
    echo "   staged: $(realpath --relative-to="$tree" "$work"); install scope: lane — node_modules → the source tree's"
  else
    python3 "$here/lib/stage-job.py" "$tree" "$work"
    echo "   staged: $(realpath --relative-to="$tree" "$work"); install scope: job — installing inside it"
    (cd "$work/$(cat "$steps/path")/$(cat "$steps/install.wd")" && bash -e "$steps/install.sh") > "$log" 2>&1 \
      || { echo "FAIL: the lane's install step" >&2; tail -30 "$log" >&2; return 1; }
    [ -d "$work/node_modules" ] && [ ! -L "$work/node_modules" ] \
      || { echo "FAIL: the job's install did not land inside its own tree" >&2; return 1; }
  fi
}

# One step, in the runner's per-job environment: the job's env (intent
# environment `env:`), its resolved secrets (exported by the caller) and
# ORUN_ENVIRONMENT; the step runs in the component's directory.
run_step() { # STEPS-DIR WORK-DIR STEP LOG
  local steps="$1" work="$2" step="$3" log="$4"
  [ -f "$steps/$step.sh" ] || { echo "FAIL: the stage lane has no $step step" >&2; return 1; }
  echo "   ▸ $step"
  if ! (cd "$work/$(cat "$steps/path")" && source "$steps/env" && export ORUN_ENVIRONMENT=stage \
        && bash -e "$steps/$step.sh") > "$log" 2>&1; then
    echo "FAIL: the lane's $step step" >&2; tail -40 "$log" >&2; return 1
  fi
}

echo "── the offline bootstrap (testing/lib/bootstrap.sh)"
tree="$scratch/$repo"
bootstrap_offline "$root" "$tree" "$values" "$scratch/logs" > "$scratch/bootstrap.log" 2>&1 || {
  echo "FAIL: the offline bootstrap stopped" >&2; tail -40 "$scratch/bootstrap.log" >&2; exit 1; }
echo "   2 phases placed and landed"
s01="$(git -C "$tree" rev-parse HEAD~1)"

# ── 1. the product's one pull request ──────────────────────────────────────
echo "── 01-product's landing: install, the fixture render, typecheck, lint, test, build"
git -C "$tree" worktree add -q "$scratch/at-01" "$s01"
checks "$scratch/at-01" "$scratch/checks-01.log"
# The landing's build is done; its tree is not needed again, and the disk is shared.
git -C "$tree" worktree remove --force "$scratch/at-01"


# ── 2. the stage lanes' steps, in each job's own tree ─────────────────────
# A pull request that changes the site and the migration component: the lanes
# `orun plan` gives it. And the merge's plan, for the step only a merge runs.
git -C "$tree" checkout -q -b e2e-pr
echo "// a change to the site's component" >> "$tree/apps/web/src/app/page.tsx"
echo "# a change to the migration component" >> "$tree/infra/db-migrate/component.yaml"
git -C "$tree" -c user.email=e2e@example.invalid -c user.name=e2e commit -qam "a pull request"
(cd "$tree" && orun plan --intent intent.yaml --trigger github-pull-request --changed \
   --base main --head HEAD --env stage --output "$scratch/plan.json") > "$scratch/plan.log" 2>&1 \
  || { echo "FAIL: orun plan (pull request)" >&2; tail -15 "$scratch/plan.log" >&2; exit 1; }
(cd "$tree" && orun plan --intent intent.yaml --trigger github-push-main --env stage \
   --output "$scratch/plan-main.json") > "$scratch/plan-main.log" 2>&1 \
  || { echo "FAIL: orun plan (push to main)" >&2; tail -15 "$scratch/plan-main.log" >&2; exit 1; }
extract "$scratch/plan.json" web stage "$scratch/web"
extract "$scratch/plan.json" db-migrate stage "$scratch/mig"
extract "$scratch/plan-main.json" db-migrate stage "$scratch/mig-main"

# What the platform resolves into the jobs before their first step: the
# wiring documents the D1, KV and R2 roots lease-published (the components'
# secretEnv), with a database id, a namespace id and a bucket name no fixture
# carries, so the built config and the migrated database prove which
# documents they came from.
d1_id="5ca1ab1e-0000-4000-8000-00000000a001"
kv_id="5ca1ab1e00004000800000000000a001"
bucket="e2e-$repo-stage-bucket"
export WIRING_CLOUDFLARE_D1_STAGE='{"d1_database_id":"'"$d1_id"'","d1_database_name":"stg-'"$repo"'-stage"}'
export WIRING_CLOUDFLARE_D1_PROD='{"d1_database_id":"5ca1ab1e-0000-4000-8000-00000000a003","d1_database_name":"prod-'"$repo"'-prod"}'
export WIRING_CLOUDFLARE_KV_STAGE='{"app_kv_id":"'"$kv_id"'","app_kv_title":"'"$repo"'-app-kv-stage"}'
export WIRING_CLOUDFLARE_KV_PROD='{"app_kv_id":"5ca1ab1e00004000800000000000a003","app_kv_title":"'"$repo"'-app-kv-prod"}'
export WIRING_CLOUDFLARE_R2_STAGE='{"r2_bucket_name":"'"$bucket"'"}'
export WIRING_CLOUDFLARE_R2_PROD='{"r2_bucket_name":"prod-'"$repo"'-prod"}'

echo "── the stage web lane: verify-app-structure, build-app, verify-build-output, deploy-dry-run"
for key in WIRING_CLOUDFLARE_D1_STAGE WIRING_CLOUDFLARE_D1_PROD WIRING_CLOUDFLARE_KV_STAGE WIRING_CLOUDFLARE_KV_PROD \
           WIRING_CLOUDFLARE_R2_STAGE WIRING_CLOUDFLARE_R2_PROD; do
  grep -qx "$key" "$scratch/web/secrets" || { echo "FAIL: the stage web lane does not resolve $key" >&2; exit 1; }
done
work="$tree/.orun/runs/e2e/web.stage.verify-deploy/work"
stage_job "$scratch/web" "$work" "$scratch/install-web.log"
[ ! -e "$work/apps/web/.open-next" ] || { echo "FAIL: the staged tree carries build output" >&2; exit 1; }
# The optional secrets a deploy lane resolves, PLANTED in the job's
# environment: the build must keep every one of them out of the bundle (they
# reach the Worker as Worker secrets, never as code). A verify lane holds no
# Cloudflare credential, so the secrets push says so and sends nothing.
planted="e2e-planted-$(python3 -c 'import secrets;print(secrets.token_hex(8))')"
for step in verify-app-structure build-app verify-build-output deploy-dry-run; do
  (export GITHUB_CLIENT_ID="$planted-gh-id" GITHUB_CLIENT_SECRET="$planted-gh-secret" \
          GOOGLE_CLIENT_ID="$planted-g-id" GOOGLE_CLIENT_SECRET="$planted-g-secret" BETTER_AUTH_SECRET="$planted-auth" \
   && run_step "$scratch/web" "$work" "$step" "$scratch/$step.log") || exit 1
done
if grep -rqF "$planted" "$work/apps/web/.open-next" "$work/apps/web/.next" 2>/dev/null; then
  echo "FAIL: a secret planted in the build's environment reached the bundle" >&2; exit 1
fi
grep -q "no Cloudflare credential in this job" "$scratch/build-app.log" \
  || { echo "FAIL: the verify lane's build did not leave the Worker secrets to the deploy lane" >&2; tail -10 "$scratch/build-app.log" >&2; exit 1; }
for want in "\"$d1_id\"" "\"$kv_id\"" "\"$bucket\""; do
  grep -q "$want" "$work/apps/web/wrangler.jsonc" \
    || { echo "FAIL: the lane's build did not render $want from its wiring document" >&2; exit 1; }
done
# wrangler's dry run names a D1 binding's database by name, not id.
grep -Eq "env\.DATABASE \(stg-$repo-stage\) +D1 Database" "$scratch/deploy-dry-run.log" \
  || { echo "FAIL: the dry run does not bind DATABASE to the stage database" >&2; tail -20 "$scratch/deploy-dry-run.log" >&2; exit 1; }
grep -Eq "env\.KV \($kv_id\) +KV Namespace" "$scratch/deploy-dry-run.log" \
  || { echo "FAIL: the dry run does not bind KV to the stage namespace" >&2; tail -20 "$scratch/deploy-dry-run.log" >&2; exit 1; }
grep -Eq "env\.R2_BUCKET \($bucket\) +R2 Bucket" "$scratch/deploy-dry-run.log" \
  || { echo "FAIL: the dry run does not bind R2_BUCKET to the stage bucket" >&2; tail -20 "$scratch/deploy-dry-run.log" >&2; exit 1; }
gz="$(sed -n 's/.*Total Upload: .* \/ gzip: \([0-9.]*\) KiB.*/\1/p' "$scratch/deploy-dry-run.log" | head -1)"
python3 -c "import sys; sys.exit(0 if float(sys.argv[1]) < 3072 else 1)" "${gz:-99999}" \
  || { echo "FAIL: the Worker is ${gz:-?} KiB gzipped, over Workers Free's 3 MiB" >&2; exit 1; }
echo "   the built config binds DATABASE, KV and R2_BUCKET to the stage documents' database ($d1_id),"
echo "   namespace ($kv_id) and bucket ($bucket); no planted secret in the bundle; $gz KiB gzipped"

echo "── the stage db-migrate lane: install, build, the PR's plan, the merge's apply (a stand-in D1 API)"
for key in CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID WIRING_CLOUDFLARE_D1; do
  grep -qx "$key" "$scratch/mig-main/secrets" || { echo "FAIL: the stage db-migrate lane does not resolve $key" >&2; exit 1; }
done
[ -f "$scratch/mig/migrate-plan.sh" ] && [ ! -f "$scratch/mig/migrate-apply.sh" ] \
  || { echo "FAIL: a pull request's db-migrate lane must plan and not apply" >&2; ls "$scratch/mig" >&2; exit 1; }
[ -f "$scratch/mig-main/migrate-apply.sh" ] && [ ! -f "$scratch/mig-main/migrate-plan.sh" ] \
  || { echo "FAIL: the merge's db-migrate lane must apply" >&2; ls "$scratch/mig-main" >&2; exit 1; }
mwork="$tree/.orun/runs/e2e/db-migrate.stage.migrate/work"
stage_job "$scratch/mig" "$mwork" "$scratch/install-mig.log"
run_step "$scratch/mig" "$mwork" build-db-package "$scratch/mig-build.log"
run_step "$scratch/mig" "$mwork" migrate-plan "$scratch/mig-plan.log"
for id in 010_auth 020_app_secrets; do
  grep -q "\"$id\"" "$scratch/mig-plan.log" \
    || { echo "FAIL: the plan does not list $id as pending" >&2; cat "$scratch/mig-plan.log" >&2; exit 1; }
done
# The stand-in D1 API: only this account, this database (the stage
# document's id) and this token are answered.
(exec setsid python3 "$here/lib/d1-api.py" "$scratch/d1.sqlite" "$scratch/d1.port" \
   --account e2e-account --database "$d1_id" --token e2e-d1-token) > "$scratch/d1-api.log" 2>&1 < /dev/null &
api_pid=$!
for _ in $(seq 1 50); do [ -s "$scratch/d1.port" ] && break; sleep 0.1; done
[ -s "$scratch/d1.port" ] || { echo "FAIL: the stand-in D1 API did not start" >&2; cat "$scratch/d1-api.log" >&2; exit 1; }
export CLOUDFLARE_API_BASE_URL="http://127.0.0.1:$(cat "$scratch/d1.port")/client/v4"
# The job's own secrets: the D1 token as CLOUDFLARE_API_TOKEN, the account id,
# and this environment's wiring document.
for pass in first again; do
  (export CLOUDFLARE_API_TOKEN=e2e-d1-token CLOUDFLARE_ACCOUNT_ID=e2e-account \
          WIRING_CLOUDFLARE_D1="$WIRING_CLOUDFLARE_D1_STAGE" \
   && run_step "$scratch/mig-main" "$mwork" migrate-apply "$scratch/mig-apply-$pass.log") || exit 1
done
python3 - "$scratch/d1.sqlite" "$scratch/mig-apply-first.log" "$scratch/mig-apply-again.log" <<'PY'
import json, re, sqlite3, sys
db = sqlite3.connect(sys.argv[1])
def result(path):
    text = open(path).read()
    return json.loads(text[text.index("{"):text.rindex("}") + 1])
first, again = result(sys.argv[2]), result(sys.argv[3])
problems = []
ALL = ["000_control_baseline", "010_auth", "020_app_secrets"]
if first["applied"] != ALL:
    problems.append(f"the first apply applied {first['applied']}")
if again["applied"] or again["skipped"] != ALL:
    problems.append(f"the second apply applied {again['applied']} and skipped {again['skipped']} — it must apply nothing")
tables = {r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type = 'table'")}
want = {"users", "sessions", "accounts", "verifications", "user_files", "rate_limits", "app_secrets"}
if not want <= tables:
    problems.append(f"the database holds the tables {sorted(tables)}, missing {sorted(want - tables)}")
if db.execute("SELECT count(*) FROM users").fetchone()[0] != 0:
    problems.append("a fresh database holds users")
secret = db.execute("SELECT value FROM app_secrets WHERE name = 'auth'").fetchone()
if not secret or not re.fullmatch(r"[0-9a-f]{64}", secret[0]):
    problems.append(f"the generated auth secret is {secret}")
ledger = [r[0] for r in db.execute("SELECT id FROM _migrations_applied ORDER BY id")]
if ledger != ALL:
    problems.append(f"the ledger records {ledger}")
for p in problems:
    print(f"  ✕ {p}", file=sys.stderr)
sys.exit(1 if problems else 0)
PY
grep -q 'POST /client/v4/accounts/e2e-account/d1/database/'"$d1_id"'/query' "$scratch/d1-api.log" \
  || { echo "FAIL: the runner did not call the stage database's query endpoint" >&2; exit 1; }
echo "   the stage document's database: better-auth's tables and a generated auth secret, every migration"
echo "   recorded; the second apply applied nothing"
stop_group "$api_pid"; api_pid=""
unset CLOUDFLARE_API_BASE_URL

# ── 3. serve it, and smoke it as the deploy does ───────────────────────────
port=$(python3 -c "import socket;s=socket.socket();s.bind(('127.0.0.1',0));print(s.getsockname()[1]);s.close()")
url="http://127.0.0.1:$port"
start_dev() { # LOG
  (cd "$work/apps/web" && exec setsid pnpm exec wrangler dev --config wrangler.jsonc --ip 127.0.0.1 --port "$port" \
     --name "$repo-web-stage" --show-interactive-dev-session=false) > "$scratch/$1.log" 2>&1 < /dev/null &
  dev_pid=$!
  for _ in $(seq 1 90); do
    curl -s -o /dev/null "$url/favicon.ico" && break
    kill -0 "$dev_pid" 2>/dev/null || { echo "FAIL: wrangler dev exited" >&2; tail -30 "$scratch/$1.log" >&2; exit 1; }
    sleep 1
  done
  curl -s -o /dev/null "$url/favicon.ico" || { echo "FAIL: wrangler dev never answered" >&2; tail -30 "$scratch/$1.log" >&2; exit 1; }
}
local_d1() { # SQL → its rows as JSON, from the local D1 wrangler dev serves
  (cd "$work/apps/web" && pnpm exec wrangler d1 execute DATABASE --local --config wrangler.jsonc --json --command "$1" 2>/dev/null) \
    | python3 -c "import json,sys; print(json.dumps(json.load(sys.stdin)[0]['results']))"
}
echo "── wrangler dev over the built Worker (local D1, KV and R2 behind DATABASE, KV and R2_BUCKET), no provider connected"
start_dev dev
smoke="$(python3 -c "import yaml,sys;print(yaml.safe_load(open(sys.argv[1]))['spec']['parameters']['smokeCommand'])" "$tree/apps/web/component.yaml")"

echo "   ▸ no schema yet: the health route names the fix, and the deploy's smoke refuses it"
code="$(curl -s -o "$scratch/health-0.json" -w '%{http_code}' "$url/api/health")"
[ "$code" = 503 ] && grep -q 'no such table' "$scratch/health-0.json" \
  || { echo "FAIL: /api/health answered $code ($(cat "$scratch/health-0.json")) without the schema, not 503 naming it" >&2; exit 1; }
if DEPLOYED_URL="$url" bash -c "$smoke"; then
  echo "FAIL: the deploy's smoke passed a Worker whose database has no schema" >&2; exit 1
fi

echo "   ▸ the product's own db:migrate:local, then the component's own smokeCommand, DEPLOYED_URL=$url"
(cd "$work/apps/web" && pnpm run db:migrate:local) > "$scratch/migrate-local.log" 2>&1 \
  || { echo "FAIL: db:migrate:local" >&2; tail -20 "$scratch/migrate-local.log" >&2; exit 1; }
DEPLOYED_URL="$url" bash -c "$smoke" || { echo "FAIL: the deploy's smoke refused the migrated site" >&2; exit 1; }

echo "   ▸ everything a visitor does, with no provider connected"
python3 "$here/lib/auth-flows.py" "$url" "$values" unconnected || exit 1
users="$(local_d1 "SELECT email, is_anonymous FROM users ORDER BY created_at")"
python3 - "$users" <<'PY' || exit 1
import json, sys
rows = json.loads(sys.argv[1])
emails = [r["email"] for r in rows]
if "ada@example.com" not in emails or not any(r["is_anonymous"] for r in rows):
    print(f"  ✕ the local D1 holds the users {rows}: want ada@example.com and an anonymous user", file=sys.stderr)
    sys.exit(1)
PY
kv_keys="$(cd "$work/apps/web" && pnpm exec wrangler kv key list --binding KV --local --config wrangler.jsonc 2>/dev/null)"
nkeys="$(python3 -c "import json,sys;print(len(json.loads(sys.argv[1])))" "$kv_keys" 2>/dev/null || echo 0)"
[ "$nkeys" -gt 0 ] || { echo "FAIL: better-auth kept no session in the KV namespace: $kv_keys" >&2; exit 1; }
echo "   the users in D1 (email and anonymous), the sessions in KV ($nkeys key(s))"
stop_group "$dev_pid"; dev_pid=""

echo "── connected: GitHub's keys handed to the Worker as the deploy hands them (worker-secrets.mjs → .dev.vars)"
(cd "$work/apps/web" && GITHUB_CLIENT_ID=e2e-github-client GITHUB_CLIENT_SECRET=e2e-github-secret \
   node ../../tooling/wire/worker-secrets.mjs --secret GITHUB_CLIENT_ID --secret GITHUB_CLIENT_SECRET \
     --secret GOOGLE_CLIENT_ID --secret GOOGLE_CLIENT_SECRET --dev-vars .dev.vars) > "$scratch/dev-vars.log" 2>&1 \
  || { echo "FAIL: worker-secrets.mjs --dev-vars" >&2; cat "$scratch/dev-vars.log" >&2; exit 1; }
start_dev dev-connected
python3 "$here/lib/auth-flows.py" "$url" "$values" github || exit 1
rm -f "$work/apps/web/.dev.vars"

echo "e2e.test.sh: ok"
