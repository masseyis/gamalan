# ADR-0001: Hexagonal Architecture and Clerk Integration

## Status

Accepted

## Context

We need a scalable and maintainable architecture for our microservices. We also need a robust authentication solution that is easy to integrate and manage.

## Decision

We will use a hexagonal (or clean) architecture for all our services. This architecture separates the core domain logic from external concerns like HTTP APIs, databases, and other integrations. This allows for better testability, maintainability, and flexibility.

For authentication, we will use Clerk as our identity provider (IdP). Clerk will handle user registration, login, and management. Our services will verify Clerk-issued JSON Web Tokens (JWTs) to authenticate users.

### Hexagonal Architecture Boundaries

- **`domain`**: Contains the core business logic, entities, and value objects. It has no dependencies on any other layer.
- **`application`**: Contains the application-specific logic and use cases. It orchestrates the domain logic and depends on the `domain` layer.
- **`adapters`**: Contains the implementations of external concerns.
  - **`http`**: Axum routes, handlers, and DTOs.
  - **`persistence`**: Database repositories using `sqlx`.
  - **`integrations`**: Clients for other services (e.g., LLMs, event streams).

### Clerk JWT Verification

- A shared library, `libs/auth_clerk`, will provide a `JwtVerifier` and an Axum middleware/extractor.
- The `JwtVerifier` will fetch and cache the JSON Web Key Set (JWKS) from the Clerk JWKS URL.
- The middleware will verify the JWT signature, issuer, and audience.
- The extractor will provide an `Authenticated` principal with the user's `sub`, `email`, and other claims.

### Clerk Webhook Flow

- The `auth-gateway` service will expose a `/clerk/webhooks` endpoint to receive webhooks from Clerk.
- The webhook handler will verify the webhook signature using a shared secret.
- The handler will idempotently upsert user information into the `users` table, mapping the Clerk `sub` to our internal `external_id`.

## Consequences

- **Pros**:
  - Clear separation of concerns.
  - Improved testability and maintainability.
  - Offloading authentication to a managed service reduces complexity.
  - Consistent architecture across all services.
- **Cons**:
  - Can be more verbose for simple services.
  - Requires a good understanding of the architecture to implement correctly.
