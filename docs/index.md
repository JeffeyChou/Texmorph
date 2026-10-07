---
layout: home
hero:
  name: texmorph
  text: Seekable formula morphing
  tagline: Animate one LaTeX formula into another. Every frame is a pure function of progress t, so you can drive it from a slider, a timeline or a video frame counter.
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: How it works
      link: /guide/how-it-works
    - theme: alt
      text: GitHub
      link: https://github.com/JeffeyChou/Texmorph
features:
  - title: No clock
    details: The library never schedules frames. render(t) works in any order, so scrubbing, reversing and frame-by-frame video export just work.
  - title: Exact endpoints
    details: At t = 0 and t = 1 the real formulas are shown, pixel-identical to a plain rendering.
  - title: KaTeX and MathJax
    details: A pure planning core and a renderer-agnostic DOM driver. KaTeX for speed, MathJax SVG for coverage and cross-browser geometry.
  - title: Fits your stack
    details: Adapters for GSAP timelines, a <tex-morph> Web Component and Remotion videos, plus a script-tag build.
---
