// APIs hardcoded (configuradas en el backend)
const GEOAPIFY_API_KEY = "57783cf686c74ec8be5ba4f134a942f6";
const GEMINI_API_KEY = "AIzaSyBTCjq97zKE3RX--eVlyhV8iI4s0emJFdM";

// Variables globales
let processedCount = 0;
let successCount = 0;
let errorCount = 0;
let geoapifyCallCount = 0;
let geminiCallCount = 0;
let allResults = [];
let currentFileData = null;
let isProcessing = false;
let shouldStop = false;
let startTime = null;
let detectedColumns = {
  address: null,
  zip: null,
  city: null,
  county: null,
};

// Constantes
const DELAY_BETWEEN_REQUESTS = 1100;
const GEMINI_DELAY = 2000;

// Inicialización
document.addEventListener("DOMContentLoaded", function () {
  setupFileUpload();
  log(
    "Sistema V4 inicializado - APIs preconfiguradas y detección automática activada",
    "success"
  );
});

// Función de logging
function log(message, type = "info") {
  const logsDiv = document.getElementById("logs");
  const logEntry = document.createElement("div");
  logEntry.className = `log-entry log-${type}`;
  logEntry.textContent = `${new Date().toLocaleTimeString()}: ${message}`;
  logsDiv.appendChild(logEntry);
  logsDiv.scrollTop = logsDiv.scrollHeight;

  console.log(`[${type.toUpperCase()}] ${message}`);
}

function clearLogs() {
  document.getElementById("logs").innerHTML =
    '<div class="log-entry log-info">Logs limpiados.</div>';
}

// Configurar drag & drop
function setupFileUpload() {
  const fileUploadArea = document.getElementById("fileUploadArea");
  const fileInput = document.getElementById("fileInput");

  fileUploadArea.addEventListener("dragover", (e) => {
    e.preventDefault();
    fileUploadArea.classList.add("dragover");
  });

  fileUploadArea.addEventListener("dragleave", () => {
    fileUploadArea.classList.remove("dragover");
  });

  fileUploadArea.addEventListener("drop", (e) => {
    e.preventDefault();
    fileUploadArea.classList.remove("dragover");
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  });

  fileInput.addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  });
}

// Manejar archivo subido
async function handleFile(file) {
  try {
    log(
      `Cargando archivo: ${file.name} (${formatFileSize(file.size)})`,
      "info"
    );

    const fileInfo = document.getElementById("fileInfo");
    const fileName = document.getElementById("fileName");
    const fileSize = document.getElementById("fileSize");
    const fileRows = document.getElementById("fileRows");

    fileName.textContent = `Nombre: ${file.name}`;
    fileSize.textContent = `Tamaño: ${formatFileSize(file.size)}`;
    fileInfo.classList.remove("hidden");

    // Leer archivo
    const data = await readFile(file);
    currentFileData = data;

    // Detectar columnas automáticamente
    const columns = Object.keys(data[0] || {});
    detectColumns(columns);

    fileRows.textContent = `Filas detectadas: ${data.length.toLocaleString()}`;

    // Mostrar detección de columnas
    showColumnDetection();

    // Habilitar procesamiento si se detectaron las columnas mínimas
    const canProcess = detectedColumns.address !== null;
    document.getElementById("processFileBtn").disabled = !canProcess;

    if (canProcess) {
      log(
        `Archivo cargado exitosamente: ${data.length} filas. Columnas detectadas.`,
        "success"
      );
    } else {
      log(
        `Archivo cargado, pero no se pudo detectar la columna de direcciones`,
        "warning"
      );
    }
  } catch (error) {
    log(`Error al procesar archivo: ${error.message}`, "error");
    alert(`Error al procesar archivo: ${error.message}`);
  }
}

