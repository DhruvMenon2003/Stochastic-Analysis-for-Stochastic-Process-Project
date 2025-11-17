import React from 'react';
import { type TimeSeriesAnalysisResults } from '../types';
import TPMDisplay from './TPMDisplay';
import JointPMFTable from './JointPMFTable';

const MarkovianFitDetailsModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    results: TimeSeriesAnalysisResults;
}> = ({ isOpen, onClose, results }) => {
    if (!isOpen) return null;

    const { markovianFit, isHomogeneous, tpms_firstOrder, average_tpm_firstOrder, stateSpace, weakStationarity } = results;
    const representativeTPM = isHomogeneous ? tpms_firstOrder[0] : average_tpm_firstOrder;
    
    // For the calculation example
    const exampleSequence = markovianFit.fullHistoryPMF.keys().next().value || '';
    const exampleStates = exampleSequence.split(',');
    const initialProb = (markovianFit.initialStatePMF?.get(exampleStates[0]) || 0);
    
    let calcString = `${initialProb.toFixed(3)} (P(${exampleStates[0]}))`;
    let runningProb = initialProb;

    for (let i = 1; i < exampleStates.length; i++) {
        const from = exampleStates[i-1];
        const to = exampleStates[i];
        const transProb = representativeTPM.tpm.get(from)?.get(to) || 0;
        runningProb *= transProb;
        calcString += ` * ${transProb.toFixed(3)}`;
    }
    calcString += ` = ${runningProb.toFixed(4)}`;


    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 transition-opacity" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 p-6 rounded-lg shadow-2xl max-w-6xl w-full transform transition-all space-y-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-700 pb-3">
                    <h3 className="text-2xl font-bold">Markovian Model Fit Details</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-3xl font-bold">&times;</button>
                </div>

                {/* Distributions Section */}
                <div>
                    <h4 className="text-lg font-semibold mb-3">Joint Probability Distributions</h4>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <JointPMFTable pmf={markovianFit.fullHistoryPMF} title="Empirical (from Data)" timeLabels={weakStationarity.timeLabels} />
                        <JointPMFTable pmf={markovianFit.markovApproximationPMF} title="Markovian Approximation" timeLabels={weakStationarity.timeLabels} />
                    </div>
                </div>

                 {/* Calculation Section */}
                <div>
                    <h4 className="text-lg font-semibold mb-3">Approximation Calculation</h4>
                    <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg space-y-4">
                        <p className="text-sm">The Markovian approximation is built using the chain rule: <br/><code className="font-mono bg-gray-200 dark:bg-gray-700 p-1 rounded">P(Xn,...,X1) = P(X1) * P(X2|X1) * ... * P(Xn|Xn-1)</code>.</p>
                        <p className="text-sm">The conditional probabilities `P(Xt | Xt-1)` are taken from the single representative TPM below.</p>
                        <div className="flex justify-center">
                           {representativeTPM && <TPMDisplay tpm={representativeTPM.tpm} title={`Representative TPM (${representativeTPM.label})`} stateSpace={stateSpace} />}
                        </div>
                         <div>
                            <p className="text-sm font-semibold">Example Calculation for sequence "{exampleSequence}":</p>
                            <div className="text-xs font-mono bg-white dark:bg-gray-900 p-3 mt-2 rounded border border-gray-200 dark:border-gray-700 overflow-x-auto">
                               {calcString}
                            </div>
                        </div>
                    </div>
                </div>

                 <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700 mt-6">
                    <button onClick={onClose} className="px-4 py-2 font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700">Close</button>
                 </div>
            </div>
        </div>
    );
};

export default MarkovianFitDetailsModal;
