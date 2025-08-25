# Projects Service

This service manages projects and their settings.

## Endpoints

-   `POST /projects`: Create a new project.
-   `PUT /projects/{id}/settings`: Update project settings.
-   `GET /projects/{id}`: Get project details.

## Local Development

1.  **Start the database:**

    ```sh
    make dev-up
    ```

2.  **Run migrations:**

    ```sh
    sqlx migrate run --source services/projects/migrations --database-url $DATABASE_URL_PROJECTS
    ```

3.  **Run the service:**

    ```sh
    cargo run -p services/projects
    ```

## Deployment

Deployment is handled by Shuttle.

```sh
cargo shuttle deploy -p services/projects
```
