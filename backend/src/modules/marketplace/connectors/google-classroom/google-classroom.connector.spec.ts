import {
  GoogleClassroomApiAdapter,
  GoogleClassroomApiError,
} from "./google-classroom-api.adapter";
import {
  GOOGLE_CLASSROOM_CONNECTOR_MANIFEST,
  GOOGLE_CLASSROOM_SCOPES,
} from "./google-classroom.connector";

describe("Google Classroom connector", () => {
  afterEach(() => jest.restoreAllMocks());
  it("uses the exact three read-only scopes and exposes four reads", () => {
    expect(GOOGLE_CLASSROOM_SCOPES).toEqual([
      "https://www.googleapis.com/auth/classroom.courses.readonly",
      "https://www.googleapis.com/auth/classroom.coursework.me.readonly",
      "https://www.googleapis.com/auth/classroom.courseworkmaterials.readonly",
    ]);
    expect(
      GOOGLE_CLASSROOM_CONNECTOR_MANIFEST.tools.map((tool) => [
        tool.functionName,
        tool.action,
        tool.approvalRequired,
      ]),
    ).toEqual([
      ["google_classroom_courses_list_mine", "read", false],
      ["google_classroom_course_get", "read", false],
      ["google_classroom_coursework_list", "read", false],
      ["google_classroom_materials_list", "read", false],
    ]);
  });
  it("lists one bounded first page and excludes sensitive course fields", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            courses: Array.from({ length: 30 }, (_, index) => ({
              id: String(index),
              name: `Course ${index}`,
              enrollmentCode: "secret",
              ownerId: "student-profile",
              gradebookSettings: { displaySetting: "SHOW" },
            })),
            nextPageToken: "not-followed",
          }),
          { status: 200 },
        ),
      );
    const result = await new GoogleClassroomApiAdapter().listMyCourses(
      "token",
      { maxResults: 25 },
    );
    expect(result).toMatchObject({
      resultCount: 25,
      truncated: true,
      nextPageFollowed: false,
      requestingUserOnly: true,
    });
    expect(result.courses).toHaveLength(25);
    expect(JSON.stringify(result)).not.toContain("student-profile");
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
  it("maps coursework due dates and safe attachments without student identities", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            courseWork: [
              {
                courseId: "123",
                id: "work-1",
                title: "Cell worksheet",
                dueDate: { year: 2026, month: 7, day: 20 },
                dueTime: { hours: 16 },
                individualStudentsOptions: { studentIds: ["student-secret"] },
                materials: [
                  {
                    link: {
                      title: "Reference",
                      url: "https://example.edu/cells",
                      thumbnailUrl: "https://private.test/image",
                    },
                  },
                  {
                    driveFile: {
                      driveFile: {
                        id: "drive-secret",
                        title: "Worksheet",
                        alternateLink: "https://drive.google.com/open?id=safe",
                      },
                    },
                  },
                ],
              },
            ],
            nextPageToken: "not-followed",
          }),
          { status: 200 },
        ),
      );
    const result = await new GoogleClassroomApiAdapter().listCoursework(
      "token",
      { courseId: "123", maxResults: 25 },
    );
    expect(result).toMatchObject({
      courseWork: [
        {
          title: "Cell worksheet",
          dueDate: { year: 2026, month: 7, day: 20 },
          materials: [
            { type: "link" },
            { type: "driveFile", driveIdReturned: false },
          ],
          individualStudentIdsExcluded: true,
        },
      ],
      automaticPagination: false,
      studentSubmissionsGradesEnabled: false,
    });
    expect(JSON.stringify(result)).not.toContain("student-secret");
    expect(JSON.stringify(result)).not.toContain("drive-secret");
    expect(JSON.stringify(result)).not.toContain("private.test");
  });
  it("pins newest-first course paths without preview or page tokens", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ courseWorkMaterial: [] }), {
          status: 200,
        }),
      );
    await new GoogleClassroomApiAdapter().listMaterials("token", {
      courseId: "course_123",
      maxResults: 10,
    });
    const url = new URL(String((global.fetch as jest.Mock).mock.calls[0][0]));
    expect(url.pathname).toBe("/v1/courses/course_123/courseWorkMaterials");
    expect(url.searchParams.get("orderBy")).toBe("updateTime desc");
    expect(url.searchParams.has("previewVersion")).toBe(false);
    expect(url.searchParams.has("pageToken")).toBe(false);
  });
  it("rejects query-shaped IDs and oversized pages before provider access", async () => {
    const fetch = jest.spyOn(global, "fetch"),
      adapter = new GoogleClassroomApiAdapter();
    await expect(
      adapter.getCourse("token", { courseId: "123?previewVersion=unsafe" }),
    ).rejects.toBeInstanceOf(GoogleClassroomApiError);
    await expect(
      adapter.listMyCourses("token", { maxResults: 26 }),
    ).rejects.toBeInstanceOf(GoogleClassroomApiError);
    expect(fetch).not.toHaveBeenCalled();
  });
});
