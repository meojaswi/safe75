(function () {
  const THRESHOLD_PERCENT = 75;
  let chartInstance = null;
  let exportInProgress = false;

  function parsePayload() {
    const payloadEl = document.getElementById("reportPayload");
    if (!payloadEl) {
      return { subjects: [], filename: "safe75-semester-report.pdf" };
    }

    try {
      const parsed = JSON.parse(payloadEl.textContent || "{}");
      return {
        subjects: Array.isArray(parsed.subjects) ? parsed.subjects : [],
        filename: parsed.filename || "safe75-semester-report.pdf",
      };
    } catch (error) {
      console.error("Failed to parse report payload:", error);
      return { subjects: [], filename: "safe75-semester-report.pdf" };
    }
  }

  function formatPercentValue(value) {
    const numeric = Number(value) || 0;
    const rounded = Number(numeric.toFixed(1));
    return Number.isInteger(rounded) ? String(rounded) : String(rounded);
  }

  const thresholdLinePlugin = {
    id: "thresholdLinePlugin",
    afterDraw(chart) {
      const xScale = chart.scales.x;
      const chartArea = chart.chartArea;
      if (!xScale || !chartArea) return;

      const thresholdX = xScale.getPixelForValue(THRESHOLD_PERCENT);
      const ctx = chart.ctx;
      ctx.save();
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.moveTo(thresholdX, chartArea.top);
      ctx.lineTo(thresholdX, chartArea.bottom);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#ef4444";
      ctx.font = "600 11px Arial";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText("75%", thresholdX + 4, chartArea.top + 2);
      ctx.restore();
    },
  };

  const valueLabelPlugin = {
    id: "valueLabelPlugin",
    afterDatasetsDraw(chart) {
      const dataset = chart.data.datasets?.[0];
      if (!dataset) return;

      const meta = chart.getDatasetMeta(0);
      const ctx = chart.ctx;
      ctx.save();
      ctx.fillStyle = "#0f172a";
      ctx.font = "600 12px Arial";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";

      meta.data.forEach((bar, index) => {
        const raw = Number(dataset.data[index]) || 0;
        const valueText = `${formatPercentValue(raw)}%`;
        const x = bar.x + 8;
        const y = bar.y;
        ctx.fillText(valueText, x, y);
      });

      ctx.restore();
    },
  };

  function renderSubjectBarChart(subjects) {
    const canvas = document.getElementById("subjectAttendanceBarChart");
    if (!canvas) return;

    if (typeof Chart === "undefined") {
      console.error("Chart.js failed to load");
      return;
    }

    const labels = subjects.map((subject) => subject.label || "Subject");
    const values = subjects.map((subject) => Number(subject.percentage) || 0);
    const colors = values.map((value) =>
      value >= THRESHOLD_PERCENT ? "#22c55e" : "#ef4444",
    );

    const chartHeight = Math.max(420, labels.length * 42);
    const wrapper = canvas.parentElement;
    if (wrapper) {
      wrapper.style.height = `${chartHeight}px`;
    }

    const ctx = canvas.getContext("2d");
    chartInstance = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: colors,
            borderWidth: 0,
            borderRadius: 8,
            barThickness: 22,
            categoryPercentage: 0.8,
            barPercentage: 0.8,
          },
        ],
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        layout: {
          padding: {
            right: 74,
          },
        },
        scales: {
          x: {
            min: 0,
            max: 100,
            grid: {
              color: "rgba(15, 23, 42, 0.12)",
            },
            ticks: {
              color: "#334155",
              stepSize: 10,
              callback: (value) => `${value}%`,
            },
            title: {
              display: true,
              text: "Attendance Percentage",
              color: "#334155",
              font: {
                size: 12,
                weight: "600",
              },
            },
          },
          y: {
            grid: {
              display: false,
            },
            ticks: {
              color: "#0f172a",
              font: {
                size: 12,
                weight: "600",
              },
            },
          },
        },
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            callbacks: {
              label: (context) => ` ${formatPercentValue(context.raw)}%`,
            },
          },
        },
      },
      plugins: [thresholdLinePlugin, valueLabelPlugin],
    });
  }

  async function generateReportPdf(autoTriggered) {
    if (exportInProgress) return;

    if (typeof html2pdf === "undefined") {
      if (!autoTriggered) {
        alert("PDF library failed to load. Please refresh and try again.");
      }
      return;
    }

    const reportRoot = document.getElementById("reportRoot");
    if (!reportRoot) return;

    exportInProgress = true;
    const exportBtn = document.getElementById("exportPdfBtn");
    const previousLabel = exportBtn ? exportBtn.textContent : "";
    if (exportBtn) {
      exportBtn.disabled = true;
      exportBtn.textContent = "Generating PDF...";
    }

    try {
      if (chartInstance) {
        chartInstance.resize();
      }

      await new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      });

      const payload = parsePayload();
      const safeFilename = (payload.filename || "safe75-semester-report.pdf").replace(
        /[^a-zA-Z0-9._-]/g,
        "-",
      );
      reportRoot.classList.add("pdf-exporting");

      const options = {
        margin: [8, 8, 8, 8],
        filename: safeFilename.endsWith(".pdf")
          ? safeFilename
          : `${safeFilename}.pdf`,
        image: { type: "jpeg", quality: 1 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
          logging: false,
        },
        jsPDF: {
          unit: "mm",
          format: "a4",
          orientation: "portrait",
        },
        pagebreak: { mode: ["css", "legacy"] },
      };

      await html2pdf().set(options).from(reportRoot).save();
    } catch (error) {
      console.error("PDF export failed:", error);
      if (!autoTriggered) {
        alert("Failed to export PDF. Please try again.");
      }
    } finally {
      reportRoot.classList.remove("pdf-exporting");
      exportInProgress = false;
      if (exportBtn) {
        exportBtn.disabled = false;
        exportBtn.textContent = previousLabel || "Export PDF";
      }
    }
  }

  function initReportPage() {
    const payload = parsePayload();
    if (payload.subjects.length > 0) {
      renderSubjectBarChart(payload.subjects);
    }

    const exportBtn = document.getElementById("exportPdfBtn");
    if (exportBtn) {
      exportBtn.addEventListener("click", () => generateReportPdf(false));
    }

    window.generateReportPdf = (autoTriggered = false) =>
      generateReportPdf(Boolean(autoTriggered));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initReportPage);
  } else {
    initReportPage();
  }
})();
