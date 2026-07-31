import { ClawChatWebSdk } from "@clawchat/web-sdk"
import { appConfig } from "@/lib/config"

export const sdk = new ClawChatWebSdk({
  apiBaseUrl: appConfig.apiBaseUrl,
})
