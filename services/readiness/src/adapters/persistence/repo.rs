use crate::adapters::persistence::models::{AcceptanceCriterionRow, ReadinessEvaluationRow};
use crate::application::ports::{
    AcceptanceCriteriaRepository, ReadinessEvaluationRepository, StoryAnalysisSummary,
    StoryAnalysisSummaryRepository, TaskAnalysisRepository, TaskClarityRepository,
    TaskSuggestionRepository,
};
use crate::domain::{
    AcceptanceCriterion, GapType, ReadinessEvaluation, Recommendation, TaskAnalysis,
    TaskClarityAnalysis, TaskSuggestion,
};
use async_trait::async_trait;
use common::AppError;
use event_bus::AcceptanceCriterionRecord;
use serde::Deserialize;
use serde_json::Value;
use sqlx::{PgPool, Row};
use tracing::error;
use uuid::Uuid;

/// Persist acceptance criteria in the shared database pool.
pub async fn create_criteria(
    pool: &PgPool,
    criteria: &[AcceptanceCriterion],
) -> Result<(), AppError> {
    let mut tx = pool.begin().await.map_err(|err| {
        error!(
            error = %err,
            "Failed to begin transaction for acceptance criteria creation"
        );
        AppError::InternalServerError
    })?;

    for criterion in criteria {
        sqlx::query(
            "INSERT INTO criteria (id, story_id, ac_id, given, \"when\", \"then\") \
             VALUES ($1, $2, $3, $4, $5, $6) \
             ON CONFLICT (story_id, ac_id) DO UPDATE SET \
             given = EXCLUDED.given, \"when\" = EXCLUDED.\"when\", \"then\" = EXCLUDED.\"then\"",
        )
        .bind(criterion.id)
        .bind(criterion.story_id)
        .bind(&criterion.ac_id)
        .bind(&criterion.given)
        .bind(&criterion.when)
        .bind(&criterion.then)
        .execute(&mut *tx)
        .await
        .map_err(|err| {
            error!(error = %err, "Failed to upsert acceptance criterion");
            AppError::InternalServerError
        })?;
    }

    tx.commit().await.map_err(|err| {
        error!(
            error = %err,
            "Failed to commit acceptance criteria transaction"
        );
        AppError::InternalServerError
    })?;

    Ok(())
}

pub async fn get_criteria_by_story(
    pool: &PgPool,
    story_id: Uuid,
    organization_id: Option<Uuid>,
) -> Result<Vec<AcceptanceCriterion>, AppError> {
    let rows = sqlx::query_as::<_, AcceptanceCriterionRow>(
        "SELECT c.id, c.story_id, s.organization_id, c.ac_id, c.given, c.\"when\" AS \"when\", c.\"then\" AS \"then\" \
         FROM criteria c \
         JOIN stories s ON s.id = c.story_id \
         WHERE c.story_id = $1 \
           AND ($2::UUID IS NULL OR s.organization_id = $2 OR (s.organization_id IS NULL AND $2 IS NULL)) \
         ORDER BY c.ac_id",
    )
    .bind(story_id)
    .bind(organization_id)
    .fetch_all(pool)
    .await
    .map_err(|err| {
        error!(error = %err, %story_id, "Failed to fetch acceptance criteria rows");
        AppError::InternalServerError
    })?;

    if !rows.is_empty() {
        return Ok(rows.into_iter().map(AcceptanceCriterion::from).collect());
    }

    let json_row = sqlx::query(
        "SELECT organization_id, acceptance_criteria FROM readiness_story_projections WHERE id = $1",
    )
    .bind(story_id)
    .fetch_optional(pool)
    .await
    .map_err(|err| {
        error!(error = %err, %story_id, "Failed to fetch readiness story projection");
        AppError::InternalServerError
    })?;

    if let Some(row) = json_row {
        let value: Value = row.get("acceptance_criteria");
        let projection_org_id: Option<Uuid> = row.get("organization_id");
        let mut criteria =
            match parse_projection_acceptance_criteria(story_id, projection_org_id, &value) {
                Ok(criteria) => criteria,
                Err(err) => {
                    error!(
                        error = %err,
                        %story_id,
                        "Failed to parse acceptance criteria projection"
                    );
                    Vec::new()
                }
            };

        if criteria.is_empty() {
            if let Ok(records) =
                serde_json::from_value::<Vec<AcceptanceCriterionRecord>>(value.clone())
            {
                criteria = records
                    .into_iter()
                    .enumerate()
                    .map(|(index, record)| AcceptanceCriterion {
                        id: record.id,
                        story_id: record.story_id,
                        organization_id: projection_org_id,
                        ac_id: format!("AC{}", index + 1),
                        given: record.given,
                        when: record.when,
                        then: record.then,
                    })
                    .collect();
            }
        }

        return Ok(criteria);
    }

    Ok(vec![])
}

