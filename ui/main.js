///  <reference path="./node_modules/@types/leaflet/index.d.ts" />

const map = L.map('map', {
    zoomControl: false
}).setView([65, 26], 5);

const API_URL = "http://127.0.0.1:3001"

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

const layerGroup = L.layerGroup().addTo(map)

let currentDate = null
let seasonData = null
let tick = 0

let dateBounds = { min: 0, max: 0 }

initMap()

const seasonColors = [
    "white",  //winter
    "yellow", //spring
    "green",  //summer
    "orange", //fall
]


let playSpeed = 0

let prevValue = 0

const playButton = document.querySelector("#play")

const tps = 10

setInterval(play, 1000 / tps)

document.querySelectorAll(".player:not(input)").forEach(el => {
    el.addEventListener("click", (e) => {
        switch (el.id) {
            case "skip-start":
                setDate(dateBounds.min, false)
                break;
            case "skip-end":
                setDate(dateBounds.max, false)
                break;
            default:
                break;
        }
        pausePlayer()
    })
})

document.querySelectorAll("input.player:not(#play)").forEach(el => {
    el.addEventListener("click", (e) => {
        switch (e.target.getAttribute("for") || e.target.id) {
            case "fast-forward":
                playSpeed = 10
                break
            case "fast-backward":
                playSpeed = -10
                break
            default:
                break
        }
        if (e.target.checked) {
            unPausePlayer()
        }
    })
})

playButton.addEventListener("click", (e) => {
    if (playButton.classList.contains("paused")) {
        unPausePlayer()
        playSpeed = 1
    } else {
        pausePlayer()
    }
})

function unPausePlayer() {
    playButton.classList.remove("paused")
}

function play() {
    tick = (tick + 1) % 1000
    if (tick % (tps / playSpeed) == 0) setDate(Math.sign(playSpeed), true, false)
}

function setDate(amount, relative = true, pause = true) {
    const range = document.querySelector("#date-range")
    const newValue = Math.min(dateBounds.max, Math.max(dateBounds.min, (relative ? Number(range.value) : 0) + amount))
    if (prevValue == newValue) return
    range.value = newValue
    prevValue = newValue

    currentDate = new Date(new Date(seasonData.start_time).getTime() + range.value * 24 * 3600 * 1000).toISOString().split("T")[0]
    updateMapColors()

    document.querySelector("#date").textContent = currentDate

    if (pause) pausePlayer()
}
function setDateBounds(start_time, end_time) {
    const range = document.querySelector("#date-range")

    document.querySelector("#date-range-start").textContent = start_time
    document.querySelector("#date-range-end").textContent = end_time

    range.removeAttribute("disabled")

    const diff = new Date(end_time) - new Date(start_time)

    const max = diff / 24 / 3600 / 1000;
    range.setAttribute("max", max)

    dateBounds.min = 0
    dateBounds.max = max
}

function pausePlayer() {
    document.querySelectorAll("input.player").forEach(el => el.checked = false)
    playButton.classList.add("paused")
    playSpeed = 0
}

async function initMap() {
    const [voronoiGeoJson, seasonDataJson] = await Promise.all([(await fetch(API_URL + "/map.geojson")).json(), (await fetch(API_URL + "/seasons.json")).json()])
    L.geoJSON(voronoiGeoJson, {
        onEachFeature: (feature, layer) => {
            layer.bindPopup(feature.properties.name);
        },
        smoothFactor: 0
    }).addTo(layerGroup)
    console.log(seasonDataJson)
    seasonData = seasonDataJson
    setDateBounds(seasonData.start_time, seasonData.end_time)
    currentDate = seasonData.start_time
    document.querySelector("#date").textContent = currentDate
    updateMapColors()
}
function updateMapColors() {
    layerGroup.eachLayer(l => {
        l.setStyle((feature) => ({
            stroke: false,
            fillOpacity: 0.5,
            color: seasonColors[seasonData[currentDate][feature.properties.name]]
        }))
    })
}