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

  const data = availableRows.map((row) => ({
    x: row.year,
    y: [row.minPrice, row.maxPrice],
    notes: row.notes,
    sources: buildSources(row)
  }));

  return new Chart(chartCanvas, {
    type: "bar",
    data: {
      datasets: [
        {
          label: "Price range",
          data,
          backgroundColor: palette.gold,
          borderColor: palette.red,
          borderWidth: 2,
          borderRadius: 8,
          barPercentage: 0.8,
          categoryPercentage: 0.9
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      parsing: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              const value = context.raw;
              const min = Array.isArray(value.y) ? value.y[0] : null;
              const max = Array.isArray(value.y) ? value.y[1] : null;
              return `Range: ${formatPrice(min)} – ${formatPrice(max)}`;
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
