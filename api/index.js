import * as turf from "@turf/turf"

import { XMLParser, XMLBuilder, XMLValidator } from "fast-xml-parser"

import fs from "node:fs/promises"

import data_locations from "./data-locations.json" with {type: "json"}

const parser = new XMLParser()


async function getWeatherData() {
    const url = `http://opendata.fmi.fi/wfs?
service=WFS&
version=2.0.0&
request=GetFeature&
storedquery_id=fmi::observations::weather::daily::timevaluepair&
place=hyytiälä&
starttime=2024-01-01&
endtime=2024-12-31`.replaceAll("\n", "")
    console.log(url)
    const response = await fetch(url)
    const xmlText = await response.text()
    const parsedXml = parser.parse(xmlText)

    //fs.writeFile("./data.json", JSON.stringify(parsedXml))

    console.log("final:", get(parsedXml, data_locations.station_shape))
}

function get(source, config, ignoreStart = false) {
    console.log(config)
    const sourceData = config.start && !ignoreStart ? get(source, data_locations[config.start]) : source
    if (sourceData instanceof Array) {
        return sourceData.map(item => get(item, config, true))
    }
    return config.path.reduce((prev, curr) => {
        return prev[curr]
    }, sourceData)
}

getWeatherData()