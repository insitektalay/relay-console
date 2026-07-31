import {
  EVENT_TICKETING_EXECUTORS,
  EventTicketingExecutorRegistrations,
} from "./event-ticketing.executors";
import { NATIVE_PROVIDER_EXECUTOR_REGISTRATION_MODULES } from "./native/native-provider-executors.index";
import { mergeNativeExecutorRegistrationModules } from "../native-executor-registration";

export const NATIVE_EXECUTOR_REGISTRATION_BY_SLUG =
  mergeNativeExecutorRegistrationModules(
    {
      methods: EVENT_TICKETING_EXECUTORS,
      registrations: EventTicketingExecutorRegistrations,
    },
    ...NATIVE_PROVIDER_EXECUTOR_REGISTRATION_MODULES,
  );
