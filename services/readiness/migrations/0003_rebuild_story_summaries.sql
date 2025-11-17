-- Migration: Add function to rebuild story analysis summaries from existing task analyses
-- This is the proper CQRS approach: rebuild projections from existing data

-- Function to rebuild a single story's analysis summary
CREATE OR REPLACE FUNCTION rebuild_story_analysis_summary(p_story_id UUID, p_organization_id UUID)
RETURNS VOID AS $$
DECLARE
    v_total_tasks INTEGER;
    v_analyzed_tasks INTEGER;
    v_avg_clarity_score INTEGER;
    v_tasks_ai_ready INTEGER;
    v_tasks_needing_improvement INTEGER;
    v_common_issues TEXT[];
BEGIN
    -- Get task counts
    SELECT COUNT(*)
    INTO v_total_tasks
    FROM tasks
    WHERE story_id = p_story_id
      AND (organization_id = p_organization_id OR (organization_id IS NULL AND p_organization_id IS NULL));

    -- Get analyzed task count and metrics from task_analyses
    SELECT
        COUNT(*),
        CASE WHEN COUNT(*) > 0 THEN AVG(overall_score)::INTEGER ELSE NULL END,
        COUNT(*) FILTER (WHERE overall_score >= 80),
        ARRAY_AGG(DISTINCT unnested_rec) FILTER (WHERE unnested_rec IS NOT NULL)
    INTO
        v_analyzed_tasks,
        v_avg_clarity_score,
        v_tasks_ai_ready,
        v_common_issues
    FROM task_analyses ta
    JOIN tasks t ON ta.task_id = t.id
    LEFT JOIN LATERAL unnest(ta.recommendations) AS unnested_rec ON true
    WHERE t.story_id = p_story_id
      AND ta.organization_id = p_organization_id;

    -- Calculate tasks needing improvement
    v_tasks_needing_improvement := v_analyzed_tasks - v_tasks_ai_ready;

    -- Limit common issues to top 5
    IF array_length(v_common_issues, 1) > 5 THEN
        v_common_issues := v_common_issues[1:5];
    END IF;

    -- Upsert the summary
    INSERT INTO story_analysis_summaries (
        id,
        story_id,
        organization_id,
        total_tasks,
        analyzed_tasks,
        avg_clarity_score,
        tasks_ai_ready,
        tasks_needing_improvement,
        common_issues,
        last_analyzed_at,
        created_at,
        updated_at
    ) VALUES (
        uuid_generate_v4(),
        p_story_id,
        p_organization_id,
        v_total_tasks,
        COALESCE(v_analyzed_tasks, 0),
        v_avg_clarity_score,
        COALESCE(v_tasks_ai_ready, 0),
        COALESCE(v_tasks_needing_improvement, 0),
        COALESCE(v_common_issues, '{}'),
        CASE WHEN v_analyzed_tasks > 0 THEN NOW() ELSE NULL END,
        NOW(),
        NOW()
    )
    ON CONFLICT (story_id, organization_id) DO UPDATE SET
        total_tasks = EXCLUDED.total_tasks,
        analyzed_tasks = EXCLUDED.analyzed_tasks,
        avg_clarity_score = EXCLUDED.avg_clarity_score,
        tasks_ai_ready = EXCLUDED.tasks_ai_ready,
        tasks_needing_improvement = EXCLUDED.tasks_needing_improvement,
        common_issues = EXCLUDED.common_issues,
        last_analyzed_at = EXCLUDED.last_analyzed_at,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to rebuild all story analysis summaries
CREATE OR REPLACE FUNCTION rebuild_all_story_analysis_summaries()
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER := 0;
    story_record RECORD;
BEGIN
    FOR story_record IN
        SELECT DISTINCT s.id AS story_id, s.organization_id
        FROM stories s
        WHERE EXISTS (SELECT 1 FROM tasks t WHERE t.story_id = s.id)
    LOOP
        PERFORM rebuild_story_analysis_summary(
            story_record.story_id,
            story_record.organization_id
        );
        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Comment for documentation
COMMENT ON FUNCTION rebuild_story_analysis_summary(UUID, UUID) IS
    'Rebuild a single story analysis summary projection from existing task analyses. Call when projection is out of sync.';
COMMENT ON FUNCTION rebuild_all_story_analysis_summaries() IS
    'Rebuild all story analysis summary projections. Returns count of stories processed.';
