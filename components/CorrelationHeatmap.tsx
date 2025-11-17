import React, { useState, useMemo, useEffect } from 'react';
import { type PairwiseResult, type RandomVariable, type TheoreticalModel, PairwiseMetrics, VariableType } from '../types';

type MetricKey = keyof PairwiseMetrics;

interface CorrelationHeatmapProps {
    pairwiseResults: PairwiseResult[];
    variables: RandomVariable[];
    models: TheoreticalModel[];
}

const METRICS: { key: MetricKey; label: string; range: [number, number] }[] = [
    { key: 'distanceCorrelation', label: 'Distance', range: [0, 1] },
    { key: 'pearsonCorrelation', label: 'Pearson', range: [-1, 1] },
    { key: 'mutualInformation', label: 'Mutual Info', range: [0, 1] },
    { key: 'cramersV', label: "Cramer's V", range: [0, 1] },
];

const parseHsl = (hslString: string): { h: number, s: number, l: number } | null => {
    const hslRegex = /hsl\((\d+),\s*(\d+)%,\s*([\d.]+)%\)/;
    const match = hslString.match(hslRegex);
    if (!match) return null;
    return {
        h: parseInt(match[1], 10),
        s: parseInt(match[2], 10),
        l: parseFloat(match[3])
    };
};

const getColor = (value: number, range: [number, number]): string => {
    if (isNaN(value) || value === undefined) return 'hsl(0, 0%, 90%)'; // Gray for N/A
    
    // Diverging scale for Pearson [-1, 1]
    if (range[0] < 0) {
        const intensity = Math.abs(value);
        if (value > 0.001) return `hsl(210, 80%, ${95 - intensity * 45}%)`; // Blue scale
        if (value < -0.001) return `hsl(0, 80%, ${95 - intensity * 45}%)`; // Red scale
        return 'hsl(0, 0%, 98%)'; // Near white for 0
    }
    
    // Sequential scale for others [0, 1]
    const intensity = value;
    return `hsl(210, 80%, ${98 - intensity * 50}%)`;
};


const CorrelationHeatmap: React.FC<CorrelationHeatmapProps> = ({ pairwiseResults, variables, models }) => {
    const [selectedMetric, setSelectedMetric] = useState<MetricKey>('distanceCorrelation');
    const [selectedSourceId, setSelectedSourceId] = useState<string>('empirical');

    const matrixData = useMemo(() => {
        const matrix: (number | undefined)[][] = Array(variables.length).fill(null).map(() => Array(variables.length).fill(undefined));
        
        for (let i = 0; i < variables.length; i++) {
            const v = variables[i];
            const isCategorical = v.type === VariableType.Nominal || v.type === VariableType.Ordinal;
            matrix[i][i] = selectedMetric === 'pearsonCorrelation' ? 1.0 : undefined;
             if (selectedMetric === 'distanceCorrelation') matrix[i][i] = 1.0; 
             if (selectedMetric === 'cramersV' && isCategorical) matrix[i][i] = 1.0;
        }

        pairwiseResults.forEach(res => {
            const i = variables.findIndex(v => v.id === res.var1_id);
            const j = variables.findIndex(v => v.id === res.var2_id);
            if (i !== -1 && j !== -1) {
                let value: number | undefined;
                if (selectedSourceId === 'empirical') {
                    value = res.empirical[selectedMetric];
                } else {
                    value = res.theoretical[selectedSourceId]?.[selectedMetric];
                }
                matrix[i][j] = value;
                matrix[j][i] = value;
            }
        });
        return matrix;
    }, [variables, pairwiseResults, selectedMetric, selectedSourceId]);

    const activeMetric = METRICS.find(m => m.key === selectedMetric) || METRICS[0];
    const sources = [
        { id: 'empirical', name: 'Empirical (Data)' },
        ...models.filter(m => pairwiseResults[0]?.theoretical[m.id]).map(m => ({ id: m.id, name: m.name }))
    ];


    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
                 <h3 className="text-xl font-semibold">Dependence Heatmap</h3>
                 <div className="flex flex-wrap items-center gap-4">
                     {sources.length > 1 && (
                        <select
                            value={selectedSourceId}
                            onChange={(e) => setSelectedSourceId(e.target.value)}
                            className="block text-sm border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md py-1.5"
                        >
                            {sources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    )}
                    <div className="flex flex-wrap items-center gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
                        {METRICS.map(metric => {
                            return (
                                <button
                                    key={metric.key}
                                    onClick={() => setSelectedMetric(metric.key)}
                                    className={`px-3 py-1.5 text-sm rounded-md transition-colors ${selectedMetric === metric.key ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-900 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                                    title={`Select ${metric.label}`}
                                >
                                    {metric.label}
                                </button>
                            );
                        })}
                    </div>
                 </div>
            </div>

            <div className="overflow-x-auto">
                 <div className="grid gap-1.5" style={{ gridTemplateColumns: `auto repeat(${variables.length}, minmax(60px, 1fr))` }}>
                    {/* Top Header */}
                    <div></div>
                    {variables.map(v => (
                        <div key={v.id} className="text-base font-bold text-center truncate py-1" title={v.name}>{v.name}</div>
                    ))}

                    {/* Matrix Body */}
                    {variables.map((rowVar, i) => (
                        <React.Fragment key={`row-${rowVar.id}`}>
                            <div className="text-base font-bold text-right truncate pr-2 flex items-center justify-end" title={rowVar.name}>{rowVar.name}</div>
                            {variables.map((colVar, j) => {
                                const value = matrixData[i][j];
                                const bgColor = value !== undefined ? getColor(value, activeMetric.range) : 'bg-gray-200 dark:bg-gray-700';
                                const hsl = parseHsl(bgColor);
                                const textColor = hsl && hsl.l < 60 ? 'text-white' : 'text-gray-800 dark:text-gray-200';

                                return (
                                    <div key={`cell-${rowVar.id}-${colVar.id}`} className={`aspect-square flex items-center justify-center rounded-md text-sm font-mono transition-all duration-150 ${textColor}`} style={{ backgroundColor: bgColor }}>
                                        {value !== undefined ? value.toFixed(3) : 'N/A'}
                                    </div>
                                );
                            })}
                        </React.Fragment>
                    ))}
                </div>
            </div>
             <div className="flex justify-end items-center space-x-4 pt-2">
                <span className="text-sm font-medium">{activeMetric.range[0]}</span>
                <div className="h-4 w-48 rounded-sm" style={{ background: `linear-gradient(to right, ${getColor(activeMetric.range[0], activeMetric.range)}, ${getColor(activeMetric.range[0] < 0 ? 0 : activeMetric.range[0] + (activeMetric.range[1] - activeMetric.range[0])/2, activeMetric.range)}, ${getColor(activeMetric.range[1], activeMetric.range)})` }}></div>
                <span className="text-sm font-medium">{activeMetric.range[1]}</span>
            </div>
        </div>
    );
};

export default CorrelationHeatmap;