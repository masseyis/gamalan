# ADR-0005: Shuttle-Managed Database Architecture

**Date:** 2025-09-07  
**Status:** Accepted  
**Supersedes:** Previous external database dependencies  

## Context

Salunga is built as a 100% Shuttle-based backend architecture. During deployment workflow development, there was a regression where external DATABASE_URL secrets were being used instead of relying on Shuttle's managed Postgres databases.

This violates the core architectural principle of having no external infrastructure dependencies beyond Shuttle and creates unnecessary complexity in CI/CD configuration.

## Decision

**We will use only Shuttle-managed databases for all data persistence needs.**

### Implementation Details

1. **Database Provisioning**
   - All services use the `#[Postgres]` annotation to automatically provision managed databases
   - Each service gets its own database instance managed by Shuttle
   - No external database providers (AWS RDS, Neon, etc.) are used

2. **Code Pattern**
   ```rust
   #[shuttle_runtime::main]
   async fn main(
       #[Postgres(local_uri = "postgres://postgres:password@localhost:5432/gamalan")] 
       db_uri: String,
       #[shuttle_runtime::Secrets] secrets: shuttle_runtime::SecretStore,
   ) -> ShuttleAxum {
       // Database connection is automatically managed
       let pool = PgPool::connect(&db_uri).await?;
       // ...
   }
   ```

3. **Local Development**
   - Local development uses the `local_uri` parameter for consistent local testing
   - Production/staging automatically get managed Shuttle databases

4. **Migration Management**
   - Each service maintains its own migrations in the `migrations/` directory
   - Migrations run automatically during deployment

## Consequences

### Positive
- ✅ **Zero External Dependencies**: Complete infrastructure managed by Shuttle
- ✅ **Simplified CI/CD**: No DATABASE_URL secrets needed in workflows
- ✅ **Automatic Scaling**: Shuttle manages database scaling and backups
- ✅ **Cost Efficiency**: No separate database hosting costs
- ✅ **Consistent Environment**: Same database technology across all environments

### Negative
- ⚠️ **Shuttle Lock-in**: Tied to Shuttle's database offerings
- ⚠️ **Limited Database Options**: Must use PostgreSQL (acceptable for our use case)

## Compliance Rules

### ✅ DO
- Use `#[Postgres]` annotation for all database needs
- Rely on Shuttle's automatic database provisioning
- Store only authentication secrets (Clerk) in GitHub Actions

### ❌ DON'T
- Add DATABASE_URL to GitHub Actions workflows
- Use external database providers
- Manually configure database connections in deployment workflows

## Prevention of Regression

This ADR establishes database management as a **permanent architectural decision** that must not be changed without explicit architectural review. 

Any attempt to introduce external database dependencies must:
1. Create a new ADR explaining the technical necessity
2. Document the trade-offs against this decision
3. Get explicit approval from the architecture review process

## References
- [Shuttle Database Documentation](https://docs.shuttle.rs/resources/shared-databases)
- ADR-0001: Overall Architecture Decision
- Related: `services/api-gateway/src/main.rs:18` for implementation example