// Detectar columnas automáticamente
function detectColumns(columns) {
  log("Iniciando detección automática de columnas...", "info");

  // Detectar columna de direcciones
  detectedColumns.address =
    columns.find(
      (col) =>
        col.toLowerCase().includes("address") ||
        col.toLowerCase().includes("street") ||
        col.toLowerCase().includes("direccion") ||
        col.toLowerCase().includes("display")
    ) || null;

  // Detectar columna de código postal
  detectedColumns.zip =
    columns.find(
      (col) =>
        col.toLowerCase().includes("zip") ||
        col.toLowerCase().includes("postal") ||
        col.toLowerCase().includes("code")
    ) || null;

  // Detectar columna de ciudad
  detectedColumns.city =
    columns.find(
      (col) =>
        col.toLowerCase().includes("city") ||
        col.toLowerCase().includes("ciudad") ||
        col.toLowerCase().includes("name")
    ) || null;

  // Detectar columna de condado
  detectedColumns.county =
    columns.find(
      (col) =>
        col.toLowerCase().includes("county") ||
        col.toLowerCase().includes("condado")
    ) || null;

  log(
    `Columnas detectadas: Address=${detectedColumns.address}, Zip=${detectedColumns.zip}, City=${detectedColumns.city}, County=${detectedColumns.county}`,
    "info"
  );
}

// Mostrar detección de columnas
function showColumnDetection() {
  const columnDetection = document.getElementById("columnDetection");
  const columnsList = document.getElementById("columnsList");

  columnsList.innerHTML = "";

  const columnTypes = [
    { key: "address", label: "📍 Dirección", required: true },
    { key: "zip", label: "📮 Código Postal", required: false },
    { key: "city", label: "🏙️ Ciudad", required: false },
    { key: "county", label: "🏛️ Condado", required: false },
  ];

  columnTypes.forEach((type) => {
    const columnItem = document.createElement("div");
    const detected = detectedColumns[type.key];
    const isDetected = detected !== null;

    columnItem.className = `column-item ${
      isDetected ? "column-detected" : "column-not-detected"
    }`;
    columnItem.innerHTML = `
            <strong>${type.label}:</strong>
            ${isDetected ? `✅ ${detected}` : "❌ No detectada"}
            ${type.required ? " (Requerida)" : " (Opcional)"}
        `;

    columnsList.appendChild(columnItem);
  });

  columnDetection.classList.remove("hidden");
}

// Leer archivo Excel/CSV
function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);
        resolve(jsonData);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error("Error al leer archivo"));
    reader.readAsArrayBuffer(file);
  });
}

// Procesar archivo completo
async function processFile() {
  if (!currentFileData || !detectedColumns.address) {
    alert(
      "No se puede procesar: archivo no válido o columna de direcciones no detectada"
    );
    return;
  }

  // Filtrar direcciones válidas
  const addresses = currentFileData.filter(
    (row) =>
      row[detectedColumns.address] &&
      row[detectedColumns.address].toString().trim()
  );

  if (addresses.length === 0) {
    alert("No se encontraron direcciones válidas en el archivo");
    return;
  }

  log(
    `Iniciando procesamiento automático de ${addresses.length} direcciones`,
    "info"
  );
  log(`Usando columnas: ${JSON.stringify(detectedColumns)}`, "info");

  // Inicializar variables
  isProcessing = true;
  shouldStop = false;
  startTime = Date.now();
  allResults = [];
  processedCount = 0;
  successCount = 0;
  errorCount = 0;
  geoapifyCallCount = 0;
  geminiCallCount = 0;

  // Mostrar progreso
  document.getElementById("progressSection").classList.remove("hidden");
  document.getElementById("processFileBtn").disabled = true;

  // Crear tabla de resultados
  createResultsTable();

  // Procesar cada dirección
  for (let i = 0; i < addresses.length && !shouldStop; i++) {
    const addressData = addresses[i];

    // Actualizar progreso
    updateProgress(
      i + 1,
      addresses.length,
      addressData[detectedColumns.address]
    );

    // Procesar dirección
    const result = await processAddress(addressData);

    // Agregar resultado
    allResults.push(result);
    addResultToTable(result);

    // Actualizar stats
    updateStats();

    // Pausa entre requests
    if (i < addresses.length - 1) {
      await sleep(DELAY_BETWEEN_REQUESTS);
    }
  }

  // Finalizar procesamiento
  isProcessing = false;
  document.getElementById("progressSection").classList.add("hidden");
  document.getElementById("processFileBtn").disabled = false;

  if (!shouldStop) {
    log(`Procesamiento completado: ${processedCount} direcciones`, "success");
    alert(
      `Procesamiento completado!\n${successCount} exitosas, ${errorCount} errores`
    );
  } else {
    log("Procesamiento detenido por el usuario", "warning");
  }
}

