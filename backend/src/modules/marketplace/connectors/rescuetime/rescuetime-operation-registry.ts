// Generated from RescueTime's official API documentation on 2026-07-15.
export type RescueTimeOperation = {
  id: string;
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  pathParameters: readonly string[];
  queryParameters: readonly string[];
  bodyAllowed: boolean;
  source: string;
};

export const RESCUETIME_OPERATIONS = [
  {
    "id": "delete_resource_alerts_id",
    "method": "DELETE",
    "path": "/api/resource/alerts/{id}",
    "pathParameters": [
      "id"
    ],
    "queryParameters": [],
    "bodyAllowed": false,
    "source": "https://www.rescuetime.com/api-docs/alerts-and-goals"
  },
  {
    "id": "delete_resource_goals_id",
    "method": "DELETE",
    "path": "/api/resource/goals/{id}",
    "pathParameters": [
      "id"
    ],
    "queryParameters": [],
    "bodyAllowed": false,
    "source": "https://www.rescuetime.com/api-docs/alerts-and-goals"
  },
  {
    "id": "delete_resource_labeled_time_extra_works_id",
    "method": "DELETE",
    "path": "/api/resource/labeled_time_extra_works/{id}",
    "pathParameters": [
      "id"
    ],
    "queryParameters": [],
    "bodyAllowed": false,
    "source": "https://www.rescuetime.com/api-docs/time-tracking"
  },
  {
    "id": "delete_resource_labeled_time_focus_sessions_id",
    "method": "DELETE",
    "path": "/api/resource/labeled_time_focus_sessions/{id}",
    "pathParameters": [
      "id"
    ],
    "queryParameters": [],
    "bodyAllowed": false,
    "source": "https://www.rescuetime.com/api-docs/focus-sessions"
  },
  {
    "id": "delete_resource_labeled_time_project_times_id",
    "method": "DELETE",
    "path": "/api/resource/labeled_time_project_times/{id}",
    "pathParameters": [
      "id"
    ],
    "queryParameters": [],
    "bodyAllowed": false,
    "source": "https://www.rescuetime.com/api-docs/projects-and-tasks"
  },
  {
    "id": "delete_resource_labeled_time_project_times_prune_unreviewed",
    "method": "DELETE",
    "path": "/api/resource/labeled_time_project_times/prune_unreviewed",
    "pathParameters": [],
    "queryParameters": [
      "date",
      "finalize"
    ],
    "bodyAllowed": false,
    "source": "https://www.rescuetime.com/api-docs/projects-and-tasks"
  },
  {
    "id": "delete_resource_personalizers_id",
    "method": "DELETE",
    "path": "/api/resource/personalizers/{id}",
    "pathParameters": [
      "id"
    ],
    "queryParameters": [],
    "bodyAllowed": false,
    "source": "https://www.rescuetime.com/api-docs/personalization"
  },
  {
    "id": "delete_resource_profile_entities_id",
    "method": "DELETE",
    "path": "/api/resource/profile_entities/{id}",
    "pathParameters": [
      "id"
    ],
    "queryParameters": [],
    "bodyAllowed": false,
    "source": "https://www.rescuetime.com/api-docs/personalization"
  },
  {
    "id": "delete_resource_schedules_id",
    "method": "DELETE",
    "path": "/api/resource/schedules/{id}",
    "pathParameters": [
      "id"
    ],
    "queryParameters": [],
    "bodyAllowed": false,
    "source": "https://www.rescuetime.com/api-docs/alerts-and-goals"
  },
  {
    "id": "delete_resource_tasks_id",
    "method": "DELETE",
    "path": "/api/resource/tasks/{id}",
    "pathParameters": [
      "id"
    ],
    "queryParameters": [],
    "bodyAllowed": false,
    "source": "https://www.rescuetime.com/api-docs/projects-and-tasks"
  },
  {
    "id": "delete_resource_timeline_activities",
    "method": "DELETE",
    "path": "/api/resource/timeline/activities",
    "pathParameters": [],
    "queryParameters": [
      "start_time",
      "end_time"
    ],
    "bodyAllowed": false,
    "source": "https://www.rescuetime.com/api-docs/time-tracking"
  },
  {
    "id": "delete_resource_timesheet_finalized_days_id",
    "method": "DELETE",
    "path": "/api/resource/timesheet_finalized_days/{id}",
    "pathParameters": [
      "id"
    ],
    "queryParameters": [],
    "bodyAllowed": false,
    "source": "https://www.rescuetime.com/api-docs/projects-and-tasks"
  },
  {
    "id": "delete_resource_timesheets_clients_id",
    "method": "DELETE",
    "path": "/api/resource/timesheets_clients/{id}",
    "pathParameters": [
      "id"
    ],
    "queryParameters": [],
    "bodyAllowed": false,
    "source": "https://www.rescuetime.com/api-docs/projects-and-tasks"
  },
  {
    "id": "delete_resource_v2_projects_id",
    "method": "DELETE",
    "path": "/api/resource/v2_projects/{id}",
    "pathParameters": [
      "id"
    ],
    "queryParameters": [],
    "bodyAllowed": false,
    "source": "https://www.rescuetime.com/api-docs/projects-and-tasks"
  },
  {
    "id": "delete_resource_web_notifications_id",
    "method": "DELETE",
    "path": "/api/resource/web_notifications/{id}",
    "pathParameters": [
      "id"
    ],
    "queryParameters": [],
    "bodyAllowed": false,
    "source": "https://www.rescuetime.com/api-docs/notifications"
  },
  {
    "id": "get_oauth_alerts_feed",
    "method": "GET",
    "path": "/api/oauth/alerts_feed",
    "pathParameters": [],
    "queryParameters": [
      "by",
      "taxonomy",
      "interval",
      "restrict_begin",
      "restrict_end",
      "restrict_kind",
      "restrict_thing",
      "restrict_thingy",
      "perspective",
      "resolution_time",
      "format",
      "op",
      "highlight_date",
      "description",
      "source",
      "duration",
      "activity_name",
      "activity_category",
      "activity_start_time",
      "activity_end_time"
    ],
    "bodyAllowed": false,
    "source": "https://www.rescuetime.com/rtx/developers"
  },
  {
    "id": "get_oauth_category_data",
    "method": "GET",
    "path": "/api/oauth/category_data",
    "pathParameters": [],
    "queryParameters": [
      "by",
      "taxonomy",
      "interval",
      "restrict_begin",
      "restrict_end",
      "restrict_kind",
      "restrict_thing",
      "restrict_thingy",
      "perspective",
      "resolution_time",
      "format",
      "op",
      "highlight_date",
      "description",
      "source",
      "duration",
      "activity_name",
      "activity_category",
      "activity_start_time",
      "activity_end_time"
    ],
    "bodyAllowed": false,
    "source": "https://www.rescuetime.com/rtx/developers"
  },
  {
    "id": "get_oauth_daily_summary_feed",
    "method": "GET",
    "path": "/api/oauth/daily_summary_feed",
    "pathParameters": [],
    "queryParameters": [
      "by",
      "taxonomy",
      "interval",
      "restrict_begin",
      "restrict_end",
      "restrict_kind",
      "restrict_thing",
      "restrict_thingy",
      "perspective",
      "resolution_time",
      "format",
      "op",
      "highlight_date",
      "description",
      "source",
      "duration",
      "activity_name",
      "activity_category",
      "activity_start_time",
      "activity_end_time"
    ],
    "bodyAllowed": false,
    "source": "https://www.rescuetime.com/rtx/developers"
  },
  {
    "id": "get_oauth_data",
    "method": "GET",
    "path": "/api/oauth/data",
    "pathParameters": [],
    "queryParameters": [
      "by",
      "taxonomy",
      "interval",
      "restrict_begin",
      "restrict_end",
      "restrict_kind",
      "restrict_thing",
      "restrict_thingy",
      "perspective",
      "resolution_time",
      "format",
      "op",
      "highlight_date",
      "description",
      "source",
      "duration",
      "activity_name",
      "activity_category",
      "activity_start_time",
      "activity_end_time"
    ],
    "bodyAllowed": false,
    "source": "https://www.rescuetime.com/rtx/developers"
  },
  {
    "id": "get_oauth_focustime_ended_feed",
    "method": "GET",
    "path": "/api/oauth/focustime_ended_feed",
    "pathParameters": [],
    "queryParameters": [
      "by",
      "taxonomy",
      "interval",
      "restrict_begin",
      "restrict_end",
      "restrict_kind",
      "restrict_thing",
      "restrict_thingy",
      "perspective",
      "resolution_time",
      "format",
      "op",
      "highlight_date",
      "description",
      "source",
      "duration",
      "activity_name",
      "activity_category",
      "activity_start_time",
      "activity_end_time"
    ],
    "bodyAllowed": false,
    "source": "https://www.rescuetime.com/rtx/developers"
  },
  {
    "id": "get_oauth_focustime_started_feed",
    "method": "GET",
    "path": "/api/oauth/focustime_started_feed",
    "pathParameters": [],
    "queryParameters": [
      "by",
      "taxonomy",
      "interval",
      "restrict_begin",
      "restrict_end",
      "restrict_kind",
      "restrict_thing",
      "restrict_thingy",
      "perspective",
      "resolution_time",
      "format",
      "op",
      "highlight_date",
      "description",
      "source",
      "duration",
      "activity_name",
      "activity_category",
      "activity_start_time",
      "activity_end_time"
    ],
    "bodyAllowed": false,
    "source": "https://www.rescuetime.com/rtx/developers"
  },
  {
    "id": "get_oauth_highlights_feed",
    "method": "GET",
    "path": "/api/oauth/highlights_feed",
    "pathParameters": [],
    "queryParameters": [
      "by",
      "taxonomy",
      "interval",
      "restrict_begin",
      "restrict_end",
      "restrict_kind",
      "restrict_thing",
      "restrict_thingy",
      "perspective",
      "resolution_time",
      "format",
      "op",
      "highlight_date",
      "description",
      "source",
      "duration",
      "activity_name",
      "activity_category",
      "activity_start_time",
      "activity_end_time"
    ],
    "bodyAllowed": false,
    "source": "https://www.rescuetime.com/rtx/developers"
  },
  {
    "id": "get_oauth_overview_data",
    "method": "GET",
    "path": "/api/oauth/overview_data",
    "pathParameters": [],
    "queryParameters": [
      "by",
      "taxonomy",
      "interval",
      "restrict_begin",
      "restrict_end",
      "restrict_kind",
      "restrict_thing",
      "restrict_thingy",
      "perspective",
      "resolution_time",
      "format",
      "op",
      "highlight_date",
      "description",
      "source",
      "duration",
      "activity_name",
      "activity_category",
      "activity_start_time",
      "activity_end_time"
    ],
    "bodyAllowed": false,
    "source": "https://www.rescuetime.com/rtx/developers"
  },
  {
    "id": "get_oauth_productivity_data",
    "method": "GET",
    "path": "/api/oauth/productivity_data",
    "pathParameters": [],
    "queryParameters": [
      "by",
      "taxonomy",
      "interval",
      "restrict_begin",
      "restrict_end",
      "restrict_kind",
      "restrict_thing",
      "restrict_thingy",
      "perspective",
      "resolution_time",
      "format",
      "op",
      "highlight_date",
      "description",
      "source",
      "duration",
      "activity_name",
      "activity_category",
      "activity_start_time",
      "activity_end_time"
    ],
    "bodyAllowed": false,
    "source": "https://www.rescuetime.com/rtx/developers"
  },
  {
    "id": "get_resource_accounts",
    "method": "GET",
    "path": "/api/resource/accounts",
    "pathParameters": [],
    "queryParameters": [],
    "bodyAllowed": false,
    "source": "https://www.rescuetime.com/api-docs/users-and-accounts"
  },
  {
    "id": "get_resource_accounts_id",
    "method": "GET",
    "path": "/api/resource/accounts/{id}",
    "pathParameters": [
      "id"
    ],
    "queryParameters": [],
    "bodyAllowed": false,
    "source": "https://www.rescuetime.com/api-docs/users-and-accounts"
  },
  {
    "id": "get_resource_alerts",
    "method": "GET",
    "path": "/api/resource/alerts",
    "pathParameters": [],
    "queryParameters": [],
    "bodyAllowed": false,
    "source": "https://www.rescuetime.com/api-docs/alerts-and-goals"
  },
  {
    "id": "get_resource_calendar_events",
    "method": "GET",
    "path": "/api/resource/calendar_events",
    "pathParameters": [],
    "queryParameters": [
      "date",
      "dt_start",
      "dt_end"
    ],
    "bodyAllowed": false,
    "source": "https://www.rescuetime.com/api-docs/calendar"
  },
  {
    "id": "get_resource_calendar_events_id",
    "method": "GET",
    "path": "/api/resource/calendar_events/{id}",
    "pathParameters": [
      "id"
    ],
    "queryParameters": [],
    "bodyAllowed": false,
    "source": "https://www.rescuetime.com/api-docs/calendar"
  },
  {
    "id": "get_resource_calendar_events_meetings",
    "method": "GET",
    "path": "/api/resource/calendar_events/meetings",
    "pathParameters": [],
    "queryParameters": [
      "date",
      "dt_start",
      "dt_end"
    ],
    "bodyAllowed": false,
    "source": "https://www.rescuetime.com/api-docs/calendar"
  },
  {
    "id": "get_resource_categories",
    "method": "GET",
    "path": "/api/resource/categories",
    "pathParameters": [],
    "queryParameters": [],
    "bodyAllowed": false,
    "source": "https://www.rescuetime.com/api-docs/taxonomies"
  },
  {
    "id": "get_resource_categories_id",
    "method": "GET",
    "path": "/api/resource/categories/{id}",
    "pathParameters": [
      "id"
    ],
    "queryParameters": [],
    "bodyAllowed": false,
    "source": "https://www.rescuetime.com/api-docs/taxonomies"
  },
  {
    "id": "get_resource_daily_user_summaries",
    "method": "GET",
    "path": "/api/resource/daily_user_summaries",
    "pathParameters": [],
    "queryParameters": [
      "start_date",
      "end_date",
      "verbose"
    ],
    "bodyAllowed": false,
    "source": "https://www.rescuetime.com/api-docs/time-tracking"
  },
  {
    "id": "get_resource_device_types",
    "method": "GET",
    "path": "/api/resource/device_types",
    "pathParameters": [],
    "queryParameters": [],
    "bodyAllowed": false,
    "source": "https://www.rescuetime.com/api-docs/taxonomies"
  },
  {
    "id": "get_resource_devices",
    "method": "GET",
    "path": "/api/resource/devices",
    "pathParameters": [],
    "queryParameters": [
      "all",
      "active_since"
    ],
    "bodyAllowed": false,
    "source": "https://www.rescuetime.com/api-docs/devices"
  },
  {
    "id": "get_resource_devices_id",
    "method": "GET",
    "path": "/api/resource/devices/{id}",
    "pathParameters": [
      "id"
    ],
    "queryParameters": [],
    "bodyAllowed": false,
    "source": "https://www.rescuetime.com/api-docs/devices"
  },
  {
    "id": "get_resource_focus_buddy_count",
    "method": "GET",
    "path": "/api/resource/focus/buddy_count",
    "pathParameters": [],
    "queryParameters": [],
    "bodyAllowed": false,
    "source": "https://www.rescuetime.com/api-docs/focus-sessions"
  },
  {
    "id": "get_resource_goals",
    "method": "GET",
    "path": "/api/resource/goals",
    "pathParameters": [],
    "queryParameters": [
      "collect"
    ],
    "bodyAllowed": false,
    "source": "https://www.rescuetime.com/api-docs/alerts-and-goals"
  },
  {
    "id": "get_resource_labeled_time_extra_works",
    "method": "GET",
    "path": "/api/resource/labeled_time_extra_works",
    "pathParameters": [],
    "queryParameters": [
      "collect",
      "start_time",
      "end_time",
      "date"
    ],
    "bodyAllowed": false,
    "source": "https://www.rescuetime.com/api-docs/time-tracking"
  },
  {
    "id": "get_resource_labeled_time_focus_sessions",
    "method": "GET",
    "path": "/api/resource/labeled_time_focus_sessions",
    "pathParameters": [],
    "queryParameters": [
      "collect",
      "start_time",
      "end_time",
      "date",
      "timer_completed"
    ],
    "bodyAllowed": false,
    "source": "https://www.rescuetime.com/api-docs/focus-sessions"
  },
  {
    "id": "get_resource_labeled_time_offline_focus_works",
    "method": "GET",
    "path": "/api/resource/labeled_time_offline_focus_works",
    "pathParameters": [],
    "queryParameters": [],
    "bodyAllowed": false,
    "source": "https://www.rescuetime.com/api-docs/time-tracking"
  },
  {
    "id": "get_resource_labeled_time_offline_focus_works_id",
    "method": "GET",
    "path": "/api/resource/labeled_time_offline_focus_works/{id}",
    "pathParameters": [
      "id"
    ],
    "queryParameters": [],
    "bodyAllowed": false,
    "source": "https://www.rescuetime.com/api-docs/time-tracking"
  },
  {
    "id": "get_resource_labeled_time_project_times",
    "method": "GET",
    "path": "/api/resource/labeled_time_project_times",
    "pathParameters": [],
    "queryParameters": [
      "collect",
      "start_time",
      "end_time",
      "date",
      "job_id",
      "force"
    ],
    "bodyAllowed": false,
    "source": "https://www.rescuetime.com/api-docs/projects-and-tasks"
  },
  {
    "id": "get_resource_labeled_time_project_times_unreviewed_days",
    "method": "GET",
    "path": "/api/resource/labeled_time_project_times/unreviewed_days",
    "pathParameters": [],
    "queryParameters": [],
    "bodyAllowed": false,
    "source": "https://www.rescuetime.com/api-docs/projects-and-tasks"
  },
  {
    "id": "get_resource_organizations",
    "method": "GET",
    "path": "/api/resource/organizations",
    "pathParameters": [],
    "queryParameters": [],
    "bodyAllowed": false,
    "source": "https://www.rescuetime.com/api-docs/users-and-accounts"
  },
  {
    "id": "get_resource_organizations_id",
    "method": "GET",
    "path": "/api/resource/organizations/{id}",
    "pathParameters": [
      "id"
    ],
    "queryParameters": [],
    "bodyAllowed": false,
    "source": "https://www.rescuetime.com/api-docs/users-and-accounts"
  },
  {
    "id": "get_resource_organizations_managed_teams",
    "method": "GET",
    "path": "/api/resource/organizations/managed_teams",
    "pathParameters": [],
    "queryParameters": [],
    "bodyAllowed": false,
    "source": "https://www.rescuetime.com/api-docs/users-and-accounts"
  },
  {
    "id": "get_resource_organizations_managed_users",
    "method": "GET",
    "path": "/api/resource/organizations/managed_users",
    "pathParameters": [],
    "queryParameters": [],
    "bodyAllowed": false,
    "source": "https://www.rescuetime.com/api-docs/users-and-accounts"
  },
  {
    "id": "get_resource_organizations_team_members_team_id",
    "method": "GET",
    "path": "/api/resource/organizations/team_members/{team_id}",
    "pathParameters": [
      "team_id"
    ],
    "queryParameters": [],
    "bodyAllowed": false,
    "source": "https://www.rescuetime.com/api-docs/users-and-accounts"
  },
  {
    "id": "get_resource_organizations_teams",
    "method": "GET",
    "path": "/api/resource/organizations/teams",
    "pathParameters": [],
    "queryParameters": [],
    "bodyAllowed": false,
    "source": "https://www.rescuetime.com/api-docs/users-and-accounts"
  },
  {
    "id": "get_resource_overviews",
    "method": "GET",
    "path": "/api/resource/overviews",
    "pathParameters": [],
    "queryParameters": [],
    "bodyAllowed": false,
    "source": "https://www.rescuetime.com/api-docs/taxonomies"
  },
  {
    "id": "get_resource_overviews_id",
    "method": "GET",
    "path": "/api/resource/overviews/{id}",
    "pathParameters": [
      "id"
    ],
    "queryParameters": [],
    "bodyAllowed": false,
    "source": "https://www.rescuetime.com/api-docs/taxonomies"
  },
  {
    "id": "get_resource_personalizers",
    "method": "GET",
    "path": "/api/resource/personalizers",
    "pathParameters": [],
    "queryParameters": [],
    "bodyAllowed": false,
    "source": "https://www.rescuetime.com/api-docs/personalization"
  },
  {
    "id": "get_resource_personalizers_id",
    "method": "GET",
    "path": "/api/resource/personalizers/{id}",
    "pathParameters": [
      "id"
    ],
    "queryParameters": [],
    "bodyAllowed": false,
    "source": "https://www.rescuetime.com/api-docs/personalization"
  },
  {
    "id": "get_resource_productivities",
    "method": "GET",
    "path": "/api/resource/productivities",
    "pathParameters": [],
    "queryParameters": [],
    "bodyAllowed": false,
    "source": "https://www.rescuetime.com/api-docs/taxonomies"
  },
  {
    "id": "get_resource_profile_entities",
    "method": "GET",
    "path": "/api/resource/profile_entities",
    "pathParameters": [],
    "queryParameters": [
      "collect"
    ],
    "bodyAllowed": false,
    "source": "https://www.rescuetime.com/api-docs/personalization"
  },
  {
    "id": "get_resource_profile_entities_id",
    "method": "GET",
    "path": "/api/resource/profile_entities/{id}",
    "pathParameters": [
      "id"
    ],
    "queryParameters": [],
    "bodyAllowed": false,
    "source": "https://www.rescuetime.com/api-docs/personalization"
  },
  {
    "id": "get_resource_schedules",
    "method": "GET",
    "path": "/api/resource/schedules",
    "pathParameters": [],
    "queryParameters": [
      "collect"
    ],
    "bodyAllowed": false,
    "source": "https://www.rescuetime.com/api-docs/alerts-and-goals"
  },
  {
    "id": "get_resource_tasks",
    "method": "GET",
    "path": "/api/resource/tasks",
    "pathParameters": [],
    "queryParameters": [
      "include_teams"
    ],
    "bodyAllowed": false,
    "source": "https://www.rescuetime.com/api-docs/projects-and-tasks"
  },
  {
    "id": "get_resource_tasks_id",
    "method": "GET",
    "path": "/api/resource/tasks/{id}",
    "pathParameters": [
      "id"
    ],
    "queryParameters": [],
    "bodyAllowed": false,
    "source": "https://www.rescuetime.com/api-docs/projects-and-tasks"
  },
  {
    "id": "get_resource_taxonomies",
    "method": "GET",
    "path": "/api/resource/taxonomies",
    "pathParameters": [],
    "queryParameters": [],
    "bodyAllowed": false,
    "source": "https://www.rescuetime.com/api-docs/taxonomies"
  },
  {
    "id": "get_resource_taxonomies_id",
    "method": "GET",
    "path": "/api/resource/taxonomies/{id}",
    "pathParameters": [
      "id"
    ],
    "queryParameters": [],
    "bodyAllowed": false,
    "source": "https://www.rescuetime.com/api-docs/taxonomies"
  },
  {
    "id": "get_resource_taxonomies_overview_tree",
    "method": "GET",
    "path": "/api/resource/taxonomies/overview_tree",
    "pathParameters": [],
    "queryParameters": [],
    "bodyAllowed": false,
    "source": "https://www.rescuetime.com/api-docs/taxonomies"
  },
  {
    "id": "get_resource_timeline_activities",
    "method": "GET",
    "path": "/api/resource/timeline/activities",
    "pathParameters": [],
    "queryParameters": [
      "date"
    ],
    "bodyAllowed": false,
    "source": "https://www.rescuetime.com/api-docs/time-tracking"
  },
  {
    "id": "get_resource_timeline_activities_date",
    "method": "GET",
    "path": "/api/resource/timeline/activities/{date}",
    "pathParameters": [
      "date"
    ],
    "queryParameters": [],
    "bodyAllowed": false,
    "source": "https://www.rescuetime.com/api-docs/time-tracking"
  },
  {
    "id": "get_resource_timesheet_finalized_days",
    "method": "GET",
    "path": "/api/resource/timesheet_finalized_days",
    "pathParameters": [],
    "queryParameters": [],
    "bodyAllowed": false,
    "source": "https://www.rescuetime.com/api-docs/projects-and-tasks"
  },
  {
    "id": "get_resource_timesheet_finalized_days_range",
    "method": "GET",
    "path": "/api/resource/timesheet_finalized_days/range",
    "pathParameters": [],
    "queryParameters": [
      "start_date",
      "end_date",
      "member_id"
    ],
    "bodyAllowed": false,
    "source": "https://www.rescuetime.com/api-docs/projects-and-tasks"
  },
  {
    "id": "get_resource_timesheets_clients",
    "method": "GET",
    "path": "/api/resource/timesheets_clients",
    "pathParameters": [],
    "queryParameters": [
      "include_teams"
    ],
    "bodyAllowed": false,
    "source": "https://www.rescuetime.com/api-docs/projects-and-tasks"
  },
  {
    "id": "get_resource_timesheets_clients_id",
    "method": "GET",
    "path": "/api/resource/timesheets_clients/{id}",
    "pathParameters": [
      "id"
    ],
    "queryParameters": [],
    "bodyAllowed": false,
    "source": "https://www.rescuetime.com/api-docs/projects-and-tasks"
  },
  {
    "id": "get_resource_user_client_events",
    "method": "GET",
    "path": "/api/resource/user_client_events",
    "pathParameters": [],
    "queryParameters": [
      "event_description",
      "collect"
    ],
    "bodyAllowed": false,
    "source": "https://www.rescuetime.com/api-docs/events"
  },
  {
    "id": "get_resource_user_client_events_id",
    "method": "GET",
    "path": "/api/resource/user_client_events/{id}",
    "pathParameters": [
      "id"
    ],
    "queryParameters": [],
    "bodyAllowed": false,
    "source": "https://www.rescuetime.com/api-docs/events"
  },
  {
    "id": "get_resource_user_global_states",
    "method": "GET",
    "path": "/api/resource/user_global_states",
    "pathParameters": [],
    "queryParameters": [],
    "bodyAllowed": false,
    "source": "https://www.rescuetime.com/api-docs/focus-sessions"
  },
  {
    "id": "get_resource_users",
    "method": "GET",
    "path": "/api/resource/users",
    "pathParameters": [],
    "queryParameters": [],
    "bodyAllowed": false,
    "source": "https://www.rescuetime.com/api-docs/users-and-accounts"
  },
  {
    "id": "get_resource_users_id",
    "method": "GET",
    "path": "/api/resource/users/{id}",
    "pathParameters": [
      "id"
    ],
    "queryParameters": [],
    "bodyAllowed": false,
    "source": "https://www.rescuetime.com/api-docs/users-and-accounts"
  },
  {
    "id": "get_resource_users_settings",
    "method": "GET",
    "path": "/api/resource/users/settings",
    "pathParameters": [],
    "queryParameters": [
      "setting_id"
    ],
    "bodyAllowed": false,
    "source": "https://www.rescuetime.com/api-docs/users-and-accounts"
  },
  {
    "id": "get_resource_v2_projects",
    "method": "GET",
    "path": "/api/resource/v2_projects",
    "pathParameters": [],
    "queryParameters": [
      "include_teams"
    ],
    "bodyAllowed": false,
    "source": "https://www.rescuetime.com/api-docs/projects-and-tasks"
  },
  {
    "id": "get_resource_v2_projects_id",
    "method": "GET",
    "path": "/api/resource/v2_projects/{id}",
    "pathParameters": [
      "id"
    ],
    "queryParameters": [],
    "bodyAllowed": false,
    "source": "https://www.rescuetime.com/api-docs/projects-and-tasks"
  },
  {
    "id": "get_resource_web_notifications",
    "method": "GET",
    "path": "/api/resource/web_notifications",
    "pathParameters": [],
    "queryParameters": [
      "filter"
    ],
    "bodyAllowed": false,
    "source": "https://www.rescuetime.com/api-docs/notifications"
  },
  {
    "id": "get_resource_web_notifications_counts",
    "method": "GET",
    "path": "/api/resource/web_notifications/counts",
    "pathParameters": [],
    "queryParameters": [],
    "bodyAllowed": false,
    "source": "https://www.rescuetime.com/api-docs/notifications"
  },
  {
    "id": "get_resource_web_notifications_id",
    "method": "GET",
    "path": "/api/resource/web_notifications/{id}",
    "pathParameters": [
      "id"
    ],
    "queryParameters": [],
    "bodyAllowed": false,
    "source": "https://www.rescuetime.com/api-docs/notifications"
  },
  {
    "id": "get_resource_web_notifications_read",
    "method": "GET",
    "path": "/api/resource/web_notifications/read",
    "pathParameters": [],
    "queryParameters": [],
    "bodyAllowed": false,
    "source": "https://www.rescuetime.com/api-docs/notifications"
  },
  {
    "id": "patch_resource_accounts_id",
    "method": "PATCH",
    "path": "/api/resource/accounts/{id}",
    "pathParameters": [
      "id"
    ],
    "queryParameters": [
      "account"
    ],
    "bodyAllowed": true,
    "source": "https://www.rescuetime.com/api-docs/users-and-accounts"
  },
  {
    "id": "patch_resource_alerts_id",
    "method": "PATCH",
    "path": "/api/resource/alerts/{id}",
    "pathParameters": [
      "id"
    ],
    "queryParameters": [],
    "bodyAllowed": true,
    "source": "https://www.rescuetime.com/api-docs/alerts-and-goals"
  },
  {
    "id": "patch_resource_goals_id",
    "method": "PATCH",
    "path": "/api/resource/goals/{id}",
    "pathParameters": [
      "id"
    ],
    "queryParameters": [],
    "bodyAllowed": true,
    "source": "https://www.rescuetime.com/api-docs/alerts-and-goals"
  },
  {
    "id": "patch_resource_labeled_time_extra_works_id",
    "method": "PATCH",
    "path": "/api/resource/labeled_time_extra_works/{id}",
    "pathParameters": [
      "id"
    ],
    "queryParameters": [
      "labeled_time_extra_work"
    ],
    "bodyAllowed": true,
    "source": "https://www.rescuetime.com/api-docs/time-tracking"
  },
  {
    "id": "patch_resource_labeled_time_focus_sessions_id",
    "method": "PATCH",
    "path": "/api/resource/labeled_time_focus_sessions/{id}",
    "pathParameters": [
      "id"
    ],
    "queryParameters": [
      "labeled_time_focus_session"
    ],
    "bodyAllowed": true,
    "source": "https://www.rescuetime.com/api-docs/focus-sessions"
  },
  {
    "id": "patch_resource_personalizers_id",
    "method": "PATCH",
    "path": "/api/resource/personalizers/{id}",
    "pathParameters": [
      "id"
    ],
    "queryParameters": [
      "personalizer"
    ],
    "bodyAllowed": true,
    "source": "https://www.rescuetime.com/api-docs/personalization"
  },
  {
    "id": "patch_resource_profile_entities_id",
    "method": "PATCH",
    "path": "/api/resource/profile_entities/{id}",
    "pathParameters": [
      "id"
    ],
    "queryParameters": [],
    "bodyAllowed": true,
    "source": "https://www.rescuetime.com/api-docs/personalization"
  },
  {
    "id": "patch_resource_schedules_id",
    "method": "PATCH",
    "path": "/api/resource/schedules/{id}",
    "pathParameters": [
      "id"
    ],
    "queryParameters": [
      "schedule"
    ],
    "bodyAllowed": true,
    "source": "https://www.rescuetime.com/api-docs/alerts-and-goals"
  },
  {
    "id": "patch_resource_tasks_id",
    "method": "PATCH",
    "path": "/api/resource/tasks/{id}",
    "pathParameters": [
      "id"
    ],
    "queryParameters": [],
    "bodyAllowed": true,
    "source": "https://www.rescuetime.com/api-docs/projects-and-tasks"
  },
  {
    "id": "patch_resource_timesheets_clients_id",
    "method": "PATCH",
    "path": "/api/resource/timesheets_clients/{id}",
    "pathParameters": [
      "id"
    ],
    "queryParameters": [],
    "bodyAllowed": true,
    "source": "https://www.rescuetime.com/api-docs/projects-and-tasks"
  },
  {
    "id": "patch_resource_user_client_events_id",
    "method": "PATCH",
    "path": "/api/resource/user_client_events/{id}",
    "pathParameters": [
      "id"
    ],
    "queryParameters": [
      "user_client_event"
    ],
    "bodyAllowed": true,
    "source": "https://www.rescuetime.com/api-docs/events"
  },
  {
    "id": "patch_resource_users_id",
    "method": "PATCH",
    "path": "/api/resource/users/{id}",
    "pathParameters": [
      "id"
    ],
    "queryParameters": [
      "user"
    ],
    "bodyAllowed": true,
    "source": "https://www.rescuetime.com/api-docs/users-and-accounts"
  },
  {
    "id": "patch_resource_v2_projects_id",
    "method": "PATCH",
    "path": "/api/resource/v2_projects/{id}",
    "pathParameters": [
      "id"
    ],
    "queryParameters": [],
    "bodyAllowed": true,
    "source": "https://www.rescuetime.com/api-docs/projects-and-tasks"
  },
  {
    "id": "patch_resource_web_notifications_id",
    "method": "PATCH",
    "path": "/api/resource/web_notifications/{id}",
    "pathParameters": [
      "id"
    ],
    "queryParameters": [
      "web_notification"
    ],
    "bodyAllowed": true,
    "source": "https://www.rescuetime.com/api-docs/notifications"
  },
  {
    "id": "post_oauth_end_focustime",
    "method": "POST",
    "path": "/api/oauth/end_focustime",
    "pathParameters": [],
    "queryParameters": [
      "by",
      "taxonomy",
      "interval",
      "restrict_begin",
      "restrict_end",
      "restrict_kind",
      "restrict_thing",
      "restrict_thingy",
      "perspective",
      "resolution_time",
      "format",
      "op",
      "highlight_date",
      "description",
      "source",
      "duration",
      "activity_name",
      "activity_category",
      "activity_start_time",
      "activity_end_time"
    ],
    "bodyAllowed": true,
    "source": "https://www.rescuetime.com/rtx/developers"
  },
  {
    "id": "post_oauth_highlights_post",
    "method": "POST",
    "path": "/api/oauth/highlights_post",
    "pathParameters": [],
    "queryParameters": [
      "by",
      "taxonomy",
      "interval",
      "restrict_begin",
      "restrict_end",
      "restrict_kind",
      "restrict_thing",
      "restrict_thingy",
      "perspective",
      "resolution_time",
      "format",
      "op",
      "highlight_date",
      "description",
      "source",
      "duration",
      "activity_name",
      "activity_category",
      "activity_start_time",
      "activity_end_time"
    ],
    "bodyAllowed": true,
    "source": "https://www.rescuetime.com/rtx/developers"
  },
  {
    "id": "post_oauth_offline_time_post",
    "method": "POST",
    "path": "/api/oauth/offline_time_post",
    "pathParameters": [],
    "queryParameters": [
      "by",
      "taxonomy",
      "interval",
      "restrict_begin",
      "restrict_end",
      "restrict_kind",
      "restrict_thing",
      "restrict_thingy",
      "perspective",
      "resolution_time",
      "format",
      "op",
      "highlight_date",
      "description",
      "source",
      "duration",
      "activity_name",
      "activity_category",
      "activity_start_time",
      "activity_end_time"
    ],
    "bodyAllowed": true,
    "source": "https://www.rescuetime.com/rtx/developers"
  },
  {
    "id": "post_oauth_start_focustime",
    "method": "POST",
    "path": "/api/oauth/start_focustime",
    "pathParameters": [],
    "queryParameters": [
      "by",
      "taxonomy",
      "interval",
      "restrict_begin",
      "restrict_end",
      "restrict_kind",
      "restrict_thing",
      "restrict_thingy",
      "perspective",
      "resolution_time",
      "format",
      "op",
      "highlight_date",
      "description",
      "source",
      "duration",
      "activity_name",
      "activity_category",
      "activity_start_time",
      "activity_end_time"
    ],
    "bodyAllowed": true,
    "source": "https://www.rescuetime.com/rtx/developers"
  },
  {
    "id": "post_resource_accounts_beta",
    "method": "POST",
    "path": "/api/resource/accounts/beta",
    "pathParameters": [],
    "queryParameters": [
      "opt"
    ],
    "bodyAllowed": true,
    "source": "https://www.rescuetime.com/api-docs/users-and-accounts"
  },
  {
    "id": "post_resource_alerts",
    "method": "POST",
    "path": "/api/resource/alerts",
    "pathParameters": [],
    "queryParameters": [
      "alert"
    ],
    "bodyAllowed": true,
    "source": "https://www.rescuetime.com/api-docs/alerts-and-goals"
  },
  {
    "id": "post_resource_devices_register_live_activity",
    "method": "POST",
    "path": "/api/resource/devices/register_live_activity",
    "pathParameters": [],
    "queryParameters": [
      "pushToStartToken",
      "pushToken"
    ],
    "bodyAllowed": true,
    "source": "https://www.rescuetime.com/api-docs/devices"
  },
  {
    "id": "post_resource_focus_cancel_or_stop_session",
    "method": "POST",
    "path": "/api/resource/focus/cancel_or_stop_session",
    "pathParameters": [],
    "queryParameters": [],
    "bodyAllowed": true,
    "source": "https://www.rescuetime.com/api-docs/focus-sessions"
  },
  {
    "id": "post_resource_focus_clear",
    "method": "POST",
    "path": "/api/resource/focus/clear",
    "pathParameters": [],
    "queryParameters": [],
    "bodyAllowed": true,
    "source": "https://www.rescuetime.com/api-docs/focus-sessions"
  },
  {
    "id": "post_resource_focus_extend_session",
    "method": "POST",
    "path": "/api/resource/focus/extend_session",
    "pathParameters": [],
    "queryParameters": [
      "new_duration"
    ],
    "bodyAllowed": true,
    "source": "https://www.rescuetime.com/api-docs/focus-sessions"
  },
  {
    "id": "post_resource_focus_start_session",
    "method": "POST",
    "path": "/api/resource/focus/start_session",
    "pathParameters": [],
    "queryParameters": [
      "duration",
      "is_timer",
      "label_name",
      "location_name",
      "block_apps_sites",
      "block_comms",
      "v2_project_id",
      "task_id"
    ],
    "bodyAllowed": true,
    "source": "https://www.rescuetime.com/api-docs/focus-sessions"
  },
  {
    "id": "post_resource_focus_start_zone",
    "method": "POST",
    "path": "/api/resource/focus/start_zone",
    "pathParameters": [],
    "queryParameters": [
      "duration",
      "block_apps_sites"
    ],
    "bodyAllowed": true,
    "source": "https://www.rescuetime.com/api-docs/focus-sessions"
  },
  {
    "id": "post_resource_goals",
    "method": "POST",
    "path": "/api/resource/goals",
    "pathParameters": [],
    "queryParameters": [
      "goal"
    ],
    "bodyAllowed": true,
    "source": "https://www.rescuetime.com/api-docs/alerts-and-goals"
  },
  {
    "id": "post_resource_labeled_time_extra_works",
    "method": "POST",
    "path": "/api/resource/labeled_time_extra_works",
    "pathParameters": [],
    "queryParameters": [
      "labeled_time_extra_work"
    ],
    "bodyAllowed": true,
    "source": "https://www.rescuetime.com/api-docs/time-tracking"
  },
  {
    "id": "post_resource_labeled_time_focus_sessions",
    "method": "POST",
    "path": "/api/resource/labeled_time_focus_sessions",
    "pathParameters": [],
    "queryParameters": [
      "labeled_time_focus_session"
    ],
    "bodyAllowed": true,
    "source": "https://www.rescuetime.com/api-docs/focus-sessions"
  },
  {
    "id": "post_resource_labeled_time_focus_sessions_complete",
    "method": "POST",
    "path": "/api/resource/labeled_time_focus_sessions/complete",
    "pathParameters": [],
    "queryParameters": [
      "id",
      "completed",
      "mobile_distractions"
    ],
    "bodyAllowed": true,
    "source": "https://www.rescuetime.com/api-docs/focus-sessions"
  },
  {
    "id": "post_resource_labeled_time_focus_sessions_location_name",
    "method": "POST",
    "path": "/api/resource/labeled_time_focus_sessions/location_name",
    "pathParameters": [],
    "queryParameters": [
      "id",
      "location_name"
    ],
    "bodyAllowed": true,
    "source": "https://www.rescuetime.com/api-docs/focus-sessions"
  },
  {
    "id": "post_resource_labeled_time_focus_sessions_mobile_distractions",
    "method": "POST",
    "path": "/api/resource/labeled_time_focus_sessions/mobile_distractions",
    "pathParameters": [],
    "queryParameters": [
      "id",
      "mobile_distractions"
    ],
    "bodyAllowed": true,
    "source": "https://www.rescuetime.com/api-docs/focus-sessions"
  },
  {
    "id": "post_resource_labeled_time_offline_focus_works_add",
    "method": "POST",
    "path": "/api/resource/labeled_time_offline_focus_works/add",
    "pathParameters": [],
    "queryParameters": [
      "labeled_time_offline_focus_work"
    ],
    "bodyAllowed": true,
    "source": "https://www.rescuetime.com/api-docs/time-tracking"
  },
  {
    "id": "post_resource_labeled_time_offline_meetings_add",
    "method": "POST",
    "path": "/api/resource/labeled_time_offline_meetings/add",
    "pathParameters": [],
    "queryParameters": [
      "labeled_time_offline_meeting"
    ],
    "bodyAllowed": true,
    "source": "https://www.rescuetime.com/api-docs/time-tracking"
  },
  {
    "id": "post_resource_labeled_time_offline_other_works_add",
    "method": "POST",
    "path": "/api/resource/labeled_time_offline_other_works/add",
    "pathParameters": [],
    "queryParameters": [
      "labeled_time_offline_other_work"
    ],
    "bodyAllowed": true,
    "source": "https://www.rescuetime.com/api-docs/time-tracking"
  },
  {
    "id": "post_resource_labeled_time_project_times_create_for_project_task",
    "method": "POST",
    "path": "/api/resource/labeled_time_project_times/create_for_project_task",
    "pathParameters": [],
    "queryParameters": [
      "project_id",
      "task_id",
      "start_time",
      "end_time",
      "extra"
    ],
    "bodyAllowed": true,
    "source": "https://www.rescuetime.com/api-docs/projects-and-tasks"
  },
  {
    "id": "post_resource_labeled_time_project_times_merge",
    "method": "POST",
    "path": "/api/resource/labeled_time_project_times/merge",
    "pathParameters": [],
    "queryParameters": [
      "project_id",
      "task_id",
      "start_time",
      "merge_start_time",
      "merge_end_time"
    ],
    "bodyAllowed": true,
    "source": "https://www.rescuetime.com/api-docs/projects-and-tasks"
  },
  {
    "id": "post_resource_labeled_time_project_times_split",
    "method": "POST",
    "path": "/api/resource/labeled_time_project_times/split",
    "pathParameters": [],
    "queryParameters": [
      "project_id",
      "task_id",
      "start_time",
      "end_time",
      "split_project_id",
      "split_task_id",
      "split_start_time",
      "split_end_time"
    ],
    "bodyAllowed": true,
    "source": "https://www.rescuetime.com/api-docs/projects-and-tasks"
  },
  {
    "id": "post_resource_labeled_time_project_times_update_for_project_task",
    "method": "POST",
    "path": "/api/resource/labeled_time_project_times/update_for_project_task",
    "pathParameters": [],
    "queryParameters": [
      "original_project_id",
      "original_start_time",
      "original_task_id",
      "project_id",
      "task_id",
      "start_time",
      "end_time",
      "comment"
    ],
    "bodyAllowed": true,
    "source": "https://www.rescuetime.com/api-docs/projects-and-tasks"
  },
  {
    "id": "post_resource_personalizers",
    "method": "POST",
    "path": "/api/resource/personalizers",
    "pathParameters": [],
    "queryParameters": [
      "personalizer"
    ],
    "bodyAllowed": true,
    "source": "https://www.rescuetime.com/api-docs/personalization"
  },
  {
    "id": "post_resource_profile_entities",
    "method": "POST",
    "path": "/api/resource/profile_entities",
    "pathParameters": [],
    "queryParameters": [
      "profile_entity"
    ],
    "bodyAllowed": true,
    "source": "https://www.rescuetime.com/api-docs/personalization"
  },
  {
    "id": "post_resource_profile_entities_create_or_update",
    "method": "POST",
    "path": "/api/resource/profile_entities/create_or_update",
    "pathParameters": [],
    "queryParameters": [
      "profile_entity"
    ],
    "bodyAllowed": true,
    "source": "https://www.rescuetime.com/api-docs/personalization"
  },
  {
    "id": "post_resource_schedules",
    "method": "POST",
    "path": "/api/resource/schedules",
    "pathParameters": [],
    "queryParameters": [
      "schedule"
    ],
    "bodyAllowed": true,
    "source": "https://www.rescuetime.com/api-docs/alerts-and-goals"
  },
  {
    "id": "post_resource_tasks",
    "method": "POST",
    "path": "/api/resource/tasks",
    "pathParameters": [],
    "queryParameters": [
      "task",
      "personal",
      "owner_type"
    ],
    "bodyAllowed": true,
    "source": "https://www.rescuetime.com/api-docs/projects-and-tasks"
  },
  {
    "id": "post_resource_tasks_id_archive",
    "method": "POST",
    "path": "/api/resource/tasks/{id}/archive",
    "pathParameters": [
      "id"
    ],
    "queryParameters": [
      "archive",
      "restore"
    ],
    "bodyAllowed": true,
    "source": "https://www.rescuetime.com/api-docs/projects-and-tasks"
  },
  {
    "id": "post_resource_tasks_id_assign_teams",
    "method": "POST",
    "path": "/api/resource/tasks/{id}/assign_teams",
    "pathParameters": [
      "id"
    ],
    "queryParameters": [
      "team_ids"
    ],
    "bodyAllowed": true,
    "source": "https://www.rescuetime.com/api-docs/projects-and-tasks"
  },
  {
    "id": "post_resource_tasks_id_assign_users",
    "method": "POST",
    "path": "/api/resource/tasks/{id}/assign_users",
    "pathParameters": [
      "id"
    ],
    "queryParameters": [
      "user_ids"
    ],
    "bodyAllowed": true,
    "source": "https://www.rescuetime.com/api-docs/projects-and-tasks"
  },
  {
    "id": "post_resource_tasks_id_link_project",
    "method": "POST",
    "path": "/api/resource/tasks/{id}/link_project",
    "pathParameters": [
      "id"
    ],
    "queryParameters": [
      "project_id"
    ],
    "bodyAllowed": true,
    "source": "https://www.rescuetime.com/api-docs/projects-and-tasks"
  },
  {
    "id": "post_resource_tasks_id_unlink_project",
    "method": "POST",
    "path": "/api/resource/tasks/{id}/unlink_project",
    "pathParameters": [
      "id"
    ],
    "queryParameters": [
      "v2_project_id",
      "v2_project"
    ],
    "bodyAllowed": true,
    "source": "https://www.rescuetime.com/api-docs/projects-and-tasks"
  },
  {
    "id": "post_resource_timesheet_finalized_days_date",
    "method": "POST",
    "path": "/api/resource/timesheet_finalized_days/date",
    "pathParameters": [],
    "queryParameters": [
      "date",
      "finalized",
      "status"
    ],
    "bodyAllowed": true,
    "source": "https://www.rescuetime.com/api-docs/projects-and-tasks"
  },
  {
    "id": "post_resource_timesheets_clients",
    "method": "POST",
    "path": "/api/resource/timesheets_clients",
    "pathParameters": [],
    "queryParameters": [
      "timesheets_client",
      "personal",
      "owner_type"
    ],
    "bodyAllowed": true,
    "source": "https://www.rescuetime.com/api-docs/projects-and-tasks"
  },
  {
    "id": "post_resource_timesheets_clients_id_archive",
    "method": "POST",
    "path": "/api/resource/timesheets_clients/{id}/archive",
    "pathParameters": [
      "id"
    ],
    "queryParameters": [
      "archive",
      "restore"
    ],
    "bodyAllowed": true,
    "source": "https://www.rescuetime.com/api-docs/projects-and-tasks"
  },
  {
    "id": "post_resource_timesheets_clients_id_assign_teams",
    "method": "POST",
    "path": "/api/resource/timesheets_clients/{id}/assign_teams",
    "pathParameters": [
      "id"
    ],
    "queryParameters": [
      "team_ids"
    ],
    "bodyAllowed": true,
    "source": "https://www.rescuetime.com/api-docs/projects-and-tasks"
  },
  {
    "id": "post_resource_timesheets_clients_id_assign_users",
    "method": "POST",
    "path": "/api/resource/timesheets_clients/{id}/assign_users",
    "pathParameters": [
      "id"
    ],
    "queryParameters": [
      "user_ids"
    ],
    "bodyAllowed": true,
    "source": "https://www.rescuetime.com/api-docs/projects-and-tasks"
  },
  {
    "id": "post_resource_timesheets_clients_id_link_project",
    "method": "POST",
    "path": "/api/resource/timesheets_clients/{id}/link_project",
    "pathParameters": [
      "id"
    ],
    "queryParameters": [
      "project_id"
    ],
    "bodyAllowed": true,
    "source": "https://www.rescuetime.com/api-docs/projects-and-tasks"
  },
  {
    "id": "post_resource_user_client_events",
    "method": "POST",
    "path": "/api/resource/user_client_events",
    "pathParameters": [],
    "queryParameters": [
      "user_client_event"
    ],
    "bodyAllowed": true,
    "source": "https://www.rescuetime.com/api-docs/events"
  },
  {
    "id": "post_resource_users_settings",
    "method": "POST",
    "path": "/api/resource/users/settings",
    "pathParameters": [],
    "queryParameters": [
      "setting_id",
      "setting_value",
      "settings"
    ],
    "bodyAllowed": true,
    "source": "https://www.rescuetime.com/api-docs/users-and-accounts"
  },
  {
    "id": "post_resource_v2_projects",
    "method": "POST",
    "path": "/api/resource/v2_projects",
    "pathParameters": [],
    "queryParameters": [
      "v2_project",
      "personal",
      "owner_type"
    ],
    "bodyAllowed": true,
    "source": "https://www.rescuetime.com/api-docs/projects-and-tasks"
  },
  {
    "id": "post_resource_v2_projects_id_add_task",
    "method": "POST",
    "path": "/api/resource/v2_projects/{id}/add_task",
    "pathParameters": [
      "id"
    ],
    "queryParameters": [
      "task_id",
      "task"
    ],
    "bodyAllowed": true,
    "source": "https://www.rescuetime.com/api-docs/projects-and-tasks"
  },
  {
    "id": "post_resource_v2_projects_id_archive",
    "method": "POST",
    "path": "/api/resource/v2_projects/{id}/archive",
    "pathParameters": [
      "id"
    ],
    "queryParameters": [
      "archive",
      "restore"
    ],
    "bodyAllowed": true,
    "source": "https://www.rescuetime.com/api-docs/projects-and-tasks"
  },
  {
    "id": "post_resource_v2_projects_id_assign_teams",
    "method": "POST",
    "path": "/api/resource/v2_projects/{id}/assign_teams",
    "pathParameters": [
      "id"
    ],
    "queryParameters": [
      "team_ids"
    ],
    "bodyAllowed": true,
    "source": "https://www.rescuetime.com/api-docs/projects-and-tasks"
  },
  {
    "id": "post_resource_v2_projects_id_assign_users",
    "method": "POST",
    "path": "/api/resource/v2_projects/{id}/assign_users",
    "pathParameters": [
      "id"
    ],
    "queryParameters": [
      "user_ids"
    ],
    "bodyAllowed": true,
    "source": "https://www.rescuetime.com/api-docs/projects-and-tasks"
  },
  {
    "id": "post_resource_v2_projects_id_remove_client",
    "method": "POST",
    "path": "/api/resource/v2_projects/{id}/remove_client",
    "pathParameters": [
      "id"
    ],
    "queryParameters": [],
    "bodyAllowed": true,
    "source": "https://www.rescuetime.com/api-docs/projects-and-tasks"
  },
  {
    "id": "post_resource_v2_projects_id_remove_task",
    "method": "POST",
    "path": "/api/resource/v2_projects/{id}/remove_task",
    "pathParameters": [
      "id"
    ],
    "queryParameters": [
      "task_id",
      "task"
    ],
    "bodyAllowed": true,
    "source": "https://www.rescuetime.com/api-docs/projects-and-tasks"
  },
  {
    "id": "post_resource_web_notifications",
    "method": "POST",
    "path": "/api/resource/web_notifications",
    "pathParameters": [],
    "queryParameters": [
      "web_notification"
    ],
    "bodyAllowed": true,
    "source": "https://www.rescuetime.com/api-docs/notifications"
  }
] as const satisfies readonly RescueTimeOperation[];

export const RESCUETIME_OPERATION_BY_ID: ReadonlyMap<string, RescueTimeOperation> = new Map(RESCUETIME_OPERATIONS.map((operation) => [operation.id, operation]));
export const RESCUETIME_READ_OPERATION_IDS = RESCUETIME_OPERATIONS.filter((operation) => operation.method === "GET").map((operation) => operation.id);
export const RESCUETIME_MANAGE_OPERATION_IDS = RESCUETIME_OPERATIONS.filter((operation) => operation.method !== "GET").map((operation) => operation.id);
