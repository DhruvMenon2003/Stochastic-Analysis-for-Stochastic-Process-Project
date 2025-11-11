import React, { useState, useMemo } from 'react';
import { type PairwiseResult, type RandomVariable } from '../types';

type MetricKey = 'distanceCorrelation' | 'pearsonCorrelation' | 'mutualInformation';

interface CorrelationHeatmapProps {
    pairwiseResults: PairwiseResult[];
    variables: RandomVariable[];
}

const METRICS: { key: MetricKey; label: string; range: [number, number] }[] = [
    { key: 'distanceCorrelation', label: 'Distance', range: [0, 1] },
    { key: 'pearsonCorrelation', label: 'Pearson', range: [-1, 1] },
    { key: 'mutualInformation', label: 'Mutual Info', range: [0, 1] },
];

const getColor = (value: number, range: [number, number]): string => {
    if (isNaN(value) || value === undefined) return 'bg-gray-200 dark:bg-gray-700';
    
    // Diverging scale for Pearson [-1, 1]
    if (range[0] < 0) {
        const intensity = Math.abs(value) * 100;
        if (value > 0) return `hsl(210, 80%, ${100 - intensity * 0.4}%)`; // Blue scale
        if (value < 0) return `hsl(0, 80%, ${100 - intensity * 0.4}%)`; // Red scale
        return 'hsl(0, 0%, 95%)'; // Near white for 0
    }
    
    // Sequential scale for others [0, 1]
    const intensity = value * 100;
    return `hsl(210, 80%, ${100 - intensity * 0.5}%)`;
};


const CorrelationHeatmap: React.FC<CorrelationHeatmapProps> = ({ pairwiseResults, variables }) => {
    const [selectedMetric, setSelectedMetric] = useState<MetricKey>('distanceCorrelation');

    const matrixData = useMemo(() => {
        const matrix: (number | undefined)[][] = Array(variables.length).fill(null).map(() => Array(variables.length).fill(undefined));
        
        for (let i = 0; i < variables.length; i++) {
            matrix[i][i] = 1.0; // Self-correlation is 1
        }

        pairwiseResults.forEach(res => {
            const i = variables.findIndex(v => v.id === res.var1_id);
            const j = variables.findIndex(v => v.id === res.var2_id);
            if (i !== -1 && j !== -1) {
                const value = res[selectedMetric];
                matrix[i][j] = value;
                matrix[j][i] = value;
            }
        });
        return matrix;
    }, [variables, pairwiseResults, selectedMetric]);

    const activeMetric = METRICS.find(m => m.key === selectedMetric) || METRICS[0];

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">Metric:</span>
                {METRICS.map(metric => (
                    <button
                        key={metric.key}
                        onClick={() => setSelectedMetric(metric.key)}
                        className={`px-3 py-1.5 text-sm rounded-md transition-colors ${selectedMetric === metric.key ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                    >
                        {metric.label}
                    </button>
                ))}
            </div>

            <div className="overflow-x-auto">
                 <div className="grid gap-1" style={{ gridTemplateColumns: `auto repeat(${variables.length}, 1fr)` }}>
                    {/* Top Header */}
                    <div></div>
                    {variables.map(v => (
                        <div key={v.id} className="text-xs font-bold text-center truncate" title={v.name}>{v.name}</div>
                    ))}

                    {/* Matrix Body */}
                    {variables.map((rowVar, i) => (
                        <React.Fragment key={`row-${rowVar.id}`}>
                            <div className="text-xs font-bold text-right truncate pr-2" title={rowVar.name}>{rowVar.name}</div>
                            {variables.map((colVar, j) => {
                                const value = matrixData[i][j];
                                const colorStyle = value !== undefined ? { backgroundColor: getColor(value, activeMetric.range) } : {};

                                return (
                                    <div key={`cell-${rowVar.id}-${colVar.id}`} className="relative group aspect-square flex items-center justify-center rounded" style={colorStyle}>
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block px-2 py-1 bg-gray-800 dark:bg-gray-900 text-white text-xs rounded-md z-10 whitespace-nowrap">
                                            {value !== undefined ? value.toFixed(4) : 'N/A'}
                                            <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-gray-800 dark:border-t-gray-900"></div>
                                        </div>
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
