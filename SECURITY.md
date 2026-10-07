# Security policy

## Supported versions

Security fixes are released for the latest minor version of each package.

## Reporting a vulnerability

Please report vulnerabilities privately through [GitHub security advisories](https://github.com/JeffeyChou/Texmorph/security/advisories/new) rather than in public issues.

## Design notes

- texmorph never uses `innerHTML`, `outerHTML`, `eval` or `new Function`. Formula text reaches the page only through the renderer or `textContent`.
- KaTeX `trust: true` is rejected; trusted commands require an explicit policy function.
- The MathJax renderer refuses the `html`, `require` and `autoload` TeX packages, and font ranges are loaded through fixed module specifiers, never from formula input.
- Styles are written through the CSSOM, so a strict Content Security Policy is supported.
- Preparation can be bounded with an `AbortSignal`. A TeX parse that is already running cannot be interrupted, so limit expensive input with the renderer's own options (KaTeX `maxSize`/`maxExpand`).
