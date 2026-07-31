import type { BoundedRestConnector } from "./bounded-rest-api.adapter";
import { GIVEBUTTER_BOUNDED_REST_CONNECTOR } from "../givebutter/givebutter-operation-registry";
import { GIVE_LIVELY_BOUNDED_REST_CONNECTOR } from "../give-lively/give-lively-operation-registry";
import { KINDFUL_BOUNDED_REST_CONNECTOR } from "../kindful/kindful-operation-registry";
import { NEON_CRM_BOUNDED_REST_CONNECTOR } from "../neon-crm/neon-crm-operation-registry";
import { LITTLE_GREEN_LIGHT_BOUNDED_REST_CONNECTOR } from "../little-green-light/little-green-light-operation-registry";
import { DONATELY_BOUNDED_REST_CONNECTOR } from "../donately/donately-operation-registry";
import { FUNDRAISE_UP_BOUNDED_REST_CONNECTOR } from "../fundraise-up/fundraise-up-operation-registry";
import { VIRTUOUS_CRM_BOUNDED_REST_CONNECTOR } from "../virtuous-crm/virtuous-crm-operation-registry";
import { EVERYACTION_BOUNDED_REST_CONNECTOR } from "../everyaction/everyaction-operation-registry";
import { NATIONBUILDER_BOUNDED_REST_CONNECTOR } from "../nationbuilder/nationbuilder-operation-registry";
import { ACTBLUE_BOUNDED_REST_CONNECTOR } from "../actblue/actblue-operation-registry";
import { MOBILIZE_BOUNDED_REST_CONNECTOR } from "../mobilize/mobilize-operation-registry";
import { ACTION_NETWORK_BOUNDED_REST_CONNECTOR } from "../action-network/action-network-operation-registry";
import { CONSTANT_CONTACT_LEAD_GEN_BOUNDED_REST_CONNECTOR } from "../constant-contact-lead-gen/constant-contact-lead-gen-operation-registry";

export const BOUNDED_REST_CONNECTOR_BY_SLUG = new Map<
  string,
  BoundedRestConnector
>([
  [GIVEBUTTER_BOUNDED_REST_CONNECTOR.slug, GIVEBUTTER_BOUNDED_REST_CONNECTOR],
  [GIVE_LIVELY_BOUNDED_REST_CONNECTOR.slug, GIVE_LIVELY_BOUNDED_REST_CONNECTOR],
  [KINDFUL_BOUNDED_REST_CONNECTOR.slug, KINDFUL_BOUNDED_REST_CONNECTOR],
  [NEON_CRM_BOUNDED_REST_CONNECTOR.slug, NEON_CRM_BOUNDED_REST_CONNECTOR],
  [
    LITTLE_GREEN_LIGHT_BOUNDED_REST_CONNECTOR.slug,
    LITTLE_GREEN_LIGHT_BOUNDED_REST_CONNECTOR,
  ],
  [DONATELY_BOUNDED_REST_CONNECTOR.slug, DONATELY_BOUNDED_REST_CONNECTOR],
  [
    FUNDRAISE_UP_BOUNDED_REST_CONNECTOR.slug,
    FUNDRAISE_UP_BOUNDED_REST_CONNECTOR,
  ],
  [
    VIRTUOUS_CRM_BOUNDED_REST_CONNECTOR.slug,
    VIRTUOUS_CRM_BOUNDED_REST_CONNECTOR,
  ],
  [EVERYACTION_BOUNDED_REST_CONNECTOR.slug, EVERYACTION_BOUNDED_REST_CONNECTOR],
  [
    NATIONBUILDER_BOUNDED_REST_CONNECTOR.slug,
    NATIONBUILDER_BOUNDED_REST_CONNECTOR,
  ],
  [ACTBLUE_BOUNDED_REST_CONNECTOR.slug, ACTBLUE_BOUNDED_REST_CONNECTOR],
  [MOBILIZE_BOUNDED_REST_CONNECTOR.slug, MOBILIZE_BOUNDED_REST_CONNECTOR],
  [
    ACTION_NETWORK_BOUNDED_REST_CONNECTOR.slug,
    ACTION_NETWORK_BOUNDED_REST_CONNECTOR,
  ],
  [
    CONSTANT_CONTACT_LEAD_GEN_BOUNDED_REST_CONNECTOR.slug,
    CONSTANT_CONTACT_LEAD_GEN_BOUNDED_REST_CONNECTOR,
  ],
]);
