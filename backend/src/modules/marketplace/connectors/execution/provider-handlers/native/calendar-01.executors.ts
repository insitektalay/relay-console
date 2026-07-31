import type { NativeExecutorRegistrationMap } from "../../native-executor-registration";
import type { MarketplaceConnectorExecutionService } from "../../../connector-execution.service";
import { type MarketplaceConnectorExecutorRequest } from "../../../types";

export const CalendarExecutors1 = {
  async executeCalCom(
    this: MarketplaceConnectorExecutionService,
    input: MarketplaceConnectorExecutorRequest,
  ) {
    const connection = await this.oauth.getConnectionWithSecrets(
      input.workspaceId,
      "cal-com",
      input.connectionId,
    );
    const token = await this.oauth.refreshIfNeeded(connection);
    const credentials = this.calComCredentials(
      { accessToken: token.accessToken },
      connection,
    );
    const tool = this.registry.getTool("cal-com", input.toolName)!;
    const name = tool.name;
    let data: unknown;
    let action: string;
    if (name === "calCom.listBookings") {
      action = "cal_com_booking_list";
      await this.requireConnectorApproval(input, connection, action, "cal-com");
      data = await this.calComApi.listBookings(credentials, {
        limit:
          typeof input.input.limit === "number" ? input.input.limit : undefined,
      });
    } else if (name === "calCom.getBooking") {
      action = "cal_com_booking_get";
      await this.requireConnectorApproval(input, connection, action, "cal-com");
      data = await this.calComApi.getBooking(credentials, {
        bookingUid: this.requiredString(input.input.bookingUid, "bookingUid"),
      });
    } else if (name === "calCom.getEventType") {
      action = "cal_com_event_type_get";
      await this.requireConnectorApproval(input, connection, action, "cal-com");
      data = await this.calComApi.getEventType(credentials, {
        eventTypeId: this.requiredString(
          input.input.eventTypeId,
          "eventTypeId",
        ),
      });
    } else {
      return this.safeError(
        "tool_unavailable",
        `${input.toolName} is not implemented`,
      );
    }
    await this.recordAudit({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.cal_com.${name.split(".")[1]}.executed`,
      resourceId: connection.id,
      metadata: {
        toolName: name,
        capability: tool.capability,
        action,
        userIdHash: this.hash(credentials.userId),
        bookingUidHash: this.stringOrNull(input.input.bookingUid)
          ? this.hash(this.stringOrNull(input.input.bookingUid)!)
          : null,
        eventTypeIdHash: this.stringOrNull(input.input.eventTypeId)
          ? this.hash(this.stringOrNull(input.input.eventTypeId)!)
          : null,
        limit: input.input.limit ?? null,
      },
    });
    return this.ok(data, `Cal.com ${name.split(".")[1]} completed.`);
  },
};

export const CalendarExecutors1Registrations = {
  "cal-com": { methodName: "executeCalCom", needsConnection: false },
} satisfies NativeExecutorRegistrationMap<typeof CalendarExecutors1>;
