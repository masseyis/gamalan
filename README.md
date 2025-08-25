# ai-agile

This is a monorepo for a collection of Rust microservices for the ai-agile project.

## Prerequisites

- Rust 1.79+
- Docker and Docker Compose
- Shuttle CLI (`cargo install cargo-shuttle`)

## Local Development

1. **Start the database:**

   ```sh
   make dev-up
   ```

2. **Run migrations:**

   ```sh
   make migrate
   ```

3. **Set up environment variables:**

   Copy `.env.example` to `.env` and fill in the values.

   ```sh
   cp .env.example .env
   ```

4. **Run a service:**

   ```sh
   cargo run -p services/<service-name>
   ```

## Testing

```sh
make test
```

## Coverage

```sh
make coverage
```

## Deployment

Deployment is handled by Shuttle. Each service can be deployed individually.

```sh
# Deploy a specific service
cd services/<service-name>
shuttle deploy
```
