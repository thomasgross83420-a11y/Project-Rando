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
