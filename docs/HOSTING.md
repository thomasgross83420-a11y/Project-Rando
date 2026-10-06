# Free GitHub delivery evidence

2026-10-06: connected repository thomasgross83420-a11y/Project-Rando is public,
not archived and has_pages=false. GET Pages: 404. GET Actions permissions: 403
Resource not accessible by integration. The account-plan field was unavailable;
the workflow is constrained to the user's stated Free plan.

[Official Pages eligibility](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
permits public repositories on Free. [Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)
documents free standard runners for public repositories and finite artifact storage.
No paid/larger runner, LFS, custom domain or cache/storage assumption is introduced.
Prefer local checks. A prepared workflow must use explicit manual dispatch, standard
Ubuntu, small production artifact and one-day retention; it is not installed until
actual Actions/Pages settings and permitted actions can be confirmed.

[Custom Pages workflow](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
requires Pages configured for Actions, pages:write and id-token:write on deployment.
The candidate project subpath is /Project-Rando/. Static hash routes preserve refresh;
Vite asset base is pinned to that subpath. Public HTTPS/MIME/refresh and production
storage-origin behavior must be verified after publication. There is no verified
public playable URL. Hosting uncertainty does not block local game implementation.

## Read-only Actions 403 diagnosis — 2026-10-06

Previously observed operation: `GET /repos/thomasgross83420-a11y/Project-Rando/actions/permissions`
returned **HTTP 403**, `Resource not accessible by integration`. That forbidden
administration endpoint was **not retried** during visual-review preparation.

Independent current read-only checks:

- Repository metadata GET succeeded: public, not archived, `has_pages=false`,
  user permissions `admin/maintain/push/pull/triage=true`.
- `GET /repos/thomasgross83420-a11y/Project-Rando/actions/workflows` returned
  **HTTP 200**, `total_count=0`, `workflows=[]`. Response
  `X-Accepted-GitHub-Permissions: actions=read`. No workflow was triggered.

[Official endpoint documentation](https://docs.github.com/en/rest/actions/permissions#get-github-actions-permissions-for-a-repository)
requires repository **Administration: read** for GitHub App/fine-grained tokens;
classic OAuth/PAT tokens require `repo` scope.
[GitHub troubleshooting](https://docs.github.com/en/rest/using-the-rest-api/troubleshooting-the-rest-api#resource-not-accessible)
identifies this integration error as insufficient token permissions. Access date
2026-10-06. User `admin=true` does not grant every permission to the integration.
The likely prerequisite is an integration credential authorized for that specific
administration read operation. No credentials were inspected or added, no
permission grants requested, and no repository/organization settings changed.

The actual Actions administration policy remains unreadable through the current
connection. Enabled/disabled Actions or allowed-action policy cannot be inferred
from the error or from an empty workflow list. There is no evidence of a Free-plan
limitation causing this 403; [official Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)
allows standard hosted runner usage in public repositories without minute charges
(accessed 2026-10-06), while storage and larger-runner costs remain distinct.
This is not a Gate 1 blocker: local production/browser/atlas checks are available.
Pages configuration, publication, deployed HTTPS/MIME/refresh behavior and stable
public playability remain unverified. No forbidden endpoint retries, visibility
changes, transfer, policy changes, purchases or deployment occurred.
