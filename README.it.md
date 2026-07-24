# KubeSpaces

> Il control plane aperto per tenant Kubernetes virtuali.

[![Release](https://img.shields.io/github/v/release/kubespaces-io/kubespaces?sort=semver&color=3730a3&label=release)](https://github.com/kubespaces-io/kubespaces/releases/latest)
[![CI](https://github.com/kubespaces-io/kubespaces/actions/workflows/ci.yml/badge.svg)](https://github.com/kubespaces-io/kubespaces/actions/workflows/ci.yml)
[![E2E](https://github.com/kubespaces-io/kubespaces/actions/workflows/e2e.yml/badge.svg)](https://github.com/kubespaces-io/kubespaces/actions/workflows/e2e.yml)
[![Build & images](https://github.com/kubespaces-io/kubespaces/actions/workflows/build.yml/badge.svg)](https://github.com/kubespaces-io/kubespaces/actions/workflows/build.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue)](LICENSE)

**[Documentazione](https://docs.kubespaces.io)** · [Roadmap](ROADMAP.md) · [Bacheca del progetto](https://github.com/orgs/kubespaces-io/projects/3) · [Come contribuire](CONTRIBUTING.md) · [Sicurezza](SECURITY.md)

[English](README.md) · [简体中文](README.zh-CN.md) · **Italiano**

Questo è il monorepo di KubeSpaces: API di backend, l'operator dei Tenant, il
frontend web e l'umbrella Helm chart che distribuisce un'installazione completa.
(I repository precedenti — kubespaces-io/login-api, ams0/frontend — sono
superati da questo codice.)

| Componente | Dove | Cosa |
|------------|------|------|
| API di backend | `api/` | Go · chi · pgx · OIDC. Autenticazione, CRUD dei tenant → Tenant CR, kubeconfig |
| Operator | `operator/` | Go · controller-runtime. Unico provisioner: Tenant CR → vCluster |
| Frontend | `frontend/` | Next.js 15 · Auth.js (Keycloak). Portale self-service |
| CLI | `cli/` | Go · cobra. `kubespaces` — login device-flow, CRUD dei tenant, kubeconfig |
| Chart | `charts/kubespaces/` | Il prodotto: un solo `helm install` per tutto |

## Struttura del repository

```
.
├── api/                       # API di backend — Go (chi, pgx, go-oidc)
│   ├── cmd/api/               #   entrypoint
│   └── internal/              #   auth, server (handler), store (Postgres + migrazioni), k8s (Tenant CR)
├── operator/                  # Operator dei Tenant — Go (controller-runtime, layout kubebuilder)
│   ├── api/v1alpha1/          #   tipi Tenant (fonte di verità della CRD)
│   ├── config/                #   CRD + RBAC generati (make manifests)
│   └── internal/              #   controller (reconciler), provisioner (vCluster via Helm SDK)
├── frontend/                  # Portale self-service — Next.js 15 + Auth.js (Keycloak)
│   └── src/                   #   app router, componenti, hook, lib
├── cli/                       # CLI kubespaces — Go (cobra), login OIDC device-flow
│   ├── cmd/kubespaces/        #   entrypoint
│   ├── internal/              #   cli, client, auth, config, kubeconfig
│   └── DESIGN.md              #   set di comandi e decisioni di progettazione
├── charts/
│   └── kubespaces/            # Umbrella Helm chart — IL prodotto: una sola installazione per tutto
├── examples/                  # profili di values: demo kind, test GKE, produzione
├── docs/
│   ├── contracts.md           # contratto tra i componenti (leggere prima di toccare qualsiasi componente)
│   ├── host-cluster.md        # preparazione dell'host per l'esposizione dei tenant (Gateway API, DNS)
│   └── prerequisites.md       # cosa serve: tier demo vs tier produzione
├── .github/workflows/         # ci (per componente), build (immagini → ghcr), release (CLI), chart mirror
├── .goreleaser.yaml           # release CLI: binari, checksum, Homebrew tap
├── Makefile                   # helm lint / template / install, ciclo dev kind, apply CRD
├── LICENSE                    # Apache 2.0
└── NOTICE                     # riconoscimento a vCluster
```

Versionamento: una sola linea per l'intero repo — un tag `vX.Y.Z` rilascia
insieme i binari della CLI (goreleaser) e le immagini `api`/`operator`/`frontend`.

## Avvio rapido

```bash
helm install kubespaces charts/kubespaces \
  --namespace kubespaces --create-namespace
```

L'installazione predefinita è completamente autonoma: API + frontend +
PostgreSQL (immagine ufficiale `postgres`) + Keycloak (immagine ufficiale,
modalità dev, realm importato automaticamente). Per la produzione, passa a un
Postgres esterno, un provider OIDC esterno e un ingress reale — vedi
`examples/values-production.yaml`.

**Test di accettazione (che fa da gate a ogni release):** cluster kind nuovo →
`helm install kubespaces` → tenant funzionante + kubeconfig in meno di 10 minuti.

## Ciclo di sviluppo

```bash
make lint        # helm lint
make template    # rendering dei manifest in locale
make kind-up     # cluster kind locale
make install     # installa/aggiorna il chart nel context corrente
```

## Note di progettazione

- **Niente subchart Bitnami.** Broadcom ha spostato le immagini Bitnami dietro
  un abbonamento (2025); un nuovo progetto open source non dovrebbe dipendervi.
  Postgres e Keycloak sono forniti come StatefulSet minimali integrati, su
  immagini ufficiali, per il profilo all-in-one, e sono pensati per essere
  sostituiti da servizi esterni in produzione (`postgresql.enabled=false`,
  `keycloak.enabled=false`).
- **Il contratto delle variabili d'ambiente con l'API è provvisorio** finché
  non arriva il refactoring del backend — i nomi sono centralizzati in
  `templates/api/deployment.yaml`.
- Discussione sull'architettura dell'operator: [operator/README.md](operator/README.md).
- Log di pianificazione e decisioni: il repository `plan` (directory adiacente).

## Licenza

Apache 2.0 — vedi [LICENSE](LICENSE). Basato su [vCluster](https://github.com/loft-sh/vcluster) (Apache 2.0) — vedi [NOTICE](NOTICE).
