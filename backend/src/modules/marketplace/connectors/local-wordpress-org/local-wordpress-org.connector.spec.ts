import { BadRequestException } from "@nestjs/common";
import type { BridgeService } from "../../../bridge/bridge.service";
import { MarketplaceConnectorRegistry } from "../connector-registry";
import { LocalWordPressOrgCliAdapter } from "./local-wordpress-org-cli.adapter";
import { LOCAL_WORDPRESS_ORG_CONNECTOR_MANIFEST } from "./local-wordpress-org.connector";

const credentials = {
  sourceHostId: "host-1",
  sourceHostType: "hermes_bridge" as const,
  sitePath: "/srv/wordpress/site-one",
};

describe("Local WordPress.org connector", () => {
  it("registers four fixed source-host tools with approval on every action", () => {
    expect(new MarketplaceConnectorRegistry().get("local-wordpress-org")).toBe(
      LOCAL_WORDPRESS_ORG_CONNECTOR_MANIFEST,
    );
    expect(LOCAL_WORDPRESS_ORG_CONNECTOR_MANIFEST.connectorType).toBe(
      "local_script",
    );
    expect(LOCAL_WORDPRESS_ORG_CONNECTOR_MANIFEST.tools).toHaveLength(4);
    expect(
      LOCAL_WORDPRESS_ORG_CONNECTOR_MANIFEST.tools.every(
        (tool) => tool.approvalRequired,
      ),
    ).toBe(true);
  });

  it("runs bounded post listing as an argv array with plugins and themes skipped", async () => {
    const bridge = {
      callMarketplaceLocalCli: jest.fn().mockResolvedValue({
        requestId: "request-1",
        status: "ok",
        exitCode: 0,
        stdout:
          '[{"ID":7,"post_type":"post","post_status":"draft","post_title":"Plan"}]',
      }),
    } as unknown as BridgeService;
    const result = await new LocalWordPressOrgCliAdapter(bridge).execute({
      workspaceId: "ws-1",
      toolName: "local_wordpress_org_list_posts",
      credentials,
      payload: { postType: "post", status: "draft", limit: 5 },
    });
    expect(bridge.callMarketplaceLocalCli).toHaveBeenCalledWith(
      expect.objectContaining({
        appSlug: "local-wordpress-org",
        executable: "wp",
        argv: [
          "--path=/srv/wordpress/site-one",
          "--skip-plugins",
          "--skip-themes",
          "--no-color",
          "post",
          "list",
          "--post_type=post",
          "--post_status=draft",
          "--posts_per_page=5",
          "--orderby=modified",
          "--order=DESC",
          "--fields=ID,post_type,post_status,post_title,post_date_gmt,post_modified_gmt",
          "--format=json",
        ],
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        data: [expect.objectContaining({ ID: 7, post_status: "draft" })],
      }),
    );
  });

  it("forces every creation to draft and never enables comments or pings", async () => {
    const bridge = {
      callMarketplaceLocalCli: jest.fn().mockResolvedValue({
        requestId: "request-2",
        status: "ok",
        exitCode: 0,
        stdout: "42\n",
      }),
    } as unknown as BridgeService;
    const result = await new LocalWordPressOrgCliAdapter(bridge).execute({
      workspaceId: "ws-1",
      toolName: "local_wordpress_org_create_draft",
      credentials,
      payload: {
        postType: "page",
        title: "Review",
        content: "<!-- wp:paragraph --><p>Draft</p><!-- /wp:paragraph -->",
      },
    });
    const argv = (bridge.callMarketplaceLocalCli as jest.Mock).mock.calls[0][0]
      .argv as string[];
    expect(argv).toEqual(
      expect.arrayContaining([
        "post",
        "create",
        "--post_type=page",
        "--post_status=draft",
        "--comment_status=closed",
        "--ping_status=closed",
        "--porcelain",
      ]),
    );
    expect(argv.join(" ")).not.toContain("publish");
    expect(result.data).toEqual({ draftId: "42", status: "draft" });
  });

  it("rejects exact reads that resolve to an unsupported WordPress content type", async () => {
    const bridge = {
      callMarketplaceLocalCli: jest.fn().mockResolvedValue({
        requestId: "request-3",
        status: "ok",
        exitCode: 0,
        stdout: '{"ID":9,"post_type":"attachment","post_status":"inherit"}',
      }),
    } as unknown as BridgeService;
    await expect(
      new LocalWordPressOrgCliAdapter(bridge).execute({
        workspaceId: "ws-1",
        toolName: "local_wordpress_org_get_post",
        credentials,
        payload: { postId: 9 },
      }),
    ).rejects.toThrow("unsupported content type");
  });

  it.each([
    "relative/site",
    "/srv/wordpress/../other",
    "C:\\wordpress\\..\\other",
  ])("rejects an unbound WordPress installation path: %s", async (sitePath) => {
    const bridge = {
      callMarketplaceLocalCli: jest.fn(),
    } as unknown as BridgeService;
    const adapter = new LocalWordPressOrgCliAdapter(bridge);
    await expect(
      adapter.health("ws-1", { ...credentials, sitePath }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(bridge.callMarketplaceLocalCli).not.toHaveBeenCalled();
  });
});
