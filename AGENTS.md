# The Vessyl — publication rules

These rules are mandatory for every publication of this project.

1. “Publish”, “публикуй”, “паблик”, and “обнови паблик” mean a genuinely public deployment that opens without authentication.
2. The only remote repository for this site is `Razdorsky/the-vessyl-dome`. Do not create mirrors, archives, username Pages repositories, or secondary hosting projects.
3. The only public deployment is GitHub Pages from the `gh-pages` branch of `Razdorsky/the-vessyl-dome`.
4. The canonical public URL is `https://razdorsky.github.io/the-vessyl-dome/` and must also match the successful GitHub Pages deployment result. Do not invent, shorten, or manually transform it.
5. Before handing off a link:
   - wait for the Pages workflow and deployment to succeed;
   - request the URL without cookies, credentials, or bypass headers;
   - require a final HTTP `200`;
   - verify that the response is The Vessyl site rather than a login, error, or redirect page.
6. Do not create or retain a Sites, root-domain Pages, or other duplicate deployment for this project.
7. Publish only the exact tested source state:
   - run the normal tests and production build;
   - run `npm run build:pages`;
   - commit and push the source changes to `main`;
   - publish the exact contents of `dist-pages/` as an orphan commit on `gh-pages`;
   - configure Pages with `build_type: legacy`, branch `gh-pages`, and path `/`;
   - wait for the Pages build to report `built`;
   - read `html_url` from the Pages API and verify it anonymously before handoff.
8. Do not change approved graphics as part of publication or code optimization.