fn parse_projection_acceptance_criteria(
    story_id: Uuid,
    projection_org_id: Option<Uuid>,
    value: &Value,
) -> Result<Vec<AcceptanceCriterion>, serde_json::Error> {
    #[derive(Debug, Deserialize)]
    struct ProjectionAcceptanceCriterion {
        #[serde(default)]
        id: Option<Uuid>,
        #[serde(default, alias = "acId", alias = "ac_id")]
        ac_id: Option<String>,
        #[serde(default)]
        given: Option<String>,
        #[serde(default, alias = "when", alias = "whenClause", alias = "when_clause")]
        when_text: Option<String>,
        #[serde(default, alias = "then", alias = "thenClause", alias = "then_clause")]
        then_text: Option<String>,
    }

    let records: Vec<ProjectionAcceptanceCriterion> = serde_json::from_value(value.clone())?;
    let mut results = Vec::with_capacity(records.len());

    for (index, record) in records.into_iter().enumerate() {
        let id = record.id.unwrap_or_else(Uuid::new_v4);
        let mut ac_id = record
            .ac_id
            .as_ref()
            .map(|raw| raw.trim())
            .filter(|trimmed| !trimmed.is_empty())
            .map(|trimmed| trimmed.to_string());
        if ac_id.is_none() {
            ac_id = Some(id.to_string());
        }
        let ac_id = ac_id.unwrap_or_else(|| format!("AC{}", index + 1));

        let sanitize = |value: Option<String>, fallback: &str| {
            value
                .map(|text| text.trim().to_string())
                .filter(|text| !text.is_empty())
                .unwrap_or_else(|| fallback.to_string())
        };

        results.push(AcceptanceCriterion {
            id,
            story_id,
            organization_id: projection_org_id,
            ac_id,
            given: sanitize(record.given, "Given context pending clarification."),
            when: sanitize(record.when_text, "When condition pending clarification."),
            then: sanitize(record.then_text, "Then outcome pending clarification."),
        });
    }

    Ok(results)
}

pub async fn update_criterion(
    pool: &PgPool,
    criterion: &AcceptanceCriterion,
) -> Result<(), AppError> {
    sqlx::query(
        "UPDATE criteria SET given = $3, \"when\" = $4, \"then\" = $5 \
         WHERE id = $1 AND story_id = $2",
    )
    .bind(criterion.id)
    .bind(criterion.story_id)
    .bind(&criterion.given)
    .bind(&criterion.when)
    .bind(&criterion.then)
    .execute(pool)
    .await
    .map_err(|err| {
        error!(error = %err, %criterion.id, "Failed to update acceptance criterion");
        AppError::InternalServerError
    })?;

    Ok(())
}

pub async fn delete_criteria_by_story(
    pool: &PgPool,
    story_id: Uuid,
    _organization_id: Option<Uuid>,
) -> Result<(), AppError> {
    sqlx::query("DELETE FROM criteria WHERE story_id = $1")
        .bind(story_id)
        .execute(pool)
        .await
        .map_err(|err| {
            error!(error = %err, %story_id, "Failed to delete acceptance criteria for story");
            AppError::InternalServerError
        })?;

    Ok(())
}

