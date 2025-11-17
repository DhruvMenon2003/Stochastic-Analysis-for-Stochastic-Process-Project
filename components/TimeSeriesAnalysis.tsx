import React, { useState } from 'react';
import { type TimeSeriesAnalysisResults } from '../types';
import HomogeneityDetailsModal from './HomogeneityDetailsModal';
import MarkovianFitDetailsModal from './MarkovianFitDetailsModal';
import StationaryAnalysis from './StationaryAnalysis';
import TPMDisplay from './TPMDisplay';

const TimeSeriesAnalysis: React.FC<{ results: TimeSeriesAnalysisResults }> = ({ results }) => {
    const [isHomogeneityModalOpen, setIsHomogeneityModalOpen] = useState(false);
    const [isMarkovianFitModalOpen, setIsMarkovianFitModalOpen] = useState(false);
    const { isHomogeneous, tpms_firstOrder, average_tpm_firstOrder, stateSpace, markovianFit } = results;

    const renderTPMs = () => {
        if (isHomogeneous) {
            return (
                 <div className="space-y-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        Since the system is time-homogeneous, the transition probabilities are stable over time. The matrix for the first transition (Day 1 → Day 2) is a good representative for the entire process.
                    </p>
                    {tpms_firstOrder.length > 0 &&
                        <TPMDisplay tpm={tpms_firstOrder[0].tpm} title="Transition Probability Matrix (Day 1 → Day 2)" stateSpace={stateSpace} />
                    }
                </div>
            );
        } else {
             return (
                <div className="space-y-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        Since the system is NOT time-homogeneous, the transition probabilities change over time. The best single representation is the time-averaged matrix, which averages the probabilities across all transitions.
                    </p>
                    <TPMDisplay tpm={average_tpm_firstOrder.tpm} title="Time-Averaged Transition Probability Matrix" stateSpace={stateSpace} />
                </div>
            );
        }
    };

    return (
        <div className="bg-white dark:bg-gray-900 p-6 rounded-lg shadow-lg space-y-8">
            <div>
                <h2 className="text-2xl font-semibold text-gray-800 dark:text-white mb-4 border-b border-gray-200 dark:border-gray-700 pb-4">Time-Series Analysis Report</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-center">
                    <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                        <h3 className="font-semibold text-lg mb-2">Is time homogeneity a valid assumption?</h3>
                        <div className="flex items-center justify-center space-x-4">
                            <p className={`text-2xl font-bold ${results.isHomogeneous ? 'text-green-600' : 'text-red-600'}`}>
                                {results.isHomogeneous ? 'Yes' : 'No'}
                            </p>
                            <button
                                onClick={() => setIsHomogeneityModalOpen(true)}
                                className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-100 dark:bg-blue-900/50 dark:text-blue-300 rounded-md hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                            >
                                View Details
                            </button>
                        </div>
                         <p className="text-xs text-gray-500 mt-2">Based on Hellinger & GJS distances</p>
                    </div>
                     <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                        <h3 className="font-semibold text-lg mb-2">Markovian Model Fit</h3>
                        <div className="grid grid-cols-2 gap-2 text-center">
                            <div>
                                <p className="text-xs text-gray-500">Hellinger Distance</p>
                                <p className="text-2xl font-bold font-mono text-indigo-600 dark:text-indigo-400">{markovianFit.hellingerDistance.toFixed(4)}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">JS Distance</p>
                                <p className="text-2xl font-bold font-mono text-indigo-600 dark:text-indigo-400">{markovianFit.jensenShannonDistance.toFixed(4)}</p>
                            </div>
                        </div>
                         <div className="flex items-center justify-center space-x-4 mt-2">
                             <p className="text-xs text-gray-500">Distance between true history and Markov model. Lower is better.</p>
                             <button
                                onClick={() => setIsMarkovianFitModalOpen(true)}
                                className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-100 dark:bg-blue-900/50 dark:text-blue-300 rounded-md hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                            >
                                View Details
                            </button>
                         </div>
                    </div>
                </div>
            </div>
            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                 {renderTPMs()}
            </div>
            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                <StationaryAnalysis results={results.weakStationarity} />
            </div>
             <HomogeneityDetailsModal
                isOpen={isHomogeneityModalOpen}
                onClose={() => setIsHomogeneityModalOpen(false)}
                results={results}
            />
             <MarkovianFitDetailsModal
                isOpen={isMarkovianFitModalOpen}
                onClose={() => setIsMarkovianFitModalOpen(false)}
                results={results}
            />
        </div>
    )
};

export default TimeSeriesAnalysis;
