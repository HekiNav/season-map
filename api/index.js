import * as turf from "@turf/turf"
import { XMLParser, XMLBuilder, XMLValidator } from "fast-xml-parser"
import fs from "node:fs/promises"
import * as sync_fs from "node:fs"
import express from "express"
import data_locations from "./data/fmi-data-locations.json" with {type: "json"}

const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    attributesGroupName: "@_"
})

const bbox = [19, 59, 33, 71]

let voronoiGeoJson, dailySeasons
getData()

const app = express()

app.on("ready", () => {
    console.log("Listening on port ")
})




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

    const measurementData = {
        start_time: start_time,
        end_time: yesterday,
        stations: get(parsedXml, data_locations.station_shape)
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
    }

    console.timeLog("weather_data", "parsed, writing fmi-data.json")

    await fs.writeFile("./data/fmi-data.json", JSON.stringify(measurementData))

    console.timeEnd("weather_data")
    return measurementData
}

async function processWeatherData() {
    console.time("weather_data_processing")
    const { stations, start_time, end_time } = await getOrGenerate("./data/fmi-data.json", getWeatherData, Date.now() - 21 * 60 * 60 * 1000)

    const finland_shape = JSON.parse((await fs.readFile("./data/finland.geojson")).toString())

    console.timeLog("weather_data_processing", "loaded fmi-data.json, processing seasons")

    const seasons = stations.map(station => {
        const [labels, changes] = getSeasons(station.measurements)
        return { ...station, seasons: labels, seasonChanges: changes }
    })

    console.timeLog("weather_data_processing", "processed seasons, writing seasons.json")

    await fs.writeFile("./data/daily-seasons.json", JSON.stringify(seasons))

    console.timeLog("weather_data_processing", "wrote daily-seasons.json, generating voronoi pattern")

    const station_points = {
        type: "FeatureCollection",
        features: stations.map(s => turf.point([s.lon, s.lat], { name: s.name }))
    }
    const voronoi = turf.voronoi(station_points, { bbox: bbox })

    const clippedVoronoi = turf.featureCollection(
        voronoi.features
            .map(f => turf.intersect(turf.featureCollection([f, finland_shape]), { properties: f.properties }))
            .filter(f => f)
    );

    console.timeLog("weather_data_processing", "processed voronoi pattern, writing voronoi.json")

    await fs.writeFile("./data/voronoi.geojson", JSON.stringify(clippedVoronoi))

    console.timeLog("weather_data_processing", "wrote voronoi.geojson, generating daily seasons")

    const amount_days = (new Date(end_time) - new Date(start_time)) / 1000 / 3600 / 24

    const geojsonsByDay = { start_time: start_time, end_time: end_time }

    for (let i = 0; i <= amount_days; i++) {
        const day = new Date(start_time).getTime() + i * 24 * 3600 * 1000
        const dataByStation = seasons.map(s => ({ name: s.name, value: s.seasons.find(e => new Date(e.time).getTime() == day) }))
        geojsonsByDay[new Date(day).toISOString()] = dataByStation.reduce((prev, curr) => ({ ...prev, [curr.name]: curr.value ? curr.value.season : null }), {})
    }
    console.timeLog("weather_data_processing", "generated daily seasons, writing daily-seasons.json")

    await fs.writeFile("./data/daily-seasons.json", JSON.stringify(geojsonsByDay))

    console.timeEnd("weather_data_processing")

    return geojsonsByDay
}

function getSeasons(data = []) {
    const seasonLabels = data.map(e => ({ season: classify(e.value), time: e.time, days: e.days }))

    let currentSeason = seasonLabels[0].season


    const seasonChanges = [{
        time: seasonLabels[0].time, days: seasonLabels[0].days, season:
            seasonLabels[0].season == 1 ?
                currentSeason == 2 ? 3 : 1 :
                seasonLabels[0].season
    }]

    // checks if the next x days are the same to rule out short variations in temperatures
    const requiredStreak = 4

    for (let i = 1; i < seasonLabels.length; i++) {
        const values = seasonLabels.slice(i, i + requiredStreak).map((v) =>
        ({
            ...v, season: v.season == 1 ?
                currentSeason >= 2 ? 3 : 1 :
                v.season
        })
        )
        //current day
        const season = values[0].season
        if (season !== currentSeason && values.every(v => v.season == values[0].season)) {
            seasonChanges.push({
                time: seasonLabels[i].time, days: seasonLabels[i].days, season: season
            })
            currentSeason = season
        }
        seasonLabels[i].season = currentSeason
    }

    return [seasonLabels, seasonChanges];
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
function getOrGenerate(file, generation_func, timestamp) {
    return new Promise(resolve => {
        sync_fs.access(file, (err) => {
            if (err) {
                // if file is mising, generate
                console.log(`File ${file} is missing, generating`)
                if (err.code == "ENOENT") generation_func().then(resolve)
                else throw err
            } else {
                fs.readFile(file).then((data) => {
                    const json = JSON.parse(data.toString())
                    // if data is expired, generate new
                    console.log(`Data in ${file} is expired, generating new data`)
                    if ((timestamp - new Date(json.end_time)) > 24 * 3600 * 1000) {
                        generation_func().then(resolve)
                    } else {
                        resolve(json)
                    }

                })
            }
        })
    })
}
async function getData() {
    dailySeasons = await getOrGenerate("./data/daily-seasons.json", processWeatherData, Date.now() - 21 * 60 * 60 * 1000)
    voronoiGeoJson = (await fs.readFile("./data/voronoi.geojson")).buffer
}
