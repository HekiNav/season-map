import * as turf from "@turf/turf"

import { XMLParser, XMLBuilder, XMLValidator } from "fast-xml-parser"

import fs from "node:fs/promises"

import data_locations from "./data-locations.json" with {type: "json"}

const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    attributesGroupName: "@_"
})

const bbox = [20.6455928891, 59.846373196, 31.5160921567, 70.1641930203]


async function getWeatherData() {
    console.time("weather_data")

    const nowInUTC3 = Date.now() - 21 * 60 * 60 * 1000

    const yesterday = new Date(nowInUTC3).toISOString().split("T")[0]

    // - one year
    const start_time = new Date(nowInUTC3 - 31556952000).toISOString().split("T")[0]


    const url = `http://opendata.fmi.fi/wfs?
service=WFS&
version=2.0.0&
request=GetFeature&
storedquery_id=fmi::observations::weather::daily::timevaluepair&
bbox=${bbox.toString()},epsg::4326&
parameters=tday&
starttime=${start_time}&
endtime=${yesterday}`.replaceAll("\n", "")
    console.timeLog("weather_data", "initted, fetching " + url)

    const response = await fetch(url)
    const xmlText = await response.text()

    console.timeLog("weather_data", "fetched, parsing")

    const parsedXml = parser.parse(xmlText)

    const observations = get(parsedXml, data_locations.observations)
    const observationTypes = get(parsedXml, data_locations.station_type)

    const measurementData =
        get(parsedXml, data_locations.station_shape)
            .reduce((prev, curr, index, arr) => {
                const measurements = observations[index]
                const measurementType = observationTypes[index]
                return [...prev, {
                    name: curr["gml:name"],
                    lat: curr["gml:pos"].split(" ")[0],
                    lon: curr["gml:pos"].split(" ")[1],
                    type: {
                        id: /&param=(.*)&/g.exec(measurementType)[1],
                        descUrl: measurementType
                    },
                    measurements: measurements.map(m => ({ time: m["wml2:time"], value: m["wml2:value"] }))
                }]
            }, [])

    console.timeLog("weather_data", "parsed, wrining data")

    await fs.writeFile("./data.json", JSON.stringify(measurementData))

    console.timeEnd("weather_data")

}

async function processWeatherData() {
    const data = JSON.parse(await (await fs.readFile("./data.json")).toString())
    // how many days to average out
    const days = 7

    const seasons = data.map(station => {
        const stationfollowingAverages = station.measurements.map((m, i, a) => {
            const values = a.slice(i, i + days)
            return { time: m.time, days: values.length, value: Math.round(values.reduce((prev, curr) => prev + curr.value, 0) / values.length * 10) / 10 }
        })
        station.seasons = getSeasons(stationfollowingAverages)
        return station
    })
    await fs.writeFile("./data-seasons.json", JSON.stringify(seasons))
}

function getSeasons(data) {
    const seasonLabels = data.map(e => ({ season: classify(e.value), time: e.time, days: e.days }))

    let currentSeason = seasonLabels[0].season

    const seasonChanges = [{
        time: seasonLabels[0].time, days: seasonLabels[0].days, season:
            seasonLabels[0].season == 1 ?
                currentSeason == 2 ? 3 : 1 :
                seasonLabels[0].season
    }]


    for (let i = 0; i < seasonLabels.length; i++) {
        if (seasonLabels[i].season !== currentSeason) {
            seasonChanges.push({
                time: seasonLabels[i].time, days: seasonLabels[i].days, season:
                    seasonLabels[i].season == 1 ?
                        currentSeason == 2 ? 3 : 1 :
                        seasonLabels[i].season
            })
            currentSeason = seasonLabels[i].season
        }
    }

    return seasonChanges;
}

function classify(temp) {
    if (temp < 0) return 0 // winter
    else if (temp <= 10) return 1 // spring fall
    else return 2 // summer
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

processWeatherData()