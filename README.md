# Season map
An interactive map that shows seasons in Finland. The data observation data is fetched from [FMI's WMS api](http://opendata.fmi.fi/wfs?service=WFS&version=2.0.0&request=GetCapabilities) and parsed into a balanced season map output

## Features
### Map
- Fetching data from the API
- A player for timelapses and a slider to select individual points in data
- An interactive map with Leaflet
- A modern look with Bootstrap
- Responsive layout for mobile and desktop
### Api
- Getting mesurement station data from the Finnish Meteorogical Institute
- Parsing the XML with fast-xml-parser
- Processing the data to and caching it in `fmi-data.json`
- Processing the cached data
    - Creating a voronoi pattern GeoJson with turf.js
    - Determining seasons from daily average temperatures with multiple ways of filtering short changes in temperatures
- Making the data accessible with express.js
## Demo

## Running the API locally

1. clone the repoitory
2. `cd api` Move to the api directory
3. `npm install` Install the dependencies
4. `npm run dev` Run in node

or run in prod

4. `npm start`