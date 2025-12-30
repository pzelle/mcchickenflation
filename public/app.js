const chartCanvas = document.getElementById("priceChart");

const palette = {
  gold: "#ffd700",
  red: "#db1020",
  green: "#27742d",
  cream: "#f9f5f5",
  black: "#111111"
};

const formatPrice = (value) => (value === null ? "N/A" : `$${value.toFixed(2)}`);

const buildSources = (entry) => {
  const sources = [
    entry.sourceHistory,
    entry.sourceCpiContext,
    entry.sourceValueMenuAnchors,
    entry.sourceRecentPricingAnchors
  ]
    .filter(Boolean)
    .join(" | ");

  return sources || "No sources listed.";
};

const linkifyText = (text) => {
  if (!text) {
    return "";
  }

  const urlRegex = /(https?:\/\/[^\s;]+)/g;
  return text.replace(urlRegex, (url) => `<a href="${url}" target="_blank" rel="noreferrer">${url}</a>`);
};

const ensureTooltipElement = (chart) => {
  const existing = chart.canvas.parentNode.querySelector(".chart-tooltip");
  if (existing) {
    return existing;
  }

  const tooltip = document.createElement("div");
  tooltip.className = "chart-tooltip";
  tooltip.innerHTML = "<div class=\"chart-tooltip-content\"></div>";
  chart.canvas.parentNode.appendChild(tooltip);
  return tooltip;
};

const missingMarkerPlugin = {
  id: "missingMarkerPlugin",
  afterDatasetsDraw(chart, _args, pluginOptions) {
    const { ctx, scales } = chart;
    const { missingYears } = pluginOptions;

    if (!missingYears || missingYears.length === 0) {
      return;
    }

    ctx.save();
    ctx.font = "20px Montserrat";
    ctx.textAlign = "center";
    ctx.fillStyle = palette.red;

    missingYears.forEach((year) => {
      const x = scales.x.getPixelForValue(year);
      const y = scales.y.getPixelForValue(0.25);
      ctx.fillText("😢", x, y);
    });

    ctx.restore();
  }
};

