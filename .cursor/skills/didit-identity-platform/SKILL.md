---
name: didit-identity-platform
description: >
  Integrates Didit Identity Verification APIs via official agent skills. Covers KYC sessions, ID verification, passive liveness, face match/search, age estimation, email/phone OTP, AML screening, proof of address, and database validation. Use when the user mentions Didit, KYC, identity verification, document verification, liveness, face match, AML screening, age verification, email/phone verification, or proof of address.
---

# Didit Identity Platform

Skill de referencia para usar las **Didit Agent Skills** oficiales (verificación de identidad, KYC, AML, biometría) en Cursor. Las skills reales viven en [didit-protocol/didit-agent-skills](https://github.com/didit-protocol/didit-agent-skills).

## Cuándo aplicar esta skill

- Usuario menciona **Didit**, **KYC**, verificación de identidad o de documentos.
- Necesidad de **liveness** (detección de persona real), **face match**, **face search** o **age estimation**.
- Verificación por **email** o **teléfono** (OTP), **AML/sanciones**, **proof of address** o validación en bases de datos gubernamentales.

## Instalación de las skills oficiales

Las 11 skills son carpetas con `SKILL.md` autocontenido. Instálalas para que el agente pueda invocar las APIs.

**En el proyecto (recomendado para Keysely):**

```bash
git clone https://github.com/didit-protocol/didit-agent-skills.git
cp -r didit-agent-skills/skills/didit-* .cursor/skills/
```

**Global (todos los proyectos):**

```bash
git clone https://github.com/didit-protocol/didit-agent-skills.git
cp -r didit-agent-skills/skills/didit-* ~/.cursor/skills/
```

**Con ClawHub (por skill):**

```bash
npx clawhub@latest install didit-sessions
npx clawhub@latest install didit-id-verification
# ... etc. para cada skill necesaria
```

## Configuración

1. Obtener API key en [Didit Business Console](https://business.didit.me) → API & Webhooks.
2. Variables de entorno:

```bash
export DIDIT_API_KEY="your_api_key"
# Opcional, para sesiones/workflows:
export DIDIT_WORKFLOW_ID="your_workflow_id"   # Console → Workflows
export DIDIT_WEBHOOK_SECRET="your_secret"     # Console → API & Webhooks
```

## Las 11 skills y sus APIs

| Skill | Versión | Uso principal |
|-------|---------|----------------|
| **didit-sessions** | 2.0.0 | Hub: crear sesiones, decisiones, listar/eliminar, PDF, compartir KYC, blocklist. Incluye verificación de firma de webhooks. |
| **didit-id-verification** | 1.2.0 | Pasaportes, DNI, permisos. OCR, MRZ, NFC. 4000+ tipos, 220+ países. |
| **didit-passive-liveness** | 1.2.0 | Liveness en una imagen. Anti-spoof (impresión, pantalla, máscara). |
| **didit-face-match** | 1.2.0 | Comparar dos caras; score 0–100. Selfie vs documento. |
| **didit-face-search** | 1.0.0 | Búsqueda 1:N en sesiones verificadas. Duplicados y blocklist. |
| **didit-age-estimation** | 1.0.0 | Edad desde selfie; liveness incluido. Umbrales para contenido por edad. |
| **didit-email-verification** | 1.2.0 | Enviar y comprobar OTP por email. Detecta breached, desechables, undeliverable. |
| **didit-phone-verification** | 1.2.0 | OTP por SMS, WhatsApp o Telegram. Detecta VoIP y números desechables. |
| **didit-aml-screening** | 1.0.0 | Screening en 1300+ bases sanciones, PEP, adverse media. Sistema de riesgo dual. |
| **didit-proof-of-address** | 1.0.0 | Facturas, extractos, documentos oficiales. OCR y geocoding. |
| **didit-database-validation** | 1.0.0 | Validación frente a bases gubernamentales en 18 países. |

**Total: 23 endpoints** documentados y probados en el repo.

## Endpoints por categoría

- **Sessions:** `POST/GET/DELETE/PATCH /v3/session/...`, `GET .../generate-pdf`, `POST .../share/`, `POST .../import-shared/`, `POST/GET /v3/blocklist/...`
- **ID:** `POST /v3/id-verification/`
- **Liveness:** `POST /v3/passive-liveness/`
- **Face:** `POST /v3/face-match/`, `POST /v3/face-search/`
- **Age:** `POST /v3/age-estimation/`
- **Email:** `POST /v3/email/send/`, `POST /v3/email/check/`
- **Phone:** `POST /v3/phone/send/`, `POST /v3/phone/check/`
- **AML:** `POST /v3/aml/`
- **PoA:** `POST /v3/poa/`
- **DB validation:** `POST /v3/database-validation/`

## Flujo recomendado

1. **¿Las skills están instaladas?** Si no, indicar los comandos de instalación anteriores.
2. **¿Hay `DIDIT_API_KEY`?** Recordar configurarla (y opcionalmente `DIDIT_WORKFLOW_ID` / `DIDIT_WEBHOOK_SECRET`).
3. **Elegir skill:** según lo que pida el usuario (sesión KYC, verificar documento, liveness, AML, etc.), usar la skill correspondiente del repo; cada `SKILL.md` tiene las instrucciones para llamar a la API.

## Recursos

- Repo: [github.com/didit-protocol/didit-agent-skills](https://github.com/didit-protocol/didit-agent-skills)
- Documentación: [docs.didit.me](https://docs.didit.me)
- Tests del repo: `python3 tests/test_all_skills.py` (con `DIDIT_API_KEY` y `DIDIT_WORKFLOW_ID`)
