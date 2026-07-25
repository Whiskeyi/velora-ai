# Security policy

## Supported versions

Velora is currently a preview. Security fixes are applied to the latest `0.1.x`
release and the `main` branch.

## Reporting a vulnerability

Please use [GitHub private vulnerability
reporting](https://github.com/Whiskeyi/velora-ai/security/advisories/new). Do not
open a public issue for a suspected vulnerability.

Include the affected version, impact, minimal reproduction, and any proposed
mitigation. Never include API keys, private model prompts, conversation data,
or personal information. Maintainers will acknowledge the report within seven
days and coordinate disclosure after a fix is available.

## Security boundaries

Velora does not enable raw HTML in model-authored Markdown by default. Consumers
that add custom rehype plugins or trusted syntax highlighters are responsible
for sanitizing their output. Consumers also remain responsible for securing the
transport endpoint, authenticating requests, applying rate limits, and
redacting sensitive model output.
