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

  const minSeries = availableRows.map((row) => ({
    x: row.year,
    y: row.minPrice,
    notes: row.notes,
    sources: buildSources(row),
    minPrice: row.minPrice,
    maxPrice: row.maxPrice
  }));

  const maxSeries = availableRows.map((row) => ({
    x: row.year,
    y: row.maxPrice,
    notes: row.notes,
    sources: buildSources(row),
    minPrice: row.minPrice,
    maxPrice: row.maxPrice
  }));

  return new Chart(chartCanvas, {
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
          fill: false
        },
        {
          label: "Max price",
          data: maxSeries,
          borderColor: palette.red,
          backgroundColor: "rgba(219, 16, 32, 0.18)",
          pointBackgroundColor: palette.red,
          pointRadius: 3,
          tension: 0.25,
          fill: "-1"
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
          callbacks: {
            label: (context) => {
              const value = context.raw;
              return `Range: ${formatPrice(value.minPrice)} – ${formatPrice(value.maxPrice)}`;
            },
            afterLabel: (context) => {
              const value = context.raw;
              const notes = value.notes ? `Notes: ${value.notes}` : "Notes: None";
              const sources = `Sources: ${value.sources}`;
              return [notes, sources];
            }
          }
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
            stepSize: 5
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
            callback: (value) => `$${value}`
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
