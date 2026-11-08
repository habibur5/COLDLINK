# Graph Report - ColdLink  (2026-11-06)

## Corpus Check
- Corpus is ~26,599 words - fits in a single context window. You may not need a graph.

## Summary
- 126 nodes · 141 edges · 15 communities (10 shown, 5 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.9)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Backend Dependencies
- Tooling Configuration
- Backend Runtime
- TypeScript Configuration
- Booking and Data Model
- Build and Migration Scripts
- Module Boundaries
- Database Configuration
- Authorization Model
- Provider Verification
- Commission Settlement
- Background Jobs
- Formatting Rules
- Feature Flags
- Request Flow

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 11 edges
2. `scripts` - 9 edges
3. `ColdLink module boundaries` - 5 edges
4. `dotenv` - 4 edges
5. `scripts` - 4 edges
6. `Recommendation pipeline` - 4 edges
7. `ColdLink relational data model` - 4 edges
8. `@prisma/adapter-mariadb` - 3 edges
9. `express` - 3 edges
10. `prisma` - 3 edges

## Surprising Connections (you probably didn't know these)
- `ColdLink marketplace` --semantically_similar_to--> `ColdLink domain glossary and current vocabulary`  [INFERRED] [semantically similar]
  .ai/00-PROJECT_OVERVIEW.md → CONTEXT.md
- `Permission-based authorization` --semantically_similar_to--> `ColdLink domain glossary and current vocabulary`  [INFERRED] [semantically similar]
  .ai/adr/0003-permission-based-authorization.md → CONTEXT.md
- `Backend source scaffold` --references--> `ColdLink module boundaries`  [EXTRACTED]
  backend/src/README.md → .ai/01-architecture.md
- `Synchronous-first recommendations with async fallback` --conceptually_related_to--> `Redis and BullMQ background jobs`  [INFERRED]
  .ai/adr/0001-bundle-based-matching-and-recommendations.md → .ai/01-architecture.md
- `Payment-attempt lifecycle and authoritative verification` --conceptually_related_to--> `ColdLink module boundaries`  [INFERRED]
  .ai/payment-sandbox-scope.md → .ai/01-architecture.md

## Import Cycles
- None detected.

## Communities (15 total, 5 thin omitted)

### Community 0 - "Backend Dependencies"
Cohesion: 0.11
Nodes (24): dependencies, dotenv@18.0.9, express@5.3.0, mariadb@3.5.5, @prisma/adapter-mariadb@7.10.1, @prisma/client@7.10.1, devDependencies, tsx@4.23.15 (+16 more)

### Community 1 - "Tooling Configuration"
Cohesion: 0.12
Nodes (18): devDependencies, eslint@10.14.0, prettier@3.9.10, typescript@6.0.3, typescript-eslint@8.72.1, typescript, name, overrides (+10 more)

### Community 2 - "Backend Runtime"
Cohesion: 0.18
Nodes (6): app, backendDirectory, env, adapter, db, server

### Community 3 - "TypeScript Configuration"
Cohesion: 0.14
Nodes (13): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, noEmitOnError, outDir, rootDir (+5 more)

### Community 4 - "Booking and Data Model"
Cohesion: 0.20
Nodes (7): Booking lifecycle and split child approvals, Recommendation pipeline, Storage-only, transportation-only, and combined service requests, Capacity-safe booking transaction, Idempotency-Key protection, Prisma ORM 7 and MariaDB persistence conventions, ColdLink relational data model

### Community 5 - "Build and Migration Scripts"
Cohesion: 0.22
Nodes (9): scripts, build, dev, prisma:generate, prisma:migrate:deploy, prisma:migrate:dev, prisma:validate, start (+1 more)

### Community 6 - "Module Boundaries"
Cohesion: 0.29
Nodes (5): ColdLink module boundaries, Routing-provider interface, Project work breakdown and critical path, Provider-neutral payment interface, Backend source scaffold

### Community 7 - "Database Configuration"
Cohesion: 0.25
Nodes (5): prisma@7.10.1, backendDirectory, databaseUrl, port, prisma

### Community 8 - "Authorization Model"
Cohesion: 0.40
Nodes (3): ColdLink marketplace, System-protected and custom roles with feature flags, ColdLink domain glossary and current vocabulary

### Community 9 - "Provider Verification"
Cohesion: 0.67
Nodes (3): Provider verification, Resource verification, Service application

## Knowledge Gaps
- **11 isolated node(s):** `Service application`, `Resource verification`, `ColdLink marketplace`, `Centralized feature flags`, `Commission and provider settlement` (+6 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 62 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `scripts` connect `Build and Migration Scripts` to `Backend Dependencies`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **What connects `Service application`, `Resource verification`, `ColdLink marketplace` to the rest of the system?**
  _11 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Backend Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.11 - nodes in this community are weakly interconnected._
- **Why does `dotenv` connect `Backend Dependencies` to `Backend Runtime`, `Database Configuration`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._
- **Should `Tooling Configuration` be split into smaller, more focused modules?**
  _Cohesion score 0.12105263157894737 - nodes in this community are weakly interconnected._
- **Why does `@prisma/adapter-mariadb` connect `Backend Dependencies` to `Backend Runtime`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._
- **Should `TypeScript Configuration` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._