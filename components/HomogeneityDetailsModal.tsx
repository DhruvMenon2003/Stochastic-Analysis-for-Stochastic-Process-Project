import React from 'react';
import { type TimeSeriesAnalysisResults } from '../types';
import TPMDisplay from './TPMDisplay';

const HomogeneityDetailsModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    results: TimeSeriesAnalysisResults
}> = ({ isOpen, onClose, results }) => {
    if (!isOpen) return null;

    const { tpms_firstOrder, homogeneityMetrics, stateSpace } = results;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 transition-opacity" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 p-6 rounded-lg shadow-2xl max-w-4xl w-full transform transition-all space-y-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-700 pb-3">
                    <h3 className="text-2xl font-bold">Time Homogeneity Details</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-3xl font-bold">&times;</button>
                </div>

                {/* Metrics Section */}
                <div>
                    <h4 className="text-lg font-semibold mb-3">Distance Metrics</h4>
                    <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg space-y-3">
                        <p><strong>Generalized Jensen-Shannon Divergence (Normalized):</strong> <span className="font-mono text-blue-600 dark:text-blue-400 text-lg">{homogeneityMetrics.gjsDivergence.toFixed(4)}</span></p>
                        <div>
                            <strong>Pairwise Hellinger Distances:</strong>
                            <ul className="list-disc pl-5 mt-2 text-sm font-mono space-y-1">
                                {homogeneityMetrics.hellingerDistances.map(h => (
                                    <li key={h.pair}>
                                        <span className="font-sans text-gray-700 dark:text-gray-300">{h.pair}:</span> {h.distance.toFixed(4)}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>

                {/* TPMs Section */}
                <div>
                    <h4 className="text-lg font-semibold mb-3">Individual Transition Probability Matrices</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {tpms_firstOrder.map(({ tpm, label }) => (
                            <TPMDisplay key={label} tpm={tpm} title={label} stateSpace={stateSpace} />
                        ))}
                    </div>
                </div>

                 <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700 mt-6">
                    <button onClick={onClose} className="px-4 py-2 font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700">Close</button>
                 </div>
            </div>
        </div>
    );
};

export default HomogeneityDetailsModal;
