# Third-party notices

## Projects that informed this package

This project was informed by the following projects, both licensed under the
MIT License (reproduced below). Their editor implementations are not bundled
into this package.

- Sphere — Copyright (c) 2024 Alejandro García Fernández — https://github.com/Alex-GF/Sphere
- Pricing4TS — Copyright (c) 2024 Alejandro García Fernández — https://github.com/Alex-GF/Pricing4TS

The copyright lines above were checked against the `LICENSE` file at the
default branch of each repository.

```text
MIT License

Copyright (c) 2024 Alejandro García Fernández

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Direct runtime dependencies

Versions and licenses were read from the `package.json` files installed in
`node_modules` after `pnpm install --frozen-lockfile`. They reflect the
lockfile at the time of writing and are maintained by hand; this file is not
regenerated automatically.

| Package    | Version | License      |
| ---------- | ------- | ------------ |
| lit        | 3.3.3   | BSD-3-Clause |
| @lit/react | 1.0.8   | BSD-3-Clause |
| yaml       | 2.9.0   | ISC          |

## Optional peer dependencies

These are not bundled or installed by this package. They are only needed for
the React entry point. Versions are the ones installed for development.

| Package   | Version | License |
| --------- | ------- | ------- |
| react     | 19.2.8  | MIT     |
| react-dom | 19.2.8  | MIT     |

## Transitive dependencies

Transitive dependencies are not listed here. Each dependency retains its own
copyright and license terms; see the package contents in `node_modules` or the
lockfile for the full set.

## Test data (not distributed)

`tests/fixtures/spectra/` holds 37 iPricings from two sources:

- SaaS Pricing Evaluation Corpus for Temporal Representation & Analysis
  (SPECTRA) — Francisco Javier Cavero, José Antonio Parejo, Juan C. Alonso and
  Antonio Ruiz-Cortés, 2025, Zenodo — version 1.2.0,
  <https://doi.org/10.5281/zenodo.17237164> — licensed under
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). 30 files.
- pricing-intelligence-labpack (isa-group), extended copy of SPECTRA — commit
  `49e90f5a3d4dde91d15614e5c8269085888b6f0b` of
  <https://github.com/isa-group/pricing-intelligence-labpack> — licensed under
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) according to the
  `LICENSE.txt` at the root of the repository. 7 files: CircleCI, Okta,
  Shopify, Trello, Webflow, ZenHub and Zoom.

Modifications: the files were upgraded from Pricing2Yaml 2.1 to 3.1 with
pricing4ts 0.12.1 and one Trello value was corrected; the fixture README lists
the changes.

The tests use these files; the published package does not contain them.
