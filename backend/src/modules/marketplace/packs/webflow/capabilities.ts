import { capability } from "../../catalog/marketplace-catalog.types";

export const WEBFLOW_CAPABILITIES = [
  capability("sites_pages_read", "Sites and Pages Read", "Read site, page, domain and publish state.", true),
  capability("cms_read", "CMS Read", "Read collections, fields and collection items.", true),
  capability("forms_assets_read", "Forms and Assets Read", "Read forms, submissions and asset metadata with privacy filtering.", true),
  capability("cms_write", "CMS Writes", "Create/update CMS items or page content only after approval policy checks.", false),
  capability("publish_admin", "Publishing and Site Config", "Publish, domain, webhook, site-config and permission changes require approval.", false),
];
