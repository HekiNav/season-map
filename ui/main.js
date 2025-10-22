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

initMap()

const seasonColors = [
    "white",  //winter
    "yellow", //spring
    "green",  //summer
    "orange", //fall
]

document.querySelector("#play").addEventListener("click", (e) => {
	e.preventDefault()
	e.target.checked = !e.target.checked
})


async function initMap() {
    const [voronoiGeoJson, seasonDataJson] = await Promise.all([(await fetch(API_URL + "/map.geojson")).json(), (await fetch(API_URL + "/seasons.json")).json()])
    L.geoJSON(voronoiGeoJson, {
        onEachFeature: (feature, layer) => {
            layer.bindPopup(feature.properties.name);
        },
        smoothFactor: 0
    }).addTo(layerGroup)
    console.log(seasonDataJson)
    currentDate = "2025-07-07"
    seasonData = seasonDataJson
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