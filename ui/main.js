
const map = L.map('map').setView([60.3, 24.8], 10);

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

const camGroup = L.layerGroup().addTo(map)

getWeatherCams()


async function getWeatherCams() {
    const response = await fetch("https://tie.digitraffic.fi/api/weathercam/v1/stations")
    const data = await response.json()
    console.log(data)
    L.geoJSON(data, {
        onEachFeature: (feature, layer) => {
            layer.bindPopup(feature.properties.name);
            layer.on("popupopen", () => {
                let content = feature.properties.name
                feature.properties.presets.forEach(preset => {
                    console.log(preset)
                    content += `<img src="https://weathercam.digitraffic.fi/${preset.id}.jpg?thumbnail=true">`
                });
                layer.setPopupContent(content)
            })
        }
    }).addTo(camGroup)

}