pub async fn get_criterion_by_story_and_ac_id(
    pool: &PgPool,
    story_id: Uuid,
    organization_id: Option<Uuid>,
    ac_id: &str,
) -> Result<Option<AcceptanceCriterion>, AppError> {
    let row = sqlx::query_as::<_, AcceptanceCriterionRow>(
        "SELECT c.id, c.story_id, s.organization_id, c.ac_id, c.given, c.\"when\" AS \"when\", c.\"then\" AS \"then\" \
         FROM criteria c \
         JOIN stories s ON s.id = c.story_id \
         WHERE c.story_id = $1 \
           AND ($2::UUID IS NULL OR s.organization_id = $2 OR (s.organization_id IS NULL AND $2 IS NULL)) \
           AND c.ac_id = $3",
    )
    .bind(story_id)
    .bind(organization_id)
    .bind(ac_id)
    .fetch_optional(pool)
    .await
    .map_err(|err| {
        error!(error = %err, %story_id, ac_id = ac_id, "Failed to fetch acceptance criterion");
        AppError::InternalServerError
    })?;

    if let Some(row) = row {
        return Ok(Some(AcceptanceCriterion::from(row)));
    }

    let json_row = sqlx::query(
        "SELECT organization_id, acceptance_criteria FROM readiness_story_projections WHERE id = $1",
    )
    .bind(story_id)
    .fetch_optional(pool)
    .await
    .map_err(|err| {
        error!(error = %err, %story_id, "Failed to fetch readiness story projection");
        AppError::InternalServerError
    })?;

    if let Some(row) = json_row {
        let value: Value = row.get("acceptance_criteria");
        let projection_org_id: Option<Uuid> = row.get("organization_id");
        match parse_projection_acceptance_criteria(story_id, projection_org_id, &value) {
            Ok(criteria) => {
                if let Some(found) = criteria
                    .into_iter()
                    .find(|criterion| criterion.ac_id == ac_id)
                {
                    return Ok(Some(found));
                }
            }
            Err(err) => {
                error!(
                    error = %err,
                    %story_id,
                    "Failed to parse acceptance criteria projection"
                );
            }
        }

        if let Ok(records) = serde_json::from_value::<Vec<AcceptanceCriterionRecord>>(value) {
            for (index, record) in records.into_iter().enumerate() {
                let candidate = AcceptanceCriterion {
                    id: record.id,
                    story_id: record.story_id,
                    organization_id,
                    ac_id: format!("AC{}", index + 1),
                    given: record.given,
                    when: record.when,
                    then: record.then,
                };
                if candidate.ac_id == ac_id {
                    return Ok(Some(candidate));
                }
            }
        }
    }

    Ok(None)
}

pub async fn save_evaluation(pool: &PgPool, eval: &ReadinessEvaluation) -> Result<(), AppError> {
    sqlx::query(
        "INSERT INTO readiness_evals (id, story_id, organization_id, score, missing_items, summary, recommendations) \
         VALUES ($1, $2, $3, $4, $5, $6, $7)",
    )
    .bind(eval.id)
    .bind(eval.story_id)
    .bind(eval.organization_id)
    .bind(eval.score)
    .bind(&eval.missing_items)
    .bind(&eval.summary)
    .bind(&eval.recommendations)
    .execute(pool)
    .await
    .map_err(|err| {
        error!(
            error = %err,
            eval_id = %eval.id,
            story_id = %eval.story_id,
            "Failed to save readiness evaluation"
        );
        AppError::InternalServerError
    })?;

    Ok(())
}

pub async fn get_latest_evaluation(
    pool: &PgPool,
    story_id: Uuid,
    organization_id: Option<Uuid>,
) -> Result<Option<ReadinessEvaluation>, AppError> {
    let row = sqlx::query_as::<_, ReadinessEvaluationRow>(
        "SELECT id, story_id, organization_id, score, missing_items, summary, recommendations FROM readiness_evals \
         WHERE story_id = $1 AND (organization_id = $2 OR ($2 IS NULL AND organization_id IS NULL)) \
         ORDER BY id DESC \
         LIMIT 1",
    )
    .bind(story_id)
    .bind(organization_id)
    .fetch_optional(pool)
    .await
    .map_err(|err| {
        error!(error = %err, %story_id, "Failed to fetch latest readiness evaluation");
        AppError::InternalServerError
    })?;

    Ok(row.map(ReadinessEvaluation::from))
}

#[async_trait]
impl AcceptanceCriteriaRepository for PgPool {
    async fn create_criteria(&self, criteria: &[AcceptanceCriterion]) -> Result<(), AppError> {
        create_criteria(self, criteria).await
    }

    async fn get_criteria_by_story(
        &self,
        story_id: Uuid,
        organization_id: Option<Uuid>,
    ) -> Result<Vec<AcceptanceCriterion>, AppError> {
        get_criteria_by_story(self, story_id, organization_id).await
    }

    async fn update_criterion(&self, criterion: &AcceptanceCriterion) -> Result<(), AppError> {
        update_criterion(self, criterion).await
    }

