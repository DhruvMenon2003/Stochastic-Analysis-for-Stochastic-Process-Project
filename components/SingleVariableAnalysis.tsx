import React, { useState } from 'react';
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Bar } from 'recharts';
import { type RandomVariable, type SingleVarResults, VariableType, type TheoreticalModel, SingleVarMetrics } from '../types';

interface SingleVariableAnalysisProps {
    variable: RandomVariable;
    results: SingleVarResults;
    models: TheoreticalModel[];
    onUpdate: (id: string, updatedProps: Partial<RandomVariable>) => void;
}

const formatNumber = (num?: number) => num !== undefined && num !== null ? num.toFixed(4) : 'N/A';

// FIX: A robust function to render metric values of different types (number, string, array).
const renderMetricValue = (value: any): string => {
    if (value === undefined || value === null) return 'N/A';
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'number') return formatNumber(value);
    return String(value); // Handles string-based values like median for ordinal types
};

const CustomTooltip: React.FC<any> = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div className="p-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded shadow-lg text-sm">
                <p className="font-bold">{`Value: ${label}`}</p>
                <p className="text-indigo-500">{`Probability: ${formatNumber(payload[0].value)}`}</p>
                <p className="text-teal-500">{`Cumulative: ${formatNumber(payload[1].value)}`}</p>
            </div>
        );
    }
    return null;
};

const SingleVariableAnalysis: React.FC<SingleVariableAnalysisProps> = ({ variable, results, models, onUpdate }) => {
    const [selectedSourceId, setSelectedSourceId] = useState<string>('empirical');

    const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        onUpdate(variable.id, { type: e.target.value as VariableType });
    };

    const handleOrderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onUpdate(variable.id, { ordinalOrder: e.target.value.split(',').map(s => s.trim()) });
    };

    const sources = [
        { id: 'empirical', name: 'Empirical (Data)' },
        ...models.filter(m => results.theoretical[m.id]).map(m => ({ id: m.id, name: m.name }))
    ];

    const displayedMetrics: SingleVarMetrics = selectedSourceId === 'empirical' 
        ? results.empirical 
        : results.theoretical[selectedSourceId];

    const metricsToDisplay = ['Mean', 'Variance', 'Mode', 'Median'];

    return (
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-6 space-y-4">
            <h3 className="text-lg font-bold text-blue-600 dark:text-blue-400">{variable.name}</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label htmlFor={`type-${variable.id}`} className="block text-sm font-medium text-gray-700 dark:text-gray-300">Variable Type</label>
                    <select
                        id={`type-${variable.id}`}
                        value={variable.type}
                        onChange={handleTypeChange}
                        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                    >
                        {Object.values(VariableType).map(type => (
                            <option key={type} value={type}>{type}</option>
                        ))}
                    </select>
                </div>
                {variable.type === VariableType.Ordinal && (
                    <div>
                        <label htmlFor={`order-${variable.id}`} className="block text-sm font-medium text-gray-700 dark:text-gray-300">Ordinal Order</label>
                        <input
                            type="text"
                            id={`order-${variable.id}`}
                            placeholder="e.g., low, medium, high"
                            defaultValue={variable.ordinalOrder.join(', ')}
                            onBlur={handleOrderChange}
                            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                        />
                    </div>
                )}
            </div>

            <div className="space-y-2 pt-2">
                <h4 className="font-semibold text-md text-gray-700 dark:text-gray-300">Comparative Metrics</h4>
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead>
                             <tr className="border-b border-gray-200 dark:border-gray-700">
                                <th className="text-left py-2 font-medium text-gray-600 dark:text-gray-400">Metric</th>
                                <th className="text-left py-2 font-medium text-gray-600 dark:text-gray-400">Empirical</th>
                                {models.filter(m => results.theoretical[m.id]).map(m => <th key={m.id} className="text-left py-2 font-medium text-gray-600 dark:text-gray-400 truncate" title={m.name}>{m.name}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {metricsToDisplay.map(metricName => {
                                const key = metricName.toLowerCase() as keyof SingleVarMetrics;
                                const empiricalValue = results.empirical[key];
                                if (empiricalValue === undefined || (Array.isArray(empiricalValue) && empiricalValue.length === 0)) return null;

                                return (
                                    <tr key={metricName} className="border-b border-gray-200 dark:border-gray-700 last:border-0">
                                        <td className="py-2 font-medium">{metricName}</td>
                                        <td className="py-2 font-mono">{renderMetricValue(empiricalValue)}</td>
                                        {models.filter(m => results.theoretical[m.id]).map(m => {
                                            const modelValue = results.theoretical[m.id]?.[key];
                                            return <td key={m.id} className="py-2 font-mono">{renderMetricValue(modelValue)}</td>
                                        })}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="pt-2">
                 <div className="flex justify-between items-center mb-2">
                    <h4 className="font-semibold text-md text-gray-700 dark:text-gray-300">Distribution</h4>
                    {sources.length > 1 && (
                        <select
                            value={selectedSourceId}
                            onChange={(e) => setSelectedSourceId(e.target.value)}
                            className="block text-sm border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md py-1"
                        >
                            {sources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    )}
                </div>
                {displayedMetrics && (
                     <div style={{ width: '100%', height: 250 }}>
                        <ResponsiveContainer>
                            <BarChart data={displayedMetrics.pmf} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                                <XAxis dataKey="value" tick={{ fontSize: 12 }} />
                                <YAxis tick={{ fontSize: 12 }} />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend wrapperStyle={{fontSize: "14px"}}/>
                                <Bar dataKey="probability" name="PMF" fill="#4f46e5" />
                                <Bar dataKey="cumulative" name="CDF" fill="#14b8a6" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SingleVariableAnalysis;