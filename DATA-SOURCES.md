# Display reference data

Snapshot downloaded 28 September 2026. These reference tables and icons are embedded in `index.html`. No extra API or CDN requests are made for airline or aircraft metadata.

- **Airlines/operators:** Virtual Radar Server [standing-data](https://github.com/vradarserver/standing-data), `airlines/schema-01/airlines.csv`, CC0 1.0. 5,904 ICAO prefixes. Matching requires a three-letter prefix, a 1–5 character alphanumeric suffix containing a digit, and a callsign that differs from the supplied registration. This is an inference; it does not identify an aircraft owner or guarantee the operating carrier. Unknown, private-looking and unmatched identifiers are left unknown. Historical or reassigned codes may produce outdated matches.
- **Aircraft types:** the same repository, `model-type/schema-01/*.csv`, CC0 1.0. 2,697 active type codes. Unique names are used directly; common ambiguous codes use broad family labels. Other ambiguous codes retain the reported description or type code. Helicopter markers require an unambiguous helicopter type; absent metadata is never inferred from an airline.
- **Brand icons:** [Simple Icons](https://github.com/simple-icons/simple-icons), CC0 1.0. 15 selected monochrome brand icons; other operators show their ICAO code. Source slugs: airfrance, americanairlines, britishairways, delta, easyjet, emirates, iberia, klm, lufthansa, qatarairways, ryanair, singaporeairlines, turkishairlines, unitedairlines, wizzair. Logos identify inferred operators, not ownership or affiliation. See the bundled disclaimer for trademark considerations.

Licenses and upstream credits are in `LICENSES/`. The source repositories contain the current versions. Replacing the bundled tables is an explicit app update; these snapshots do not update themselves.

## Display rules

- Aircraft registration and type are shown only when the flight provider supplies them. OpenSky does not include these fields.
- No origin, destination, flight photograph, scheduled flight number or route is fabricated.
- Climbing/descending uses reported vertical rate greater than +150 / less than −150 ft/min. Other finite rates show level; absent rates show unavailable. This is a motion label, not a confirmed flight-plan phase.
- Saved aircraft are browser-local ICAO-identifier bookmarks, limited to 300. The saved filter includes only recent observations within the current area.
- Geographic requests retain the existing providers, rate-limit cooldowns, authentication and deadlines. Follow mode adds single-ICAO lookups using the documented provider endpoints. Mode changes respect the current polling delay.

## Mode endpoint references

- adsb.fi: https://github.com/adsbfi/opendata/blob/main/README.md (`/api/v2/hex/{hex}` and `/api/v3/lat/{lat}/lon/{lon}/dist/{nm}`).
- ADSB.lol: https://api.adsb.lol/docs (`/v2/hex/{hex}` and `/v2/point/{lat}/{lon}/{radius}`).
- OpenSky: https://openskynetwork.github.io/opensky-api/rest.html (`/states/all?icao24={hex}` or geographic bounding parameters).

Endpoint support was checked against provider documentation on 29 September 2026. Access, quotas and actual coverage depend on the provider. Follow trails and last-known positions contain actual reported observations from this session, never an estimated flight path.
