# Backlog Service

This service manages stories and tasks.

## Endpoints

- `POST /stories`: Create a new story.
- `GET /stories/{id}`: Get story details.
- `PATCH /stories/{id}`: Update a story.
- `DELETE /stories/{id}`: Delete a story.
- `POST /stories/{id}/tasks`: Create a new task for a story.
- `PATCH /stories/{id}/status`: Update the status of a story.

## Local Development

1.  **Start the database:**

    ```sh
    make dev-up
    ```

2.  **Run migrations:**

    ```sh
    sqlx migrate run --source services/backlog/migrations --database-url $DATABASE_URL_BACKLOG
    ```

3.  **Run the service:**

    ```sh
    cargo run -p services/backlog
    ```

## Deployment

Deployment is handled by Shuttle.

```sh
cargo shuttle deploy -p services/backlog
```
