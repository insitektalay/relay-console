import type { MarketplaceConnectorSafeErrorCode } from "../types";
type Obj = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;
export type AirshipCredentials = { bearerToken: string; cloudSite: string };
export class AirshipApiError extends Error { constructor(public readonly code:MarketplaceConnectorSafeErrorCode,message:string,public readonly statusCode?:number){super(message)} }
export class AirshipApiAdapter {
  static readonly origins:Record<string,string>={na:"https://go.urbanairship.com",eu:"https://go.airship.eu"};
  constructor(private readonly requester:Requester=fetch){}
  async health(credentials:AirshipCredentials){await this.listSegmentReferences(credentials);return{apiOrigin:this.origin(credentials.cloudSite),cloudSite:credentials.cloudSite}}
  async listSegmentReferences(credentials:AirshipCredentials){this.validate(credentials);const url=new URL("/api/segments",this.origin(credentials.cloudSite));url.searchParams.set("limit","25");const root=this.object(await this.get(url,credentials));const segments=Array.isArray(root.segments)?root.segments:[];return{cloudSite:credentials.cloudSite,segments:segments.slice(0,25).map(value=>{const item=this.object(value);return{id:this.uuid(item.id),creationDate:this.safeInteger(item.creation_date),modificationDate:this.safeInteger(item.modification_date)}}),nextPageAvailable:typeof root.next_page==="string"&&root.next_page.length>0,redactionStatus:"segment-names-criteria-audiences-and-pagination-urls-excluded"}}
  private async get(url:URL,credentials:AirshipCredentials){let response:Response;try{response=await this.requester(url,{method:"GET",redirect:"error",signal:AbortSignal.timeout(30_000),cache:"no-store",headers:{Accept:"application/vnd.urbanairship+json; version=3",Authorization:`Bearer ${credentials.bearerToken}`,"User-Agent":"RelayConsole-Airship/1.0"}})}catch(error){if(error instanceof AirshipApiError)throw error;throw new AirshipApiError("provider_unavailable","Airship could not be reached.")}return this.response(response)}
  private async response(response:Response){const declared=Number(response.headers.get("content-length")??0);if(declared>1_000_000)throw this.validation("Airship response exceeds the 1 MB Relay boundary.");const raw=await response.text();if(Buffer.byteLength(raw,"utf8")>1_000_000)throw this.validation("Airship response exceeds the 1 MB Relay boundary.");let body:unknown;try{body=raw?JSON.parse(raw):null}catch{throw this.validation("Airship returned invalid JSON.",response.status)}if(!response.ok)throw new AirshipApiError(this.safeCode(response.status),`Airship returned HTTP ${response.status}.`,response.status);return body}
  private validate(credentials:AirshipCredentials){if(!credentials.bearerToken.trim()||credentials.bearerToken.length>30_000||/[\r\n]/.test(credentials.bearerToken))throw new AirshipApiError("credential_missing","A valid Airship bearer token is required.",401);this.origin(credentials.cloudSite)}
  private origin(site:string){const origin=AirshipApiAdapter.origins[site];if(!origin)throw this.validation("Airship cloud site is not allowlisted.");return origin}
  private uuid(value:unknown){return typeof value==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)?value.toLowerCase():null}
  private safeInteger(value:unknown){return typeof value==="number"&&Number.isSafeInteger(value)&&value>=0?value:null}
  private object(value:unknown):Obj{return value&&typeof value==="object"&&!Array.isArray(value)?value as Obj:{}}
  private safeCode(status:number):MarketplaceConnectorSafeErrorCode{if(status===401)return"token_expired";if(status===403||status===404)return"insufficient_scope";if(status===429)return"provider_rate_limited";if(status>=500)return"provider_unavailable";return"provider_validation_error"}
  private validation(message:string,statusCode?:number){return new AirshipApiError("provider_validation_error",message,statusCode)}
}
