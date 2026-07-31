# Asset licences and provenance

The root MIT licence covers source code and Relay Console assets that Alexander
Kerss created for this project. Those assets include the Relay Console name,
app icon, wordmarks, Agent Ops artwork and bundled fallback avatars.

## Marketplace provider marks

Provider names, logos and favicons belong to their respective owners. The MIT
licence does not grant rights to those third-party marks. Relay Console uses
them to identify compatible services and does not claim sponsorship or
endorsement.

The Marketplace atlas index at
`packages/marketplace-catalog/release/marketplace-icon-atlas-index.json` records
the source URL and SHA-256 digest for every image in the generated atlas. The
provider manifests under `packages/marketplace-catalog/providers/` record the
provider website and, where available, a dedicated icon source. The atlas build
script fetches favicons from provider origins or the Google favicon service and
records the fetched source before generating client copies.

Review a provider's brand and trademark terms before redistributing a modified
icon or using it outside Relay Console's service-selection interface. Replace
or remove a mark if its owner requires different treatment.

## System and dependency assets

Apple platform clients render SF Symbols supplied by the operating system;
Relay Console does not redistribute the SF Symbols library. Dependency licence
notices ship in `RelayConsoleSwift/Release/THIRD_PARTY_NOTICES.md` and
`ios/THIRD_PARTY_NOTICES.md`.