// Procesar una dirección individual
async function processAddress(addressData) {
  const address = addressData[detectedColumns.address];
  const zip = detectedColumns.zip ? addressData[detectedColumns.zip] : "";
  const city = detectedColumns.city ? addressData[detectedColumns.city] : "";
  const county = detectedColumns.county
    ? addressData[detectedColumns.county]
    : "";

  log(`Procesando: ${address}`, "info");

  try {
    // Paso 1: Geocodificar con Geoapify
    const geocodeResult = await geocodeWithGeoapify(address, zip, city, county);

    // Mostrar JSON de Geoapify en console
    console.log(
      "🌍 Geoapify Response:",
      JSON.stringify(geocodeResult, null, 2)
    );

    let finalResult = {
      ...addressData,
      original_address: address,
      status: "success",
      api_source: "Geoapify + Gemini",
      processed_at: new Date().toISOString(),
    };

    if (geocodeResult.success) {
      finalResult = {
        ...finalResult,
        formatted_address: geocodeResult.formatted,
        latitude: geocodeResult.latitude,
        longitude: geocodeResult.longitude,
        neighbourhood: geocodeResult.neighbourhood,
        suburb: geocodeResult.suburb,
        district: geocodeResult.district,
        confidence: geocodeResult.confidence,
        result_type: geocodeResult.result_type,
        "House Number": geocodeResult["House Number"],
      };

      // Paso 2: Enriquecer con Gemini
      try {
        log(
          `Obteniendo neighborhoods/communities con Gemini para: ${address}`,
          "info"
        );
        const geminiResult = await getNeighborhoodFromGemini(
          address,
          city,
          county
        );

        // Mostrar JSON de Gemini en console
        console.log(
          "🤖 Gemini Response:",
          JSON.stringify(geminiResult, null, 2)
        );

        if (geminiResult.success) {
          finalResult.neighborhoods = geminiResult.neighborhood;
          finalResult.comunidades = geminiResult.community;
          finalResult.gemini_source = "Gemini AI";

          log(
            `✅ Gemini exitoso: N=${geminiResult.neighborhood}, C=${geminiResult.community}`,
            "success"
          );
        } else {
          finalResult.gemini_error = geminiResult.error;
          log(`❌ Gemini error: ${geminiResult.error}`, "error");
        }

        await sleep(GEMINI_DELAY);
      } catch (geminiError) {
        log(`Error en Gemini para ${address}: ${geminiError.message}`, "error");
        finalResult.gemini_error = geminiError.message;
      }

      successCount++;
      log(`✅ Éxito: ${address}`, "success");
    } else {
      finalResult.status = "error";
      finalResult.error = geocodeResult.error;
      errorCount++;
      log(`❌ Error: ${address} - ${geocodeResult.error}`, "error");
    }

    processedCount++;
    return finalResult;
  } catch (error) {
    processedCount++;
    errorCount++;
    log(`❌ Error procesando ${address}: ${error.message}`, "error");

    return {
      ...addressData,
      original_address: address,
      status: "error",
      error: error.message,
      processed_at: new Date().toISOString(),
    };
  }
}

