# Auth Gateway Service

This service handles Clerk webhooks for user creation and updates.

## Endpoints

-   `POST /clerk/webhooks`: Handles Clerk webhooks.
-   `GET /health`: Health check.
-   `GET /ready`: Readiness check.

## Local Development

1.  **Start the database:**

    ```sh
    make dev-up
    ```

2.  **Run migrations:**

    ```sh
    sqlx migrate run --source services/auth-gateway/migrations --database-url $DATABASE_URL_AUTH_GATEWAY
    ```

3.  **Run the service:**

    ```sh
    cargo run -p services/auth-gateway
    ```

## Deployment

Deployment is handled by Shuttle.

```sh
cargo shuttle deploy -p services/auth-gateway
```