    async fn delete_criteria_by_story(
        &self,
        story_id: Uuid,
        organization_id: Option<Uuid>,
    ) -> Result<(), AppError> {
        delete_criteria_by_story(self, story_id, organization_id).await
    }

    async fn get_criterion_by_story_and_ac_id(
        &self,
        story_id: Uuid,
        organization_id: Option<Uuid>,
        ac_id: &str,
    ) -> Result<Option<AcceptanceCriterion>, AppError> {
        get_criterion_by_story_and_ac_id(self, story_id, organization_id, ac_id).await
    }
}

#[async_trait]
impl ReadinessEvaluationRepository for PgPool {
    async fn save_evaluation(&self, eval: &ReadinessEvaluation) -> Result<(), AppError> {
        save_evaluation(self, eval).await
    }

    async fn get_latest_evaluation(
        &self,
        story_id: Uuid,
        organization_id: Option<Uuid>,
    ) -> Result<Option<ReadinessEvaluation>, AppError> {
        get_latest_evaluation(self, story_id, organization_id).await
    }
}

#[async_trait]
impl TaskAnalysisRepository for PgPool {
    async fn save_analysis(&self, analysis: &TaskAnalysis) -> Result<(), AppError> {
        // For TaskAnalysis, we need to convert recommendations to TEXT[]
        let recommendation_texts: Vec<String> = analysis
            .recommendations
            .iter()
            .map(|r| r.message.clone())
            .collect();

        // TaskAnalysis uses the old schema approach - we'll use clarity_score, summary, and recommendations
        // Map to the new schema columns as best we can
        let clarity_level = if analysis.clarity_score >= 80 {
            "excellent"
        } else if analysis.clarity_score >= 60 {
            "good"
        } else if analysis.clarity_score >= 40 {
            "fair"
        } else {
            "poor"
        };

        // Create empty dimensions since TaskAnalysis doesn't have them
        let dimensions_json = serde_json::json!({});

        sqlx::query(
            "INSERT INTO task_analyses \
             (id, task_id, organization_id, overall_score, clarity_level, dimensions, recommendations, flagged_terms, created_at) \
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW()) \
             ON CONFLICT (task_id, organization_id) DO UPDATE SET \
             overall_score = EXCLUDED.overall_score, \
             clarity_level = EXCLUDED.clarity_level, \
             dimensions = EXCLUDED.dimensions, \
             recommendations = EXCLUDED.recommendations, \
             flagged_terms = EXCLUDED.flagged_terms, \
             created_at = NOW()",
        )
        .bind(Uuid::new_v4())
        .bind(analysis.task_id)
        .bind(analysis.organization_id)
        .bind(analysis.clarity_score)
        .bind(clarity_level)
        .bind(dimensions_json)
        .bind(&recommendation_texts)
        .bind(&analysis.missing_elements) // Use missing_elements as flagged_terms
        .execute(self)
        .await
        .map_err(|err| {
            error!(
                error = %err,
                task_id = %analysis.task_id,
                "Failed to save task analysis"
            );
            AppError::InternalServerError
        })?;

        Ok(())
    }

    async fn get_latest_analysis(
        &self,
        task_id: Uuid,
        organization_id: Option<Uuid>,
    ) -> Result<Option<TaskAnalysis>, AppError> {
        #[derive(sqlx::FromRow)]
        struct TaskAnalysisRow {
            task_id: Uuid,
            organization_id: Option<Uuid>,
            overall_score: i32,
            recommendations: Vec<String>,
            flagged_terms: Vec<String>,
        }

        let row = sqlx::query_as::<_, TaskAnalysisRow>(
            "SELECT task_id, organization_id, overall_score, recommendations, flagged_terms \
             FROM task_analyses \
             WHERE task_id = $1 AND (organization_id = $2 OR ($2 IS NULL AND organization_id IS NULL)) \
             ORDER BY created_at DESC \
             LIMIT 1",
        )
        .bind(task_id)
        .bind(organization_id)
        .fetch_optional(self)
        .await
        .map_err(|err| {
            error!(error = %err, %task_id, "Failed to fetch latest task analysis");
            AppError::InternalServerError
        })?;

        if let Some(row) = row {
            // Convert TEXT[] back to Vec<Recommendation>
            let recommendations: Vec<Recommendation> = row
                .recommendations
                .into_iter()
                .map(|message| Recommendation {
                    gap_type: GapType::VagueLanguage, // Default gap type since we lost this info
                    message,
                    specific_suggestions: vec![],
                    ac_references: vec![],
                })
                .collect();

            Ok(Some(TaskAnalysis {
                id: Uuid::new_v4(), // Generate new ID since it's not stored
                task_id: row.task_id,
                story_id: Uuid::nil(), // Not stored in new schema
                organization_id: row.organization_id,
                clarity_score: row.overall_score,
                missing_elements: row.flagged_terms,
                summary: "Stored analysis".to_string(), // Default summary
                recommendations,
            }))
        } else {
            Ok(None)
        }
    }
}

