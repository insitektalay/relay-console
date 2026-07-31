import { IsString, MaxLength, MinLength } from "class-validator";

export class SubmitAppleTransactionDto {
  @IsString()
  @MinLength(16)
  @MaxLength(50_000)
  signedTransaction: string;
}

export class AppleServerNotificationDto {
  @IsString()
  @MinLength(16)
  @MaxLength(100_000)
  signedPayload: string;
}
