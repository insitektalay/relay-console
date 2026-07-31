import { ArgumentMetadata, ValidationPipe } from "@nestjs/common";
import { CoachingNoteType } from "../../entities/coaching-note.entity";
import {
  CreateCoachingNoteDto,
  CreateReviewDto,
} from "./dto/performance.dto";

const strictPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  transformOptions: { enableImplicitConversion: true },
});

function bodyMetadata(metatype: ArgumentMetadata["metatype"]): ArgumentMetadata {
  return { type: "body", metatype, data: undefined };
}

describe("performance mutation DTOs", () => {
  const review = {
    period: "weekly",
    periodStart: "2026-07-01T00:00:00.000Z",
    periodEnd: "2026-07-08T00:00:00.000Z",
    overallRating: 4,
    summary: "Strong week",
  };

  it.each(["id", "agentId", "reviewerId", "createdAt"])(
    "rejects server-owned review field %s",
    async (field) => {
      await expect(
        strictPipe.transform(
          { ...review, [field]: "attacker-controlled" },
          bodyMetadata(CreateReviewDto),
        ),
      ).rejects.toMatchObject({ status: 400 });
    },
  );

  it("rejects structured objects inside string-only review evidence", async () => {
    await expect(
      strictPipe.transform(
        { ...review, strengths: [{ text: "attacker object" }] },
        bodyMetadata(CreateReviewDto),
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  it.each(["id", "agentId", "authorId", "createdAt"])(
    "rejects server-owned coaching field %s",
    async (field) => {
      await expect(
        strictPipe.transform(
          {
            content: "Improve retries",
            type: CoachingNoteType.IMPROVEMENT,
            [field]: "attacker-controlled",
          },
          bodyMetadata(CreateCoachingNoteDto),
        ),
      ).rejects.toMatchObject({ status: 400 });
    },
  );
});
