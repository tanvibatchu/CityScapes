"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Filler,
    Tooltip,
} from "chart.js";
import { Line } from "react-chartjs-2";
import {
    runCostAnalysis,
    formatCurrency,
    CARBON_CREDIT_PRICE,
    type GreenspaceType,
} from "@/lib/costAnalysis";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip);

interface Props {
    selectedCellId: string | null;
    rows: number;
    cols: number;
    onClose: () => void;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
        <p style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "rgba(232,220,200,0.35)",
            margin: "18px 0 8px",
        }}>
            {children}
        </p>
    );
}

function Row({ label, value, accent, sublabel }: {
    label: string;
    value: string;
    accent: "red" | "green" | "blue" | "muted";
    sublabel?: string;
}) {
    const color =
        accent === "red" ? "#ef4444" :
            accent === "green" ? "#4ade80" :
                accent === "blue" ? "#60a5fa" :
                    "rgba(232,220,200,0.55)";
    return (
        <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            padding: "5px 0",
            borderBottom: "1px solid rgba(232,220,200,0.06)",
        }}>
            <span style={{ fontSize: 12, color: "rgba(232,220,200,0.55)" }}>
                {label}
                {sublabel && (
                    <span style={{ fontSize: 10, color: "rgba(232,220,200,0.3)", marginLeft: 4 }}>{sublabel}</span>
                )}
            </span>
            <span style={{ fontSize: 13, fontWeight: 500, color }}>{value}</span>
        </div>
    );
}

