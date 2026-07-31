import { ApiKeyHealthHandlers01 } from "./api-key-health-01.handlers";
import { ApiKeyHealthHandlers02 } from "./api-key-health-02.handlers";
import { ApiKeyHealthHandlers03 } from "./api-key-health-03.handlers";
import { ApiKeyHealthHandlers04 } from "./api-key-health-04.handlers";
import { ApiKeyHealthHandlers05 } from "./api-key-health-05.handlers";
import { ApiKeyHealthHandlers06 } from "./api-key-health-06.handlers";
import { ApiKeyHealthHandlers07 } from "./api-key-health-07.handlers";
import { ApiKeyHealthHandlers08 } from "./api-key-health-08.handlers";
import { ApiKeyHealthHandlers09 } from "./api-key-health-09.handlers";
import { mergeApiKeyHealthHandlerMaps } from "./api-key-health-handler";

export const API_KEY_HEALTH_HANDLER_BY_SLUG = mergeApiKeyHealthHandlerMaps(
  ApiKeyHealthHandlers01,
  ApiKeyHealthHandlers02,
  ApiKeyHealthHandlers03,
  ApiKeyHealthHandlers04,
  ApiKeyHealthHandlers05,
  ApiKeyHealthHandlers06,
  ApiKeyHealthHandlers07,
  ApiKeyHealthHandlers08,
  ApiKeyHealthHandlers09,
);
