# Especificaciones del Sistema — Fiambrería Costanera POS (`vertex-pos`)

Esta carpeta reúne la documentación estructural completa del sistema **Fiambrería Costanera POS** (`vertex-pos` v2.0.0) para que tanto tú como cualquier agente de IA puedan entender qué hace el producto, cómo está construido, cómo navega el usuario, cómo debe verse, cómo se organizan los datos y en qué orden se construye o extiende cada módulo.

## Índice de documentos

| # | Documento | Archivo | Qué resuelve |
| :--- | :--- | :--- | :--- |
| **1** | **PRD (Requisitos de Producto)** | [01-PRD.md](./01-PRD.md) | Idea general, propuesta de valor, roles, permisos y lista exacta de funcionalidades del sistema. |
| **2** | **TRD (Requisitos Técnicos)** | [02-TRD.md](./02-TRD.md) | Stack tecnológico, arquitectura, convenciones de código, mapa de APIs, hardware y verificación. |
| **3** | **Flujo de la App** | [03-flujo-de-la-app.md](./03-flujo-de-la-app.md) | Fases, mapa de navegación, acciones exactas al pulsar cada botón y pantallas siguientes. |
| **4** | **Brief de Diseño** | [04-brief-de-diseno.md](./04-brief-de-diseno.md) | Paleta de colores, tipografía, escalado POS, componentes UI y guía visual pantalla por pantalla. |
| **5** | **Esquema del Backend** | [05-esquema-backend.md](./05-esquema-backend.md) | Flujo de autenticación/autorización y catálogo completo de tablas, columnas y relaciones en PostgreSQL/Prisma. |
| **6** | **Plan de Implementación** | [06-plan-de-implementacion.md](./06-plan-de-implementacion.md) | Secuencia paso a paso de construcción por dependencias y criterios de verificación por fase. |

---

> **Nota de mantenimiento:** Estas especificaciones reflejan la arquitectura real implementada en el repositorio (`prisma/schema.prisma`, `app/`, `components/`, `lib/`, `worker/`). Al agregar nuevos módulos o cambiar flujos, actualiza primero el documento correspondiente para mantener alineados producto, diseño y código.
