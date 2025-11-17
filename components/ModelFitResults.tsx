import React, { useMemo } from 'react';
import { type ModelFitResult } from '../types';
import { IconCheck, IconTrophy } from './Icons';

interface ModelFitResultsProps {
    modelFitResults: ModelFitResult[];
}

const formatNumber = (num?: number) => num !== undefined ? num.toFixed(4) : 'N/A';

const ModelFitTable: React.FC<ModelFitResultsProps> = ({ modelFitResults }) => {
    const analysis = useMemo(() => {
        if (!modelFitResults || modelFitResults.length === 0) {
            return null;
        }

        const validModels = modelFitResults.filter(m => !m.error);
        const modelNames = modelFitResults.map(m => m.modelName);

        // Gather all unique metrics
        const metrics = new Set<string>();
        validModels.forEach(model => {
            if (model.hellingerDistance !== undefined) metrics.add('Hellinger Distance');
            if (model.jensenShannonDistance !== undefined) metrics.add('Jensen-Shannon Distance');
            if (model.mse) {
                Object.keys(model.mse).forEach(key => metrics.add(key));
            }
        });

        // Sort metrics for consistent display order
        const metricList = Array.from(metrics).sort((a, b) => {
            const getRank = (m: string) => {
                if (m.includes('Distance')) return 0;
                if (m.startsWith('Cumulative MSE')) return 1;
                if (m.startsWith('MSE:') && m.includes('|')) return 2;
                if (m.startsWith('MSE:')) return 3;
                return 4;
            };
            const rankA = getRank(a);
            const rankB = getRank(b);
            if (rankA !== rankB) return rankA - rankB;
            return a.localeCompare(b);
        });

        // Find the winner for each metric
        const winnersByMetric: { [metric: string]: string } = {};
        metricList.forEach(metric => {
            let bestScore = Infinity;
            let winner = '';
            validModels.forEach(model => {
                let currentScore: number | undefined;
                if (metric === 'Hellinger Distance') currentScore = model.hellingerDistance;
                else if (metric === 'Jensen-Shannon Distance') currentScore = model.jensenShannonDistance;
                else if (model.mse && model.mse[metric] !== undefined) {
                    currentScore = model.mse[metric];
                }

                if (currentScore !== undefined && currentScore < bestScore) {
                    bestScore = currentScore;
                    winner = model.modelName;
                }
            });
            winnersByMetric[metric] = winner;
        });

        // Count wins for each model
        const winCounts: { [modelName: string]: number } = Object.fromEntries(modelNames.map(name => [name, 0]));
        Object.values(winnersByMetric).forEach(winner => {
            if (winner) winCounts[winner]++;
        });

        // Find the overall winner
        let maxWins = -1;
        let overallWinner = '';
        Object.entries(winCounts).forEach(([name, wins]) => {
            if (wins > maxWins) {
                maxWins = wins;
                overallWinner = name;
            }
        });
        
        // Handle ties (if multiple models have the same max wins, don't declare a single winner)
        const topContenders = Object.values(winCounts).filter(w => w === maxWins).length;
        if (topContenders > 1) {
            overallWinner = '';
        }


        return { modelNames, metricList, winnersByMetric, winCounts, overallWinner };
    }, [modelFitResults]);

    if (!analysis) {
        return <p className="text-sm text-gray-500 dark:text-gray-400 italic">No valid model fit results to display.</p>;
    }

    const { modelNames, metricList, winnersByMetric, winCounts, overallWinner } = analysis;

    return (
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                Metric
                            </th>
                            {modelNames.map(name => (
                                <th key={name} scope="col" className={`px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider transition-colors ${name === overallWinner ? 'bg-blue-100 dark:bg-blue-900/50' : ''}`}>
                                    <div className="flex items-center space-x-2">
                                       <span>{name}</span>
                                       {name === overallWinner && <IconTrophy className="w-4 h-4 text-yellow-500" title="Best Overall Model" />}
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                        {metricList.map(metric => (
                            <tr key={metric}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                    {metric}
                                </td>
                                {modelNames.map(name => {
                                    const result = modelFitResults.find(r => r.modelName === name);
                                    let value: number | undefined;
                                    if (metric === 'Hellinger Distance') value = result?.hellingerDistance;
                                    else if (metric === 'Jensen-Shannon Distance') value = result?.jensenShannonDistance;
                                    else if (result?.mse) {
                                       value = result.mse[metric];
                                    }
                                    const isWinner = winnersByMetric[metric] === name;

                                    return (
                                        <td key={`${metric}-${name}`} className={`px-6 py-4 whitespace-nowrap text-sm font-mono transition-colors ${name === overallWinner ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                                            <div className="flex items-center space-x-2">
                                                <span>{formatNumber(value)}</span>
                                                {isWinner && <IconCheck className="w-4 h-4 text-green-500" />}
                                            </div>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                         <tr className="bg-gray-50 dark:bg-gray-800 font-bold">
                             <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-gray-100">
                                Total Wins
                            </td>
                            {modelNames.map(name => (
                                <td key={`wins-${name}`} className={`px-6 py-4 whitespace-nowrap text-sm text-center transition-colors ${name === overallWinner ? 'bg-blue-100 dark:bg-blue-900/50' : ''}`}>
                                    {winCounts[name]}
                                </td>
                            ))}
                        </tr>
                    </tbody>
                </table>
                 {modelFitResults.some(m => m.error) && (
                    <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Evaluation Errors</h4>
                        <ul className="list-disc pl-5 mt-2 text-sm text-red-600 dark:text-red-400">
                            {modelFitResults.filter(m => m.error).map(m => (
                                <li key={m.modelName}><strong>{m.modelName}:</strong> {m.error}</li>
                            ))}
                        </ul>
                    </div>
                 )}
            </div>
        </div>
    );
};


export default ModelFitTable;