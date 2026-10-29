#!/usr/bin/env python3
"""Everything a visitor does with a served product, as a browser does it.

    auth-flows.py <base-url> <values.json> unconnected|github

`unconnected` is a fresh product (no sign-in provider connected): the sign-in
page carries the product's name, links the product's repository (and no
baseline's) and says how to add a provider; email sign-up, and a sign-up
from a foreign Origin refused; the redirects between / and /dashboard; the
dashboard; a file uploaded to R2, listed, downloaded byte for byte, refused
to another user, and deleted; sign-out, a wrong password, sign-in again;
anonymous sign-in; the OpenAPI reference; an unknown page; and better-auth's
rate limit on sign-in (counted in D1).

`github` is the same Worker with GitHub's keys handed to it: the page offers
GitHub and nothing else, and sign-in with GitHub starts the OAuth flow at
github.com with this deployment's own callback URL.

Cookies are kept by hand: better-auth marks them Secure, which a browser
still sends to 127.0.0.1 and Python's cookie jar does not. Exit 0 when every
check holds; otherwise each failure is printed and the exit is 1.
"""
import html
import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

base, values, mode = sys.argv[1].rstrip("/"), json.load(open(sys.argv[2])), sys.argv[3]
name, repo, org = values["productname"], values["reponame"], values["githuborg"]
problems = []


def bad(message):
    problems.append(message)


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


opener = urllib.request.build_opener(NoRedirect())


class Browser:
    """One visitor: a cookie jar and the site's own Origin on every request."""

    def __init__(self, origin=base):
        self.jar, self.origin = {}, origin

    def req(self, method, path, body=None, headers=None, raw=False):
        h = {"origin": self.origin, **(headers or {})}
        if self.jar:
            h["cookie"] = "; ".join(f"{k}={v}" for k, v in self.jar.items())
        data = None
        if raw:
            data = body
        elif body is not None:
            data, h["content-type"] = json.dumps(body).encode(), "application/json"
        r = urllib.request.Request(base + path, data=data, method=method, headers=h)
        try:
            with opener.open(r, timeout=30) as resp:
                status, hs, out = resp.status, resp.headers, resp.read()
        except urllib.error.HTTPError as e:
            status, hs, out = e.code, e.headers, e.read()
        for c in hs.get_all("set-cookie") or []:
            k, _, v = c.split(";")[0].partition("=")
            if v:
                self.jar[k] = v
            else:
                self.jar.pop(k, None)
        return status, hs, out

    def json(self, method, path, body=None, headers=None):
        s, h, b = self.req(method, path, body, headers)
        try:
            return s, json.loads(b) if b else None
        except ValueError:
            return s, b.decode(errors="replace")

    def session(self):
        s, body = self.json("GET", "/api/auth/get-session")
        return body if s == 200 and isinstance(body, dict) else None


def text(fragment):
    return html.unescape(re.sub(r"<[^>]+>", "", fragment)).strip()


def landing(browser):
    s, h, b = browser.req("GET", "/")
    page = b.decode(errors="replace")
    if s != 200:
        bad(f"/ answered {s}")
    return page


def check_brand(page):
    title = re.search(r"<title>(.*?)</title>", page, re.S)
    if not title or text(title.group(1)) != name:
        bad(f"the page's <title> is {title and title.group(1)!r}, not {name!r}")
    h1 = re.search(r"<h1[^>]*>(.*?)</h1>", page, re.S)
    if not h1 or text(h1.group(1)) != name:
        bad(f"the page's heading is {h1 and h1.group(1)!r}, not {name!r}")
    source = re.findall(r'<a[^>]*data-source="site"[^>]*>', page)
    hrefs = [m.group(1) for a in source for m in [re.search(r'href="([^"]*)"', a)] if m]
    if hrefs != [f"https://github.com/{org}/{repo}"]:
        bad(f"the page's own source link is {hrefs}, not https://github.com/{org}/{repo}")
    for leak in ("better-auth-starter", "sourceplane", "Auth Starter"):
        if leak in page:
            bad(f"the page still carries the baseline's {leak!r}")