/// TaskClarityRepository implementation for PgPool
///
/// AC Reference: e0261453-8f72-4b08-8290-d8fb7903c869 (clarity scoring)
#[async_trait]
impl TaskClarityRepository for PgPool {
    async fn save_analysis(
        &self,
        analysis: &TaskClarityAnalysis,
        organization_id: Uuid,
    ) -> Result<(), AppError> {
        // Serialize dimensions, recommendations, and flagged terms
        let dimensions_json = serde_json::to_value(&analysis.dimensions).map_err(|err| {
            error!(error = %err, task_id = %analysis.task_id, "Failed to serialize dimensions");
            AppError::InternalServerError
        })?;

        sqlx::query(
            "INSERT INTO task_analyses \
             (id, task_id, organization_id, overall_score, clarity_level, dimensions, recommendations, flagged_terms, created_at) \
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW()) \
             ON CONFLICT (task_id, organization_id) DO UPDATE SET \
             overall_score = EXCLUDED.overall_score, \
             clarity_level = EXCLUDED.clarity_level, \
             dimensions = EXCLUDED.dimensions, \
             recommendations = EXCLUDED.recommendations, \
             flagged_terms = EXCLUDED.flagged_terms, \
             created_at = NOW()",
        )
        .bind(Uuid::new_v4())
        .bind(analysis.task_id)
        .bind(organization_id)
        .bind(analysis.overall_score as i32)
        .bind(format!("{:?}", analysis.level).to_lowercase())
        .bind(dimensions_json)
        .bind(&analysis.recommendations)
        .bind(&analysis.flagged_terms)
        .execute(self)
        .await
        .map_err(|err| {
            error!(
                error = %err,
                task_id = %analysis.task_id,
                "Failed to save task clarity analysis"
            );
            AppError::InternalServerError
        })?;

        Ok(())
    }

    async fn get_latest_analysis(
        &self,
        task_id: Uuid,
        organization_id: Uuid,
    ) -> Result<Option<TaskClarityAnalysis>, AppError> {
        let row = sqlx::query(
            "SELECT overall_score, clarity_level, dimensions, recommendations, flagged_terms, created_at \
             FROM task_analyses \
             WHERE task_id = $1 AND organization_id = $2 \
             ORDER BY created_at DESC \
             LIMIT 1",
        )
        .bind(task_id)
        .bind(organization_id)
        .fetch_optional(self)
        .await
        .map_err(|err| {
            error!(error = %err, %task_id, "Failed to fetch latest task clarity analysis");
            AppError::InternalServerError
        })?;

        if let Some(row) = row {
            let overall_score: i32 = row.get("overall_score");
            let dimensions_json: Value = row.get("dimensions");
            let recommendations: Vec<String> = row.get("recommendations");
            let flagged_terms: Vec<String> = row.get("flagged_terms");

            let dimensions = serde_json::from_value(dimensions_json).map_err(|err| {
                error!(error = %err, %task_id, "Failed to deserialize dimensions");
                AppError::InternalServerError
            })?;

            Ok(Some(TaskClarityAnalysis::new(
                task_id,
                overall_score as u8,
                dimensions,
                recommendations,
                flagged_terms,
            )))
        } else {
            Ok(None)
        }
    }

