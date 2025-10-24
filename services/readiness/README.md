# Readiness Service

This service evaluates the readiness of stories and generates BDD criteria.

## Endpoints

- `POST /readiness/{storyId}/evaluate`: Evaluate the readiness of a story.
- `POST /criteria/{storyId}/generate`: Generate BDD criteria for a story.
- `GET /criteria/{storyId}`: Get the BDD criteria for a story.

## Local Development

1.  **Start the database:**

    ```sh
    make dev-up
    ```

2.  **Run migrations:**

    ```sh
    sqlx migrate run --source services/readiness/migrations --database-url $DATABASE_URL_READINESS
    ```

3.  **Run the service:**

    ```sh
    cargo run -p services/readiness
    ```

## Deployment

Deployment is handled by Shuttle.

```sh
cargo shuttle deploy -p services/readiness
```
