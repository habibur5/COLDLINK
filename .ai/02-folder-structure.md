# Folder Structure

```text
ColdLink/
├── frontend/          React + TypeScript (internal structure undecided)
├── backend/
│   └── src/
│       ├── modules/   one folder per module (list: 01 §Modules)
│       ├── middleware/
│       ├── config/
│       └── shared/
└── .ai/               AI-development docs (this folder)
```

## Module template
Use only the files a module actually needs. Do not create empty or speculative files.
```text
src/modules/<module>/
├── dto/
├── <entity>.entity.ts     entity class + its custom repository class (same file)
├── <module>.service.ts
├── <module>.controller.ts
└── <module>.routes.ts
```
Example: `users/user.entity.ts`, `user.service.ts`, `user.controller.ts`, `user.routes.ts`, `dto/`.

| File | Purpose |
|---|---|
| `dto/*` | API request/response contracts |
| `*.entity.ts` | One entity per file: class-based MikroORM entity + colocated custom repository class (details: `04`) |
| `*.service.ts` | Business logic |
| `*.controller.ts` | HTTP handling only |
| `*.routes.ts` | Endpoints → controller methods, middleware |

A module with several tables (e.g. `bookings`, `storages`) has several `*.entity.ts` files.

## Naming
- Module folders: kebab-case (`service-requests`).
- File pattern: `<name>.<layer>.ts`.
- Follow the existing style in a module before adding files.

## Undecided
Frontend structure; contents of `middleware/`, `config/`, `shared/`; location of base entity/base repository; which module owns `farmer_profiles`, `farm_locations`, `booking_status_history`, `admin_action_logs`.
