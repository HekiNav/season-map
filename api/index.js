import * as turf from "@turf/turf"

import { XMLParser, XMLBuilder, XMLValidator } from "fast-xml-parser"

import fs from "node:fs/promises"

import data_locations from "./data-locations.json" with {type: "json"}

const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix : "@_",
    attributesGroupName : "@_"
})


async function getWeatherData() {
    const url = `http://opendata.fmi.fi/wfs?
service=WFS&
version=2.0.0&
request=GetFeature&
storedquery_id=fmi::observations::weather::daily::timevaluepair&
place=hyytiälä&
starttime=2024-01-01&
endtime=2024-12-31`.replaceAll("\n", "")
    const response = await fetch(url)
    const xmlText = await response.text()
    const parsedXml = parser.parse(xmlText)

    const observations = get(parsedXml, data_locations.observations)
    const observationTypes = get(parsedXml,data_locations.station_type)

    const measurementData =
        get(parsedXml, data_locations.station_shape)
            .reduce((prev, curr, index, arr) => {
                const measurements = observations[index]
                const measurementType = observationTypes[index]
                return [...prev, {
                    name: curr["gml:name"],
                    lat: curr["gml:pos"].split(" ")[0],
                    lon: curr["gml:pos"].split(" ")[1],
                    type: measurementType,
                    measurements: measurements.map(m => ({time: m["wml2:time"], value: m["wml2:value"]}))
                }]
            }, [])

    fs.writeFile("./data.json", JSON.stringify(measurementData))

}

function get(source, config, ignoreStart = false) {
    const sourceData = config.start && !ignoreStart ? get(source, data_locations[config.start]) : source
    if (sourceData instanceof Array) {
        return sourceData.map(item => get(item, config, true))
    }
    return config.path.reduce((prev, curr) => {
        return prev[curr]
    }, sourceData)
}

getWeatherData()