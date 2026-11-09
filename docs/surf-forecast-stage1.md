# Seven-day swell explorer

The first forecast upgrade preserves the daily chart and hourly table while adding a seven-day SVG graph below them. Switch between height and period, toggle combined sea/swell/secondary/tertiary/wind-wave series, and inspect any hour with a keyboard slider or chart tap. The readout includes each component's height, period, and direction. Expand the accessible table for daily maximum heights.

The existing Open-Meteo best-match marine endpoint still supplies seven days in one request. Newly requested fields are swell direction, secondary/tertiary swell height/period/direction, and wind-wave height/period/direction. See [the provider documentation](https://open-meteo.com/en/docs/marine-weather-api). Availability varies by model and location; unavailable series are disabled, missing samples create gaps, and missing daily values remain dashes. A Nags Head live check returned 168 hourly secondary-swell samples; tertiary swell was unavailable in best-match data.

Wave heights are significant modeled heights, not breaking-wave observations. Combined sea includes the components; heights cannot be added arithmetically. Swell partition ordering can change between hours and is not persistent storm tracking. All times use the selected location's IANA timezone. The existing feet/metres selector also updates the weekly graph.

This stage does not add observed buoys, tides, interactive maps, saved comparison locations, directional spectra, or a calibrated beach-break model. Those are possible later additions; the current goal is a useful weekly component graph using the existing data and interface.
