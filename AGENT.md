# Agent Rules & Guidelines

## 🔒 Confidentiality & Security Rules

1. **NEVER Read Secrets or Credentials**:
   - Never read, inspect, echo, print, or expose the contents of `.env` or any environment file containing real secrets (e.g., `.env.local`, `.env.production`). Only `.env.example` may be inspected.
   - Never read, inspect, echo, print, or expose the contents of `serviceAccount.json`, `service-account.json`, or any Service Account key / private key files (`*.json` containing private keys or credentials, `keys/`, `credentials.json`, etc.).
   
2. **Handling Environment & Credentials**:
   - If a file path or environment variable needs to be updated or referenced, instruct the user to configure it themselves or use placeholder values.
   - Never commit or log credential values, tokens, or secret keys in source files, logs, or conversation transcripts.