// Geocodificar con Geoapify
async function geocodeWithGeoapify(address, zip, city, county) {
  const fullAddress = `${address}, ${zip}, ${city}, ${county}`;
  const encodedAddress = encodeURIComponent(fullAddress);
  const url = `https://api.geoapify.com/v1/geocode/search?text=${encodedAddress}&apiKey=${GEOAPIFY_API_KEY}`;

  try {
    geoapifyCallCount++;
    log(`Geocodificando con Geoapify: ${fullAddress}`, "info");

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.features && data.features.length > 0) {
      const feature = data.features[0];
      const props = feature.properties;
      const coords = feature.geometry.coordinates;

      return {
        success: true,
        formatted: props.formatted || fullAddress,
        latitude: coords[1],
        longitude: coords[0],
        neighbourhood: props.neighbourhood || null,
        suburb: props.suburb || null,
        district: props.district || null,
        confidence: props.confidence || null,
        result_type: props.result_type || null,
        "House Number": props.housenumber || null,
      };
    } else {
      return {
        success: false,
        error: "No se encontraron resultados",
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

// Lista de Property Appraiser Sites para Florida
const floridaAppraisers = [
  { name: "Broward", site: "https://www.bcpa.net" },
  { name: "Miami-Dade", site: "https://www.miamidade.gov/pa" },
  { name: "Palm Beach", site: "https://www.pbcgov.org/papa" },
  { name: "Orange", site: "https://www.ocpafl.org" },
  { name: "Hillsborough", site: "https://www.hcpafl.org" },
  { name: "Duval", site: "https://paopropertysearch.coj.net" },
  { name: "Lee", site: "https://www.leepa.org" },
  { name: "Pinellas", site: "https://www.pcpao.org" },
  { name: "Collier", site: "https://www.collierappraiser.com" },
  { name: "Sarasota", site: "https://www.sc-pa.com" },
  { name: "St. Lucie", site: "https://www.paslc.org" },
];

// FUNCIÓN OPTIMIZADA DE GEMINI
async function getNeighborhoodFromGemini(address, city, county) {
  const fullAddress = `${address}, ${city}, ${county}, FL`;
  const currentTime = new Date().toLocaleString("es-ES", {
    timeZone: "America/New_York",
  });
  const appraiserSites = floridaAppraisers
    .map((a) => `- ${a.name}: ${a.site}`)
    .join("\n");

  // PROMPT OPTIMIZADO: indicar fuente de cada campo
  const optimizedPrompt = `Rol: Eres un especialista en enriquecimiento de datos geográficos con acceso a registros de propiedad, mapas de vecindarios, bases de datos del MLS y los sitios web oficiales de Property Appraiser de Florida (CurrentTime: ${currentTime}).\n\nSitios web de Property Appraiser recomendados para consulta:\n${appraiserSites}\n\nObjetivo: Para la dirección proporcionada, identifica y proporciona dos niveles específicos de información geográfica, indicando la fuente de cada dato (MLS, Appraiser, o Desconocido):\n\nDIRECCIÓN A ANALIZAR: ${fullAddress}\n\nDebes proporcionar:\n1. **Vecindario general**: Área geográfica amplia dentro de la ciudad (ej: \"Kendall Green\", \"Ives Estates\", \"Ocean Breeze\")\n2. **Subdivisión/Comunidad específica**: Desarrollo inmobiliario, subdivisión o comunidad específica (ej: \"Kendall Lake Addition\", \"Magnolia Gardens Consolid\", \"Pine Ridge At Delray Beach\")\n\nINSTRUCCIONES ESPECÍFICAS:\n- Consulta bases de datos MLS, registros de propiedad de Florida y los sitios web oficiales de Property Appraiser listados arriba (CurrentTime: ${currentTime})\n- Proporciona nombres exactos tal como aparecen en registros oficiales\n- Si una dirección tiene múltiples opciones, selecciona la más específica\n- Para subdivisiones, incluye números de sección si están disponibles\n- Si no tienes datos específicos para algún campo, usa \"No disponible\"\n- Indica la fuente de cada campo: 'MLS', 'Appraiser', o 'Desconocido'\n\nFORMATO DE RESPUESTA (JSON únicamente):\n{\n  "neighborhood": { "value": "nombre exacto del vecindario general", "source": "MLS|Appraiser|Desconocido" },\n  "community": { "value": "nombre exacto de la subdivisión/comunidad específica", "source": "MLS|Appraiser|Desconocido" }\n}\n\nEjemplo de respuesta correcta:\n{\n  "neighborhood": { "value": "Kendall Green", "source": "Appraiser" },\n  "community": { "value": "Kendall Lake Addition", "source": "MLS" }\n}`;

  try {
    geminiCallCount++;
    log(
      `🤖 Consultando Gemini con prompt optimizado para: ${fullAddress}`,
      "info"
    );

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: optimizedPrompt,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1, // Más determinístico
            topK: 10,
            topP: 0.8,
            maxOutputTokens: 500, // Incrementado para respuestas más completas
            stopSequences: ["}"], // Detener después del JSON
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Gemini API Error:", response.status, errorText);
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    console.log("🤖 Gemini Full Response:", JSON.stringify(data, null, 2));

    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      const text = data.candidates[0].content.parts[0].text.trim();
      console.log("🤖 Gemini Raw Text:", text);

      try {
        let cleanText = text
          .replace(/```json\n?/g, "")
          .replace(/```\n?/g, "")
          .replace(/\n/g, " ")
          .trim();

        // Estrategia: Buscar JSON con fuentes
        const jsonMatch = cleanText.match(
          /\{[^}]*"neighborhood"[^}]*"community"[^}]*\}/
        );
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          let neighborhood = parsed.neighborhood?.value || null;
          let neighborhoodSource = parsed.neighborhood?.source || null;
          let community = parsed.community?.value || null;
          let communitySource = parsed.community?.source || null;

          // Limpiar valores inválidos o genéricos
          const invalidValues = [
            "no disponible",
            "n/a",
            "no data",
            "unknown",
            "no específico",
            "no encontrado",
            "not available",
          ];
          if (
            neighborhood &&
            invalidValues.some((invalid) =>
              neighborhood.toLowerCase().includes(invalid.toLowerCase())
            )
          ) {
            neighborhood = null;
            neighborhoodSource = null;
          }
          if (
            community &&
            invalidValues.some((invalid) =>
              community.toLowerCase().includes(invalid.toLowerCase())
            )
          ) {
            community = null;
            communitySource = null;
          }
          if (!neighborhood && !community) {
            return {
              success: false,
              error:
                "No se encontraron datos específicos de vecindario o comunidad",
            };
          }
          const result = {
            success: true,
            neighborhood: neighborhood,
            neighborhood_source: neighborhoodSource,
            community: community,
            community_source: communitySource,
          };
          console.log("✅ Gemini Parsed Result:", result);
          return result;
        }
        // Estrategia 2: Buscar patrones alternativos
        const neighborhoodMatch = cleanText.match(
          /"neighborhood":\s*"([^"]+)"/
        );
        const communityMatch = cleanText.match(/"community":\s*"([^"]+)"/);

        if (neighborhoodMatch || communityMatch) {
          return {
            success: true,
            neighborhood: neighborhoodMatch ? neighborhoodMatch[1] : null,
            community: communityMatch ? communityMatch[1] : null,
          };
        }

        throw new Error("No se encontró JSON válido en la respuesta");
      } catch (parseError) {
        console.error("❌ Parse Error:", parseError.message);
        console.error("❌ Raw text was:", text);

        return {
          success: false,
          error: `Error de parsing: ${parseError.message}`,
        };
      }
    } else {
      console.error("❌ Gemini response structure invalid:", data);
      return {
        success: false,
        error: "Estructura de respuesta de Gemini inválida",
      };
    }
  } catch (error) {
    console.error("❌ Gemini Error:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Funciones auxiliares
function updateProgress(current, total, currentAddress) {
  const percentage = (current / total) * 100;
  document.getElementById("progressFill").style.width = percentage + "%";
  document.getElementById(
    "progressText"
  ).textContent = `Procesando ${current} de ${total} (${percentage.toFixed(
    1
  )}%) - ${currentAddress}`;
}

function updateStats() {
  document.getElementById("totalProcessed").textContent =
    processedCount.toLocaleString();
  document.getElementById("successRate").textContent =
    processedCount > 0
      ? `${((successCount / processedCount) * 100).toFixed(1)}%`
      : "0%";
  document.getElementById("geoapifyCount").textContent =
    geoapifyCallCount.toLocaleString();
  document.getElementById("geminiCount").textContent =
    geminiCallCount.toLocaleString();
}

function createResultsTable() {
  const resultsContainer = document.getElementById("resultsContainer");
  resultsContainer.innerHTML = `
        <table class="results-table">
            <thead>
                <tr>
                    <th>ML#</th>
                    <th>Address</th>
                    <th>Internet Display</th>
                    <th>Zip Code</th>
                    <th>City Name</th>
                    <th>County</th>
                    <th>House Number</th>
                    <th>Latitude</th>
                    <th>Longitude</th>
                    <th>Neighborhoods</th>
                    <th>Fuente Neighborhood</th>
                    <th>Comunidades</th>
                    <th>Fuente Community</th>
                    <th>Estado</th>
                    <th>Fuente</th>
                </tr>
            </thead>
            <tbody id="resultsTableBody">
            </tbody>
        </table>
    `;
}

function addResultToTable(result) {
  const tableBody = document.getElementById("resultsTableBody");
  const row = document.createElement("tr");

  let statusClass =
    result.status === "success" ? "status-success" : "status-error";
  let statusText =
    result.status === "success" ? "Éxito" : `Error: ${result.error}`;

  // Utilidad para buscar variantes de campo
  function getField(obj, keys) {
    for (const key of keys) {
      if (obj[key] !== undefined && obj[key] !== null && obj[key] !== "") {
        return obj[key];
      }
      // Buscar ignorando mayúsculas/minúsculas
      const foundKey = Object.keys(obj).find(
        (k) => k.toLowerCase() === key.toLowerCase()
      );
      if (
        foundKey &&
        obj[foundKey] !== undefined &&
        obj[foundKey] !== null &&
        obj[foundKey] !== ""
      ) {
        return obj[foundKey];
      }
    }
    return "N/A";
  }

  // MOSTRAR CORRECTAMENTE LOS DATOS DE GEMINI
  const geminiNeighborhood = result.neighborhoods || "N/A";
  const geminiCommunity = result.comunidades || "N/A";

  // INDICAR VISUALMENTE SI GEMINI PROPORCIONÓ DATOS
  const neighborhoodClass = result.neighborhoods
    ? "gemini-success"
    : "gemini-empty";
  const communityClass = result.comunidades ? "gemini-success" : "gemini-empty";

  row.innerHTML = `
        <td>${getField(result, ["ML#"]) || ""}</td>
        <td>${getField(result, ["Address"]) || "N/A"}</td>
        <td>${
          getField(result, ["Internet Display", "Address Internet Display"]) ||
          "N/A"
        }</td>
        <td>${getField(result, ["Zip Code", "zip"]) || "N/A"}</td>
        <td>${getField(result, ["City Name", "city"]) || "N/A"}</td>
        <td>${getField(result, ["County", "county"]) || "N/A"}</td>
        <td>${getField(result, ["House Number", "number"]) || "N/A"}</td>
        <td>${result.latitude ? result.latitude.toFixed(6) : "N/A"}</td>
        <td>${result.longitude ? result.longitude.toFixed(6) : "N/A"}</td>
        <td class="${neighborhoodClass}">${result.neighborhoods || "N/A"}</td>
        <td>${result.neighborhood_source || "N/A"}</td>
        <td class="${communityClass}">${result.comunidades || "N/A"}</td>
        <td>${result.community_source || "N/A"}</td>
        <td class="${statusClass}">${statusText}</td>
        <td>${result.api_source || "N/A"}</td>
    `;

  // LOG PARA DEBUG
  if (result.neighborhoods || result.comunidades) {
    log(
      `✅ Datos Gemini mostrados: Neighborhood=${geminiNeighborhood}, Community=${geminiCommunity}`,
      "success"
    );
  } else if (result.gemini_error) {
    log(`⚠️ Error Gemini para tabla: ${result.gemini_error}`, "warning");
  }

  tableBody.appendChild(row);
}

function stopProcessing() {
  shouldStop = true;
  log("Deteniendo procesamiento...", "warning");
}

function downloadResults() {
  if (allResults.length === 0) {
    alert("No hay resultados para descargar");
    return;
  }

  const headers = [
    "ML#",
    "Address",
    "Internet Display",
    "Zip Code",
    "City Name",
    "County",
    "House Number",
    "Latitude",
    "Longitude",
    "Neighborhoods",
    "Fuente Neighborhood",
    "Comunidades",
    "Fuente Community",
    "Estado",
    "Fuente API",
  ];

  function getField(obj, keys) {
    for (const key of keys) {
      if (obj[key] !== undefined && obj[key] !== null && obj[key] !== "") {
        return obj[key];
      }
      const foundKey = Object.keys(obj).find(
        (k) => k.toLowerCase() === key.toLowerCase()
      );
      if (
        foundKey &&
        obj[foundKey] !== undefined &&
        obj[foundKey] !== null &&
        obj[foundKey] !== ""
      ) {
        return obj[foundKey];
      }
    }
    return "";
  }

  const csvContent = [
    headers.join(","),
    ...allResults.map((result) =>
      [
        `"${getField(result, ["ML#"]) || ""}"`,
        `"${getField(result, ["Address"]) || ""}"`,
        `"${
          getField(result, ["Internet Display", "Address Internet Display"]) ||
          ""
        }"`,
        `"${getField(result, ["Zip Code", "zip"]) || ""}"`,
        `"${getField(result, ["City Name", "city"]) || ""}"`,
        `"${getField(result, ["County", "county"]) || ""}"`,
        `"${getField(result, ["House Number", "number"]) || ""}"`,
        result.latitude || "",
        result.longitude || "",
        `"${result.neighborhoods || ""}"`,
        `"${result.neighborhood_source || ""}"`,
        `"${result.comunidades || ""}"`,
        `"${result.community_source || ""}"`,
        result.status || "",
        `"${result.api_source || ""}"`,
      ].join(",")
    ),
  ].join("\n");

  const blob = new Blob([csvContent], {
    type: "text/csv;charset=utf-8;",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `resultados_geograficos_${new Date().getTime()}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function clearResults() {
  allResults = [];
  document.getElementById("resultsContainer").innerHTML = `
        <p style="text-align: center; color: #6c757d; padding: 40px;">
            No hay resultados aún. Sube un archivo para comenzar.
        </p>
    `;

  // Reset stats
  processedCount = 0;
  successCount = 0;
  errorCount = 0;
  geoapifyCallCount = 0;
  geminiCallCount = 0;
  updateStats();
}

function previewFile() {
  if (!currentFileData) {
    alert("No hay archivo cargado");
    return;
  }

  const preview = currentFileData.slice(0, 5);
  const previewText = JSON.stringify(preview, null, 2);

  const previewWindow = window.open("", "_blank", "width=800,height=600");
  previewWindow.document.write(`
        <html>
            <head><title>Vista Previa del Archivo</title></head>
            <body>
                <h2>Vista Previa - Primeras 5 filas</h2>
                <pre>${previewText}</pre>
            </body>
        </html>
    `);
}

function formatFileSize(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