const buildChart = (rows) => {
  const availableRows = rows.filter((row) => row.available !== false && row.minPrice !== null && row.maxPrice !== null);
  const missingRows = rows.filter((row) => row.available === false || row.minPrice === null || row.maxPrice === null);
  const allYears = rows.map((row) => row.year).sort((a, b) => a - b);

  const rowByYear = new Map(rows.map((row) => [row.year, row]));

  const minSeries = allYears.map((year) => {
    const row = rowByYear.get(year);
    if (!row || row.available === false || row.minPrice === null || row.maxPrice === null) {
      return { x: year, y: null };
    }

    return {
      x: year,
      y: row.minPrice,
      notes: row.notes,
      sources: buildSources(row),
      minPrice: row.minPrice,
      maxPrice: row.maxPrice
    };
  });

  const maxSeries = allYears.map((year) => {
    const row = rowByYear.get(year);
    if (!row || row.available === false || row.minPrice === null || row.maxPrice === null) {
      return { x: year, y: null };
    }

    return {
      x: year,
      y: row.maxPrice,
      notes: row.notes,
      sources: buildSources(row),
      minPrice: row.minPrice,
      maxPrice: row.maxPrice
    };
  });

  let tooltipLocked = false;
  let lockedIndex = null;

  const externalTooltipHandler = (context) => {
    const { chart, tooltip } = context;
    const tooltipEl = ensureTooltipElement(chart);
    const content = tooltipEl.querySelector(".chart-tooltip-content");

    if (tooltip.opacity === 0) {
      if (!tooltipLocked) {
        tooltipEl.style.opacity = 0;
      }
      return;
    }

    const dataPoint = tooltip.dataPoints?.[0];
    if (!dataPoint) {
      return;
    }

    const raw = dataPoint.raw;
    const year = raw.x ? String(raw.x) : "";
    const notes = raw.notes ? linkifyText(raw.notes) : "None";
    const sources = raw.sources ? linkifyText(raw.sources) : "No sources listed.";
    const range = `Range: ${formatPrice(raw.minPrice)} – ${formatPrice(raw.maxPrice)}`;

    content.innerHTML = `
      <div class="tooltip-title">${year}</div>
      <div class="tooltip-range">${range}</div>
      <div class="tooltip-section"><strong>Notes:</strong> ${notes}</div>
      <div class="tooltip-section"><strong>Sources:</strong> ${sources}</div>
    `;

    const { offsetLeft: positionX, offsetTop: positionY } = chart.canvas;
    tooltipEl.style.opacity = 1;
    tooltipEl.style.left = `${positionX + tooltip.caretX}px`;
    tooltipEl.style.top = `${positionY + tooltip.caretY}px`;
  };

  const chartInstance = new Chart(chartCanvas, {
    type: "line",
    data: {
      datasets: [
        {
          label: "Min price",
          data: minSeries,
          borderColor: palette.green,
          backgroundColor: "rgba(39, 116, 45, 0.15)",
          pointBackgroundColor: palette.green,
          pointRadius: 3,
          tension: 0.25,
          fill: false,
          spanGaps: false
        },
        {
          label: "Max price",
          data: maxSeries,
          borderColor: palette.red,
          backgroundColor: "rgba(219, 16, 32, 0.18)",
          pointBackgroundColor: palette.red,
          pointRadius: 3,
          tension: 0.25,
          fill: "-1",
          spanGaps: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      parsing: false,
      plugins: {
        legend: {
          display: true,
          labels: {
            color: palette.black,
            usePointStyle: true
          }
        },
        tooltip: {
          enabled: false,
          external: externalTooltipHandler
        },
        missingMarkerPlugin: {
          missingYears: missingRows.map((row) => row.year)
        }
      },
      scales: {
        x: {
          type: "linear",
          ticks: {
            color: palette.black,
            stepSize: 5,
            callback: (value) => `${value}`
          },
          grid: {
            color: "rgba(17, 17, 17, 0.08)"
          },
          title: {
            display: true,
            text: "Year",
            color: palette.black,
            font: {
              weight: "600"
            }
          }
        },
        y: {
          min: 0,
          max: 5,
          ticks: {
            color: palette.black,
            callback: (value) => `$${Number(value).toFixed(2)}`
          },
          grid: {
            color: "rgba(17, 17, 17, 0.08)"
          },
          title: {
            display: true,
            text: "Price (USD)",
            color: palette.black,
            font: {
              weight: "600"
            }
          }
        }
      }
    },
    plugins: [missingMarkerPlugin]
  });

  chartCanvas.addEventListener("click", (event) => {
    const elements = chartInstance.getElementsAtEventForMode(event, "nearest", { intersect: true }, true);
    if (elements.length > 0) {
      const pointIndex = elements[0].index;
      if (tooltipLocked && lockedIndex === pointIndex) {
        tooltipLocked = false;
        lockedIndex = null;
      } else {
        tooltipLocked = true;
        lockedIndex = pointIndex;
      }
    } else {
      tooltipLocked = false;
      lockedIndex = null;
    }

    const tooltip = chartInstance.tooltip;
    if (tooltipLocked && elements.length > 0) {
      tooltip.setActiveElements(elements, { x: event.offsetX, y: event.offsetY });
    } else {
      tooltip.setActiveElements([], { x: 0, y: 0 });
    }
    chartInstance.update();
  });

  return chartInstance;
};

const loadData = async () => {
  try {
    const response = await fetch("/api/prices");
    if (!response.ok) {
      throw new Error("Unable to load data");
    }

    const payload = await response.json();
    const rows = payload.data
      .filter((row) => row.year)
      .sort((a, b) => a.year - b.year);

    buildChart(rows);
  } catch (error) {
    chartCanvas.parentElement.innerHTML = `
      <div class="chart-error">
        <strong>Unable to load chart data.</strong>
        <span>Please check the CSV and try again.</span>
      </div>
    `;
    console.error(error);
  }
};

loadData();