if mode == "unconnected":
    visitor = Browser()
    page = landing(visitor)
    check_brand(page)
    providers = re.search(r'data-providers="([^"]*)"', page)
    if not providers or providers.group(1) != "":
        bad(f"a fresh product's page offers the providers {providers and providers.group(1)!r}")
    if 'data-connect="oauth"' not in page:
        bad("a fresh product's page does not say how to add a sign-in provider")

    # Sign-up from another site's page is refused: better-auth's origin check,
    # against this deployment's own origin.
    stranger = Browser(origin="https://evil.example")
    s, body = stranger.json("POST", "/api/auth/sign-up/email",
                            {"name": "Mallory", "email": "mallory@example.com", "password": "correct horse battery"})
    if s != 403:
        bad(f"a sign-up from a foreign Origin answered {s} {body}, not 403")

    s, body = visitor.json("POST", "/api/auth/sign-up/email",
                           {"name": "Ada", "email": "ada@example.com", "password": "correct horse battery"})
    if s != 200:
        bad(f"email sign-up answered {s} {body}")
    me = visitor.session()
    if not me or me["user"]["email"] != "ada@example.com":
        bad(f"after sign-up the session is {me}")

    # Signed in, / goes to the dashboard; the dashboard greets the user.
    s, h, _ = visitor.req("GET", "/")
    if s not in (302, 307) or urllib.parse.urlparse(h.get("location") or "").path != "/dashboard":
        bad(f"/ signed in answered {s} → {h.get('location')}, not a redirect to /dashboard")
    s, _, b = visitor.req("GET", "/dashboard")
    dash = b.decode(errors="replace")
    if s != 200 or "Ada" not in text(dash) or name not in html.unescape(dash):
        bad(f"/dashboard answered {s} without the user's name or the product's")

    # A file through R2: upload (private), list, download byte for byte; another
    # user is refused it; delete; the list is empty again.
    png = bytes([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]) + bytes(range(64))
    s, _, b = visitor.req("POST", "/api/auth/files/upload-raw", png, raw=True, headers={
        "content-type": "image/png", "x-filename": "dot.png",
        "x-file-metadata": json.dumps({"isPublic": False, "category": "e2e"})})
    if s != 200:
        bad(f"the upload answered {s} {b[:200]!r}")
    s, listed = visitor.json("GET", "/api/auth/files/list")
    files = (listed or {}).get("files", []) if s == 200 and isinstance(listed, dict) else []
    if len(files) != 1 or files[0].get("originalName") != "dot.png":
        bad(f"the file list answered {s} {listed}")
    else:
        fid = files[0]["id"]
        s, _, b = visitor.req("POST", "/api/auth/files/download", {"fileId": fid})
        if s != 200 or b != png:
            bad(f"the download answered {s}, {len(b)} bytes, {'the same' if b == png else 'not the'} bytes uploaded")
        other = Browser()
        s, _ = other.json("POST", "/api/auth/sign-in/anonymous", {})
        if s != 200:
            bad(f"a second visitor's anonymous sign-in answered {s}")
        s, _, b = other.req("POST", "/api/auth/files/download", {"fileId": fid})
        if s != 404 or b == png:
            bad(f"another user's download of a private file answered {s}, not 404")
        s, body = visitor.json("POST", "/api/auth/files/delete", {"fileId": fid})
        if s != 200:
            bad(f"the delete answered {s} {body}")
        s, listed = visitor.json("GET", "/api/auth/files/list")
        if s != 200 or (listed or {}).get("files"):
            bad(f"after the delete the file list answered {s} {listed}")

    # Sign out; signed out, /dashboard goes back to sign-in.
    s, _ = visitor.json("POST", "/api/auth/sign-out", {})
    if s != 200 or visitor.session():
        bad(f"sign-out answered {s} and left the session {visitor.session()}")
    s, h, _ = visitor.req("GET", "/dashboard")
    if s not in (302, 307) or urllib.parse.urlparse(h.get("location") or "").path != "/":
        bad(f"/dashboard signed out answered {s} → {h.get('location')}, not a redirect to /")

    s, body = visitor.json("POST", "/api/auth/sign-in/email", {"email": "ada@example.com", "password": "wrong horse"})
    if s != 401:
        bad(f"a wrong password answered {s} {body}, not 401")
    s, body = visitor.json("POST", "/api/auth/sign-in/email",
                           {"email": "ada@example.com", "password": "correct horse battery"})
    me = visitor.session()
    if s != 200 or not me or me["user"]["email"] != "ada@example.com":
        bad(f"signing in again answered {s} and the session is {me}")

    anon = Browser()
    s, body = anon.json("POST", "/api/auth/sign-in/anonymous", {})
    me = anon.session()
    if s != 200 or not me or not me["user"].get("isAnonymous"):
        bad(f"anonymous sign-in answered {s} and the session is {me}")

    s, _, b = visitor.req("GET", "/api/auth/reference")
    if s != 200 or b"<html" not in b.lower():
        bad(f"the OpenAPI reference answered {s}")
    s, _, _ = visitor.req("GET", "/no-such-page")
    if s != 404:
        bad(f"an unknown page answered {s}, not 404")

    # better-auth's rate limit on sign-in (three per ten seconds per address,
    # kept in D1): the address is Cloudflare's cf-connecting-ip, which
    # wrangler dev sets as the edge does. The next tries are refused.
    limited = Browser()
    codes = [limited.json("POST", "/api/auth/sign-in/email",
                          {"email": "ada@example.com", "password": "wrong horse"})[0] for _ in range(6)]
    if 429 not in codes:
        bad(f"six sign-ins in a row answered {codes}: no 429 from the rate limit")

