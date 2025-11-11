
import React from 'react';
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Bar } from 'recharts';
import { type RandomVariable, type SingleVarResults, VariableType } from '../types';

interface SingleVariableAnalysisProps {
    variable: RandomVariable;
    results: SingleVarResults;
    onUpdate: (id: string, updatedProps: Partial<RandomVariable>) => void;
}

const formatNumber = (num?: number) => num !== undefined ? num.toFixed(4) : 'N/A';

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

const SingleVariableAnalysis: React.FC<SingleVariableAnalysisProps> = ({ variable, results, onUpdate }) => {

    const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        onUpdate(variable.id, { type: e.target.value as VariableType });
    };

    const handleOrderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onUpdate(variable.id, { ordinalOrder: e.target.value.split(',').map(s => s.trim()) });
    };

    const renderMetric = (label: string, value: string | number | (string | number)[] | undefined, unit?: string) => {
        if (value === undefined || (Array.isArray(value) && value.length === 0)) return null;
        const displayValue = Array.isArray(value) ? value.join(', ') : (typeof value === 'number' ? formatNumber(value) : value);
        return (
            <div className="flex justify-between text-sm py-2 border-b border-gray-200 dark:border-gray-700">
                <span className="font-medium text-gray-600 dark:text-gray-400">{label}</span>
                <span className="font-mono text-gray-800 dark:text-gray-200">{displayValue}{unit}</span>
            </div>
        );
    };

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
                <h4 className="font-semibold text-md text-gray-700 dark:text-gray-300">Metrics</h4>
                {renderMetric('Mean', results.mean)}
                {renderMetric('Variance', results.variance)}
                {renderMetric('Mode', results.mode)}
                {renderMetric('Median', results.median)}
                {!results.mean && !results.variance && !results.mode && !results.median && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 italic">No applicable metrics for the selected type or configuration.</p>
                )}
            </div>

            <div className="pt-2">
                <h4 className="font-semibold text-md text-gray-700 dark:text-gray-300 mb-2">Distribution</h4>
                <div style={{ width: '100%', height: 250 }}>
                    <ResponsiveContainer>
                        <BarChart data={results.pmf} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
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
            </div>
        </div>
    );
};

export default SingleVariableAnalysis;
