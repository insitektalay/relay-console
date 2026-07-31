#!/usr/bin/env bash

relay_load_owner_configuration() {
  local relay_root_dir="$1"
  local relay_config_path="${RELAY_CONSOLE_OWNER_ENV_FILE:-$relay_root_dir/Config/owner.env}"
  [[ -f "$relay_config_path" ]] || return 0

  local relay_mode
  if relay_mode=$(/usr/bin/stat -f '%OLp' "$relay_config_path" 2>/dev/null); then
    :
  elif relay_mode=$(stat -c '%a' "$relay_config_path" 2>/dev/null); then
    :
  else
    echo "Could not inspect Relay Console owner configuration permissions." >&2
    return 1
  fi
  if (( 10#$relay_mode % 100 != 0 )); then
    echo "Relay Console owner configuration must not grant group or other access." >&2
    return 1
  fi

  local relay_line relay_key relay_value
  while IFS= read -r relay_line || [[ -n "$relay_line" ]]; do
    relay_line="${relay_line%$'\r'}"
    [[ -z "$relay_line" || "$relay_line" == \#* ]] && continue
    if [[ ! "$relay_line" =~ ^([A-Z][A-Z0-9_]*)=(.*)$ ]]; then
      echo "Relay Console owner configuration contains an invalid line." >&2
      return 1
    fi
    relay_key="${BASH_REMATCH[1]}"
    relay_value="${BASH_REMATCH[2]}"
    case "$relay_key" in
      CLAWCHAT_RAILWAY_ORIGIN|NEXT_PUBLIC_RAILWAY_WS_BASE_URL|RELAY_POSTHOG_PROJECT_TOKEN|RELAY_POSTHOG_HOST|RELAY_SENTRY_DSN|RELAY_TELEMETRY_ENVIRONMENT|SENTRY_AUTH_TOKEN|SENTRY_ORG|SENTRY_PROJECT) ;;
      *)
        echo "Relay Console owner configuration contains an unsupported key: $relay_key" >&2
        return 1
        ;;
    esac
    if [[ "$relay_value" == \"*\" && "$relay_value" == *\" ]]; then
      relay_value="${relay_value:1:${#relay_value}-2}"
    elif [[ "$relay_value" == \'*\' && "$relay_value" == *\' ]]; then
      relay_value="${relay_value:1:${#relay_value}-2}"
    fi
    if ! declare -p "$relay_key" >/dev/null 2>&1; then
      export "$relay_key=$relay_value"
    fi
  done < "$relay_config_path"
}