elif mode == "github":
    visitor = Browser()
    page = landing(visitor)
    check_brand(page)
    providers = re.search(r'data-providers="([^"]*)"', page)
    if not providers or providers.group(1) != "github":
        bad(f"with GitHub's keys the page offers {providers and providers.group(1)!r}, not 'github'")
    if 'data-connect="oauth"' in page:
        bad("with a provider connected the page still says how to add one")
    buttons = re.findall(r"Continue with (?:<!-- -->)?(\w+)", page)
    if buttons != ["GitHub"]:
        bad(f"the page's provider buttons are {buttons}, not GitHub alone")
    s, body = visitor.json("POST", "/api/auth/sign-in/social", {"provider": "github", "callbackURL": "/dashboard"})
    target = (body or {}).get("url", "") if isinstance(body, dict) else ""
    parsed = urllib.parse.urlparse(target)
    query = urllib.parse.parse_qs(parsed.query)
    if s != 200 or parsed.netloc != "github.com" or parsed.path != "/login/oauth/authorize":
        bad(f"sign-in with GitHub answered {s} {body}, not github.com's authorize URL")
    else:
        if query.get("client_id") != ["e2e-github-client"]:
            bad(f"the authorize URL carries the client {query.get('client_id')}, not the key handed to the Worker")
        if query.get("redirect_uri") != [f"{base}/api/auth/callback/github"]:
            bad(f"the authorize URL calls back to {query.get('redirect_uri')}, not {base}/api/auth/callback/github")
        if not query.get("state"):
            bad("the authorize URL carries no state")
    s, body = visitor.json("POST", "/api/auth/sign-in/social", {"provider": "google", "callbackURL": "/dashboard"})
    if s == 200:
        bad(f"sign-in with Google, whose keys were not handed over, answered 200 {body}")

else:
    sys.exit(f"auth-flows.py: unknown mode {mode!r} (unconnected | github)")

for p in problems:
    print(f"  ✕ {p}", file=sys.stderr)
if not problems:
    print(f"   auth-flows ({mode}): every check holds")
sys.exit(1 if problems else 0)