    async fn get_story_analyses(
        &self,
        story_id: Uuid,
        organization_id: Uuid,
    ) -> Result<Vec<TaskClarityAnalysis>, AppError> {
        // Get all tasks for the story first
        let task_rows = sqlx::query(
            "SELECT t.id as task_id \
             FROM readiness_task_projections t \
             WHERE t.story_id = $1 AND t.organization_id = $2",
        )
        .bind(story_id)
        .bind(organization_id)
        .fetch_all(self)
        .await
        .map_err(|err| {
            error!(error = %err, %story_id, "Failed to fetch tasks for story");
            AppError::InternalServerError
        })?;

        let mut analyses = Vec::new();
        for task_row in task_rows {
            let task_id: Uuid = task_row.get("task_id");
            if let Some(analysis) =
                TaskClarityRepository::get_latest_analysis(self, task_id, organization_id).await?
            {
                analyses.push(analysis);
            }
        }

        Ok(analyses)
    }
}

/// StoryAnalysisSummaryRepository implementation for PgPool
///
/// AC Reference: e0261453-8f72-4b08-8290-d8fb7903c869 (clarity scoring)
#[async_trait]
impl StoryAnalysisSummaryRepository for PgPool {
    async fn get_summary(
        &self,
        story_id: Uuid,
        organization_id: Uuid,
    ) -> Result<Option<StoryAnalysisSummary>, AppError> {
        let row = sqlx::query(
            "SELECT story_id, organization_id, total_tasks, analyzed_tasks, \
             avg_clarity_score, tasks_ai_ready, tasks_needing_improvement, common_issues \
             FROM story_analysis_summaries \
             WHERE story_id = $1 AND organization_id = $2",
        )
        .bind(story_id)
        .bind(organization_id)
        .fetch_optional(self)
        .await
        .map_err(|err| {
            error!(error = %err, %story_id, "Failed to fetch story analysis summary");
            AppError::InternalServerError
        })?;

        if let Some(row) = row {
            Ok(Some(StoryAnalysisSummary {
                story_id: row.get("story_id"),
                organization_id: row.get("organization_id"),
                total_tasks: row.get("total_tasks"),
                analyzed_tasks: row.get("analyzed_tasks"),
                avg_clarity_score: row.get("avg_clarity_score"),
                tasks_ai_ready: row.get("tasks_ai_ready"),
                tasks_needing_improvement: row.get("tasks_needing_improvement"),
                common_issues: row.get("common_issues"),
            }))
        } else {
            Ok(None)
        }
    }

    async fn update_summary(&self, story_id: Uuid, organization_id: Uuid) -> Result<(), AppError> {
        // Calculate summary from task analyses
        let analyses =
            TaskClarityRepository::get_story_analyses(self, story_id, organization_id).await?;

        let total_tasks = analyses.len() as i32;
        let analyzed_tasks = total_tasks; // All fetched tasks have analyses
        let avg_clarity_score = if !analyses.is_empty() {
            Some(analyses.iter().map(|a| a.overall_score as i32).sum::<i32>() / total_tasks)
        } else {
            None
        };

        let tasks_ai_ready = analyses.iter().filter(|a| a.is_ai_ready()).count() as i32;
        let tasks_needing_improvement = total_tasks - tasks_ai_ready;

        // Extract common issues from recommendations
        let mut issue_counts: std::collections::HashMap<String, usize> =
            std::collections::HashMap::new();
        for analysis in &analyses {
            for recommendation in &analysis.recommendations {
                *issue_counts.entry(recommendation.clone()).or_insert(0) += 1;
            }
        }

        let mut common_issues: Vec<_> = issue_counts.into_iter().collect();
        common_issues.sort_by(|a, b| b.1.cmp(&a.1));
        let common_issues: Vec<String> = common_issues
            .into_iter()
            .take(5)
            .map(|(issue, _)| issue)
            .collect();

        // Upsert summary
        sqlx::query(
            "INSERT INTO story_analysis_summaries \
             (id, story_id, organization_id, total_tasks, analyzed_tasks, avg_clarity_score, \
              tasks_ai_ready, tasks_needing_improvement, common_issues, last_analyzed_at, created_at, updated_at) \
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW(), NOW()) \
             ON CONFLICT (story_id, organization_id) DO UPDATE SET \
             total_tasks = EXCLUDED.total_tasks, \
             analyzed_tasks = EXCLUDED.analyzed_tasks, \
             avg_clarity_score = EXCLUDED.avg_clarity_score, \
             tasks_ai_ready = EXCLUDED.tasks_ai_ready, \
             tasks_needing_improvement = EXCLUDED.tasks_needing_improvement, \
             common_issues = EXCLUDED.common_issues, \
             last_analyzed_at = NOW(), \
             updated_at = NOW()",
        )
        .bind(Uuid::new_v4())
        .bind(story_id)
        .bind(organization_id)
        .bind(total_tasks)
        .bind(analyzed_tasks)
        .bind(avg_clarity_score)
        .bind(tasks_ai_ready)
        .bind(tasks_needing_improvement)
        .bind(&common_issues)
        .execute(self)
        .await
        .map_err(|err| {
            error!(
                error = %err,
                %story_id,
                "Failed to update story analysis summary"
            );
            AppError::InternalServerError
        })?;

        Ok(())
    }
}