export default function CostAnalysisPanel({ selectedCellId, rows, cols, onClose }: Props) {
    const [greenspaceType, setGreenspaceType] = useState<GreenspaceType>("park");
    const [nearbyPropertyValue, setNearbyPropertyValue] = useState(500_000);
    const [numProps, setNumProps] = useState(50);
    const panelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (panelRef.current) panelRef.current.scrollTop = 0;
    }, [selectedCellId]);

    const [areaSqM, setAreaSqM] = useState(3000);

    const result = useMemo(
        () => runCostAnalysis({ areaSqM, greenspaceType, nearbyPropertyValue, numPropertiesAffected: numProps }),
        [areaSqM, greenspaceType, nearbyPropertyValue, numProps]
    );

    const beColor =
        result.breakEvenYear === null ? "#ef4444" :
            result.breakEvenYear <= 10 ? "#4ade80" :
                result.breakEvenYear <= 18 ? "#eab308" : "#f97316";

    const chartData = {
        labels: result.timeline.map((t) => `Y${t.year}`),
        datasets: [
            {
                label: "Cost",
                data: result.timeline.map((t) => t.cumulativeCost),
                borderColor: "#ef4444",
                backgroundColor: "transparent",
                fill: false, tension: 0.3, pointRadius: 0, borderWidth: 1.5,
            },
            {
                label: "Revenue",
                data: result.timeline.map((t) => t.cumulativeRevenue),
                borderColor: "#4ade80",
                backgroundColor: "transparent",
                fill: false, tension: 0.3, pointRadius: 0, borderWidth: 1.5,
            },
            {
                label: "Net",
                data: result.timeline.map((t) => t.netCashFlow),
                borderColor: "#60a5fa",
                backgroundColor: "rgba(96,165,250,0.08)",
                fill: true, tension: 0.3, pointRadius: 0, borderWidth: 1.5,
                borderDash: [4, 3],
            },
        ],
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                mode: "index" as const,
                callbacks: {
                    label: (ctx: import("chart.js").TooltipItem<"line">) =>
                        `${ctx.dataset.label ?? ""}: ${formatCurrency(ctx.parsed.y ?? 0)}`,
                },
            },
        },
        scales: {
            x: {
                ticks: {
                    color: "rgba(232,220,200,0.3)",
                    font: { size: 10 },
                    maxTicksLimit: 7,
                    autoSkip: true,
                },
                grid: { color: "rgba(232,220,200,0.05)" },
            },
            y: {
                ticks: {
                    color: "rgba(232,220,200,0.3)",
                    font: { size: 10 },
                    callback: (v: unknown) =>
                        formatCurrency(typeof v === "string" ? parseFloat(v) : v as number),
                },
                grid: { color: "rgba(232,220,200,0.05)" },
            },
        },
    };

    return (
        <aside ref={panelRef} className="map-panel" style={{ overflowY: "auto", maxHeight: "100vh" }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                <div>
                    <h2 className="map-panel-title" style={{ marginBottom: 2 }}>Cost analysis</h2>
                    <p className="map-panel-hint" style={{ margin: 0 }}>
                        Carbon ${CARBON_CREDIT_PRICE}/t · 3% property uplift
                    </p>
                </div>
                <button onClick={onClose} style={{
                    background: "none", border: "none",
                    color: "rgba(232,220,200,0.4)", fontSize: 16, cursor: "pointer", lineHeight: 1,
                }}>✕</button>
            </div>

            {/* Cell badge */}
            {selectedCellId ? (
                <div style={{
                    background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)",
                    borderRadius: 6, padding: "6px 10px", fontSize: 11, color: "#4ade80", marginTop: 8,
                }}>
                    Cell {selectedCellId} · {areaSqM.toLocaleString()} m²
                </div>
            ) : (
                <div style={{
                    background: "rgba(232,220,200,0.04)", border: "1px solid rgba(232,220,200,0.1)",
                    borderRadius: 6, padding: "6px 10px", fontSize: 11,
                    color: "rgba(232,220,200,0.4)", marginTop: 8,
                }}>
                    Tap a grid dot on the map to select a cell
                </div>
            )}

            {/* Break-even callout */}
            <div style={{
                background: "rgba(232,220,200,0.04)", border: `1px solid ${beColor}44`,
                borderRadius: 8, padding: "10px 14px", marginTop: 14,
                display: "flex", alignItems: "center", gap: 14,
            }}>
                <span style={{
                    fontSize: 34, fontWeight: 700, color: beColor, lineHeight: 1,
                    fontFamily: "var(--font-orbitron, monospace)",
                }}>
                    {result.breakEvenYear !== null ? `Y${result.breakEvenYear}` : "—"}
                </span>
                <div>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: "rgba(232,220,200,0.85)" }}>
                        Break-even year
                    </p>
                    <p style={{ margin: "3px 0 0", fontSize: 11, color: "rgba(232,220,200,0.45)" }}>
                        {result.breakEvenYear !== null
                            ? `Nets ${formatCurrency(result.netAt20yr)} over 20 yrs`
                            : "No break-even within 25 yrs"}
                    </p>
                </div>
            </div>

            {/* Chart */}
            <div style={{ position: "relative", height: 150, marginTop: 14 }}>
                <Line data={chartData} options={chartOptions} />
            </div>

            {/* Legend */}
            <div style={{ display: "flex", gap: 14, marginTop: 6 }}>
                {[{ color: "#ef4444", label: "Cost" }, { color: "#4ade80", label: "Revenue" }, { color: "#60a5fa", label: "Net" }]
                    .map(({ color, label }) => (
                        <span key={label} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "rgba(232,220,200,0.35)" }}>
                            <span style={{ width: 8, height: 8, borderRadius: 2, background: color, display: "inline-block" }} />
                            {label}
                        </span>
                    ))}
            </div>

            {/* Inputs */}
            <SectionLabel>Inputs</SectionLabel>

            <div style={{ marginBottom: 10 }}>
                <label style={{ display: "block", fontSize: 11, color: "rgba(232,220,200,0.4)", marginBottom: 4 }}>
                    Greenspace area (m²)
                </label>
                <input
                    type="number"
                    value={areaSqM}
                    min={100}
                    step={500}
                    onChange={(e) => setAreaSqM(parseFloat(e.target.value) || 5000)}
                    style={{
                        width: "100%", background: "rgba(232,220,200,0.06)",
                        border: "1px solid rgba(232,220,200,0.12)", borderRadius: 6,
                        padding: "6px 8px", fontSize: 12, color: "rgba(232,220,200,0.85)",
                        outline: "none", boxSizing: "border-box" as const,
                    }}
                />
            </div>

            {[
                { label: "Avg nearby property value", value: nearbyPropertyValue, setter: setNearbyPropertyValue, prefix: "$", step: 10_000 },
                { label: "Properties affected", value: numProps, setter: setNumProps, step: 1 },
            ].map(({ label, value, setter, prefix, step }) => (
                <div key={label} style={{ marginBottom: 10 }}>
                    <label style={{ display: "block", fontSize: 11, color: "rgba(232,220,200,0.4)", marginBottom: 4 }}>
                        {label}
                    </label>
                    <div style={{ position: "relative" }}>
                        {prefix && (
                            <span style={{
                                position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)",
                                fontSize: 12, color: "rgba(232,220,200,0.35)", pointerEvents: "none",
                            }}>{prefix}</span>
                        )}
                        <input
                            type="number"
                            value={value}
                            min={0}
                            step={step}
                            onChange={(e) => setter(parseFloat(e.target.value) || 0)}
                            style={{
                                width: "100%", background: "rgba(232,220,200,0.06)",
                                border: "1px solid rgba(232,220,200,0.12)", borderRadius: 6,
                                padding: prefix ? "6px 8px 6px 18px" : "6px 8px",
                                fontSize: 12, color: "rgba(232,220,200,0.85)",
                                outline: "none", boxSizing: "border-box",
                            }}
                        />
                    </div>
                </div>
            ))}

            {/* Costs */}
            <SectionLabel>Costs</SectionLabel>
            <Row label="CapEx — build + planting" value={formatCurrency(result.capex)} accent="red" />
            <Row label="OpEx — annual maintenance" value={`${formatCurrency(result.opexAnnual)}/yr`} accent="red" />
            <Row label="20-yr total cost" value={formatCurrency(result.totalCost20yr)} accent="red" />

            {/* Revenue */}
            <SectionLabel>Revenue / year</SectionLabel>
            <Row label="Carbon credits" sublabel={`$${CARBON_CREDIT_PRICE}/t`} value={formatCurrency(result.carbonCreditAnnual)} accent="green" />
            <Row label="Property uplift" sublabel="3% amortized" value={formatCurrency(result.propertyUpliftAnnual)} accent="green" />
            <Row label="Sewage savings" value={formatCurrency(result.sewageSavingsAnnual)} accent="green" />
            <Row label="Energy savings" value={formatCurrency(result.energySavingsAnnual)} accent="green" />
            <Row label="Total annual" value={formatCurrency(result.totalAnnualRevenue)} accent="blue" />

            {/* 20-yr summary */}
            <SectionLabel>20-year summary</SectionLabel>
            <Row label="Total revenue" value={formatCurrency(result.totalRevenue20yr)} accent="green" />
            <Row label="Total cost" value={formatCurrency(result.totalCost20yr)} accent="red" />
            <Row label="Net profit/loss" value={formatCurrency(result.netAt20yr)} accent={result.netAt20yr >= 0 ? "green" : "red"} />

            <div style={{ height: 20 }} />
        </aside>
    );
} 