/// TaskSuggestionRepository implementation for PgPool
///
/// AC Reference: e0261453-8f72-4b08-8290-d8fb7903c869 (clarity scoring)
/// AC Reference: 5649e91e-043f-4097-916b-9907620bff3e (GitHub integration)
#[async_trait]
impl TaskSuggestionRepository for PgPool {
    async fn save_suggestions(
        &self,
        story_id: Uuid,
        organization_id: Uuid,
        batch_id: Uuid,
        suggestions: &[TaskSuggestion],
    ) -> Result<(), AppError> {
        let mut tx = self.begin().await.map_err(|err| {
            error!(
                error = %err,
                %story_id,
                "Failed to begin transaction for task suggestions"
            );
            AppError::InternalServerError
        })?;

        for suggestion in suggestions {
            sqlx::query(
                "INSERT INTO task_suggestions \
                 (id, story_id, organization_id, suggestion_batch_id, title, description, \
                  acceptance_criteria_refs, estimated_hours, relevant_files, confidence, status, created_at) \
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending', NOW())",
            )
            .bind(Uuid::new_v4())
            .bind(story_id)
            .bind(organization_id)
            .bind(batch_id)
            .bind(&suggestion.title)
            .bind(&suggestion.description)
            .bind(&suggestion.acceptance_criteria_refs)
            .bind(suggestion.estimated_hours.map(|h| h as i32))
            .bind(&suggestion.relevant_files)
            .bind(suggestion.confidence)
            .execute(&mut *tx)
            .await
            .map_err(|err| {
                error!(error = %err, %story_id, "Failed to save task suggestion");
                AppError::InternalServerError
            })?;
        }

        tx.commit().await.map_err(|err| {
            error!(
                error = %err,
                %story_id,
                "Failed to commit task suggestions transaction"
            );
            AppError::InternalServerError
        })?;

        Ok(())
    }

    async fn get_pending_suggestions(
        &self,
        story_id: Uuid,
        organization_id: Uuid,
    ) -> Result<Vec<TaskSuggestion>, AppError> {
        let rows = sqlx::query(
            "SELECT id, title, description, acceptance_criteria_refs, estimated_hours, \
             relevant_files, confidence \
             FROM task_suggestions \
             WHERE story_id = $1 AND organization_id = $2 AND status = 'pending' \
             ORDER BY confidence DESC, created_at DESC",
        )
        .bind(story_id)
        .bind(organization_id)
        .fetch_all(self)
        .await
        .map_err(|err| {
            error!(error = %err, %story_id, "Failed to fetch pending task suggestions");
            AppError::InternalServerError
        })?;

        let mut suggestions = Vec::new();
        for row in rows {
            let estimated_hours: Option<i32> = row.get("estimated_hours");
            suggestions.push(TaskSuggestion::new(
                row.get("title"),
                row.get("description"),
                row.get("acceptance_criteria_refs"),
                estimated_hours.map(|h| h as u32),
                row.get("relevant_files"),
                row.get("confidence"),
            ));
        }

        Ok(suggestions)
    }

    async fn update_suggestion_status(
        &self,
        suggestion_id: Uuid,
        status: &str,
        reviewed_by: &str,
    ) -> Result<(), AppError> {
        let result = sqlx::query(
            "UPDATE task_suggestions \
             SET status = $2, reviewed_at = NOW(), reviewed_by = $3 \
             WHERE id = $1",
        )
        .bind(suggestion_id)
        .bind(status)
        .bind(reviewed_by)
        .execute(self)
        .await
        .map_err(|err| {
            error!(
                error = %err,
                %suggestion_id,
                "Failed to update task suggestion status"
            );
            AppError::InternalServerError
        })?;

        if result.rows_affected() == 0 {
            return Err(AppError::NotFound(format!(
                "Task suggestion {} not found",
                suggestion_id
            )));
        }

        Ok(())
    }
}
