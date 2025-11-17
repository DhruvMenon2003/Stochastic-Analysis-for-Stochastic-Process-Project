

import React, { useState, useMemo, useRef } from 'react';
import { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Line } from 'recharts';
import { type RandomVariable, type AnalysisResults, VariableType, type TheoreticalModel, type TimeSeriesAnalysisResults, type TPM, JointPMF } from './types';
import { parseInput, performFullAnalysis, detectVariableType, exportToJson, exportToCsv, detectAnalysisType, performTimeSeriesAnalysis } from './services/analysisService';
import SingleVariableAnalysis from './components/SingleVariableAnalysis';
import CorrelationHeatmap from './components/CorrelationHeatmap';
import ModelFitResults from './components/ModelFitResults';
import TheoreticalModelInput from './components/TheoreticalModelInput';
import ConditionalAnalysis from './components/ConditionalAnalysis';
import JointDistributionTable from './components/JointDistributionTable';
import { IconChartBar, IconCode, IconInfoCircle, IconDownload, IconTable, IconUpload, IconTrash, IconFileText, IconTarget, IconCheck, IconTrophy, IconTrendingUp } from './components/Icons';

// --- REUSABLE COMPONENT: TPMDisplay ---
const TPMDisplay: React.FC<{ tpm: TPM; title: string; stateSpace: string[] }> = ({ tpm, title, stateSpace }) => {
    const fromStates = [...tpm.keys()].sort();
    if (fromStates.length === 0) {
        return <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-md"><h4 className="font-semibold">{title}</h4><p className="text-sm text-gray-500 italic">Not enough data to compute this matrix.</p></div>
    }

    return (
        <div className="space-y-2">
            <h4 className="text-md font-semibold text-gray-800 dark:text-gray-200">{title}</h4>
            <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                        <tr>
                            <th className="sticky left-0 bg-gray-50 dark:bg-gray-800 px-2 py-2 text-left font-medium">From ↓ To →</th>
                            {stateSpace.map(s => <th key={s} className="px-2 py-2 text-center font-medium">{s}</th>)}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {fromStates.map(fromState => (
                            <tr key={fromState}>
                                <td className="sticky left-0 bg-white dark:bg-gray-900 px-2 py-2 font-medium">{fromState}</td>
                                {stateSpace.map(toState => (
                                    <td key={toState} className="px-2 py-2 text-center font-mono">
                                        {(tpm.get(fromState)?.get(toState) || 0).toFixed(3)}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// --- REUSABLE COMPONENT: JointPMFTable ---
const JointPMFTable: React.FC<{ pmf: JointPMF; title: string; timeLabels: string[] }> = ({ pmf, title, timeLabels }) => {
    const sortedEntries = useMemo(() => Array.from(pmf.entries()).sort((a, b) => a[0].localeCompare(b[0])), [pmf]);

    return (
        <div className="space-y-2">
            <h4 className="text-md font-semibold text-gray-800 dark:text-gray-200">{title}</h4>
            <div className="overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg max-h-72">
                <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                        <tr>
                            {timeLabels.map(label => <th key={label} className="px-2 py-2 text-center font-medium">{label}</th>)}
                            <th className="px-2 py-2 text-center font-medium">Probability</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {sortedEntries.map(([sequence, prob]) => (
                            <tr key={sequence}>
                                {sequence.split(',').map((state, i) => <td key={i} className="px-2 py-2 text-center">{state}</td>)}
                                <td className="px-2 py-2 text-center font-mono">{prob.toFixed(4)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};


// --- NEW COMPONENT: HomogeneityDetailsModal ---
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


// --- NEW COMPONENT: MarkovianFitDetailsModal ---
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
    const transitionCalcs = [];

    for (let i = 1; i < exampleStates.length; i++) {
        const from = exampleStates[i-1];
        const to = exampleStates[i];
        const transProb = representativeTPM.tpm.get(from)?.get(to) || 0;
        runningProb *= transProb;
        calcString += ` * ${transProb.toFixed(3)}`;
        transitionCalcs.push({from, to, prob: transProb});
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


// --- NEW COMPONENT: StationaryAnalysis ---
const StationaryAnalysis: React.FC<{ results: TimeSeriesAnalysisResults['weakStationarity'] }> = ({ results }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const chartData = results.timeLabels.map((time, i) => ({
        time,
        mean: results.mean[i],
        variance: results.variance[i],
    }));

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-xl font-semibold">Weak Stationarity Analysis</h3>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
                >
                    Interpret Results
                </button>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
                A process is weakly stationary if its mean and variance remain constant over time. Do the plots below appear relatively flat?
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                    <h4 className="font-semibold mb-2">Mean Over Time</h4>
                    <ResponsiveContainer width="100%" height={250}>
                        <LineChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2}/>
                            <XAxis dataKey="time" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Line type="monotone" dataKey="mean" stroke="#8884d8" strokeWidth={2} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
                 <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                    <h4 className="font-semibold mb-2">Variance Over Time</h4>
                    <ResponsiveContainer width="100%" height={250}>
                        <LineChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2}/>
                            <XAxis dataKey="time" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Line type="monotone" dataKey="variance" stroke="#82ca9d" strokeWidth={2} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 transition-opacity" onClick={() => setIsModalOpen(false)}>
                    <div className="bg-white dark:bg-gray-900 p-8 rounded-lg shadow-2xl max-w-lg w-full transform transition-all" onClick={e => e.stopPropagation()}>
                        <h3 className="text-2xl font-bold mb-4">Is a Stationary Approximation Good Enough?</h3>
                        <p className="text-gray-700 dark:text-gray-300 mb-6">
                            For many applications, if the mean and variance plots are "flat enough" (i.e., they don't show strong trends or seasonality), you can approximate the process as stationary. This simplifies modeling significantly. However, for rigorous conclusions, a statistical test is recommended.
                        </p>
                         <div className="flex justify-end space-x-4">
                            <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 font-semibold text-gray-700 bg-gray-200 dark:bg-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600">Got it</button>
                            <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700">Run Statistical Test (Future Feature)</button>
                         </div>
                    </div>
                </div>
            )}
        </div>
    )
};


// --- NEW COMPONENT: TimeSeriesAnalysis ---
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


const App: React.FC = () => {
    const [inputText, setInputText] = useState<string>('Time,Instance1,Instance2,Instance3,Instance4,Instance5,Instance6,Instance7,Instance8,Instance9,Instance10\nDay1,1,1,2,3,1,2,3,1,2,3\nDay2,1,2,2,3,1,2,3,1,2,1\nDay3,2,2,3,3,1,2,1,1,2,1\nDay4,2,3,3,3,1,1,1,2,2,1');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'single' | 'pairwise' | 'modelFit'>('single');
    const [storedDatasets, setStoredDatasets] = useState<{name: string, content: string}[]>([]);
    const [theoreticalModels, setTheoreticalModels] = useState<TheoreticalModel[]>([
        {
            id: `model-${Date.now()}`,
            name: 'Example Uniform Model',
            stateSpaces: { 'VarA': '1, 2, 3, 4', 'VarB': '10, 20, 31, 44', 'VarC': 'red, blue, green', 'VarD': 'low, medium, high' },
            jointProbabilities: {},
            distribution: 'VarA,VarB,VarC,VarD,Probability\n1,10,red,low,0.1\n2,20,blue,medium,0.1\n2,20,red,high,0.1\n3,31,green,medium,0.1\n3,31,blue,low,0.1\n3,31,red,high,0.1\n4,44,red,high,0.1\n4,44,green,medium,0.1\n4,44,blue,low,0.2'
        }
    ]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [analysisMode, setAnalysisMode] = useState<'cross-sectional' | 'time-series' | null>(null);
    const [crossSectionalResults, setCrossSectionalResults] = useState<AnalysisResults | null>(null);
    const [timeSeriesResults, setTimeSeriesResults] = useState<TimeSeriesAnalysisResults | null>(null);

    const generateDistributionString = (model: TheoreticalModel, varNames: string[]): string => {
        if (varNames.length === 0) return '';
        const header = [...varNames, 'Probability'].join(',');
        const rows = Object.entries(model.jointProbabilities)
            .map(([key, probStr]) => {
                const prob = parseFloat(probStr as string);
                if (!key || isNaN(prob) || prob <= 0) return null;
                return `${key},${prob}`;
            })
            .filter(Boolean);

        return [header, ...rows].join('\n');
    };

    const variables = useMemo(() => crossSectionalResults?.variables || [], [crossSectionalResults]);
    
    // Detect analysis type from input text to conditionally render UI elements
    const analysisType = useMemo(() => detectAnalysisType(inputText), [inputText]);


    const areModelsValid = useMemo(() => {
        if (theoreticalModels.length === 0 || variables.length === 0) {
            return true;
        }
        return theoreticalModels.every(model => {
             const sum = Object.values(model.jointProbabilities).reduce((acc: number, probStr: string | number) => {
                const prob = Number(probStr);
                return isNaN(prob) ? acc : acc + prob;
            }, 0);
            // FIX: Correctly handle potentially undefined state spaces to avoid runtime errors
            // and ensure correct type inference for `stateSpaces`.
             const stateSpaces = variables.map(v => (model.stateSpaces[v.name]?.split(',') ?? []).map(s => s.trim()).filter(s => s));
             if (stateSpaces.some(s => s.length === 0)) return true;

            let expectedProbs = 1;
            for (const space of stateSpaces) {
                expectedProbs *= space.length;
            }

             if (Object.keys(model.jointProbabilities).length !== expectedProbs) return true;

            return Math.abs(sum - 1.0) < 1e-5;
        });
    }, [theoreticalModels, variables]);

    const handleAnalyze = () => {
        setIsLoading(true);
        setError(null);
        setCrossSectionalResults(null);
        setTimeSeriesResults(null);

        setTimeout(() => { // Use timeout to allow UI to update to loading state
            try {
                const mode = detectAnalysisType(inputText);
                setAnalysisMode(mode);

                if (mode === 'cross-sectional') {
                    const dataVarNames = parseInput(inputText).map(v => v.name);
                    const modelsForAnalysis = theoreticalModels.map(m => ({
                        ...m,
                        distribution: generateDistributionString(m, dataVarNames)
                    }));
                    
                    const fullResults = performFullAnalysis(inputText, modelsForAnalysis);
                    setCrossSectionalResults(fullResults);

                    if (fullResults.variables.length > 1) setActiveTab('pairwise');
                    else setActiveTab('single');
                } else {
                    const results = performTimeSeriesAnalysis(inputText);
                    setTimeSeriesResults(results);
                }
            } catch (e) {
                if (e instanceof Error) {
                    setError(e.message);
                } else {
                    setError('An unknown error occurred during analysis.');
                }
                 setAnalysisMode(null);
                 setCrossSectionalResults(null);
                 setTimeSeriesResults(null);
            } finally {
                setIsLoading(false);
            }
        }, 50);
    };

    const handleExport = (format: 'json' | 'csv') => {
        if (!crossSectionalResults || variables.length === 0) return;

        const content = format === 'json'
            ? exportToJson(crossSectionalResults)
            : exportToCsv(crossSectionalResults, variables);

        const blob = new Blob([content], { type: `text/${format};charset=utf-8;` });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `stochastic_analysis_results.${format}`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        const uploadPromises: Promise<{ name: string; content: string } | { error: string }>[] = [];

        Array.from(files).forEach((file: File) => {
            if (storedDatasets.some(d => d.name === file.name)) {
                uploadPromises.push(Promise.resolve({ error: `Dataset "${file.name}" already exists.` }));
                return;
            }

            const promise = new Promise<{ name: string; content: string } | { error: string }>((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const content = e.target?.result as string;
                    if (content) {
                        resolve({ name: file.name, content });
                    } else {
                        resolve({ error: `File "${file.name}" is empty or could not be read.` });
                    }
                };
                reader.onerror = () => {
                    resolve({ error: `Failed to read file "${file.name}".` });
                };
                reader.readAsText(file);
            });
            uploadPromises.push(promise);
        });

        const results = await Promise.all(uploadPromises);

        const newDatasets: { name: string; content: string }[] = [];
        const uploadErrors: string[] = [];

        results.forEach(res => {
            if ('error' in res) {
                uploadErrors.push(res.error);
            } else {
                newDatasets.push(res);
            }
        });

        if (newDatasets.length > 0) {
            setStoredDatasets(prev => [...prev, ...newDatasets]);
        }

        if (uploadErrors.length > 0) {
            setError(uploadErrors.join(' '));
        } else {
            setError(null);
        }

        if (event.target) {
            event.target.value = "";
        }
    };

    const loadDataset = (content: string) => {
        setInputText(content);
        setAnalysisMode(null);
        setCrossSectionalResults(null);
        setTimeSeriesResults(null);
    };

    const deleteDataset = (nameToDelete: string) => {
        setStoredDatasets(prev => prev.filter(dataset => dataset.name !== nameToDelete));
    };


    const updateVariable = (id: string, updatedProps: Partial<RandomVariable>) => {
        setCrossSectionalResults(prev => {
            if (!prev) return null;
            const newVars = prev.variables.map(v => (v.id === id ? { ...v, ...updatedProps } : v));
            // This is a simplification; a full re-analysis would be needed.
            return { ...prev, variables: newVars };
        });
    };

    const addModel = () => {
        setTheoreticalModels(prev => [...prev, { id: `model-${Date.now()}`, name: `Model ${prev.length + 1}`, distribution: '', stateSpaces: {}, jointProbabilities: {} }]);
    };

    const updateModel = (id: string, updatedProps: Partial<TheoreticalModel>) => {
        setTheoreticalModels(prev => prev.map(m => (m.id === id ? { ...m, ...updatedProps } : m)));
    };

    const deleteModel = (id: string) => {
        setTheoreticalModels(prev => prev.filter(m => m.id !== id));
    };

    const dataVariableNames = useMemo(() => variables.map(v => v.name), [variables]);

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 font-sans">
            <header className="bg-white dark:bg-gray-900 shadow-md sticky top-0 z-10">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <IconCode className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Stochastic Analysis Engine</h1>
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-white dark:bg-gray-900 p-6 rounded-lg shadow-lg self-start">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xl font-semibold">Input Data</h2>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileSelect}
                                    accept=".csv,.txt"
                                    className="hidden"
                                    multiple
                                />
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="px-3 py-2 text-sm font-medium text-blue-600 bg-blue-100 dark:bg-blue-900/50 dark:text-blue-300 rounded-md hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors flex items-center space-x-2"
                                >
                                    <IconUpload className="w-4 h-4" />
                                    <span>Upload CSV(s)</span>
                                </button>
                            </div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                                Enter comma-separated data. Use 'Time,Instance1...' header for Time-Series analysis.
                            </p>
                            <textarea
                                className="w-full h-64 p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                placeholder="Header1,Header2... or Time,Instance1..."
                            />
                             {storedDatasets.length > 0 && (
                                <div className="mt-6">
                                    <h3 className="text-lg font-semibold mb-3">Stored Datasets</h3>
                                    <ul className="space-y-2 max-h-48 overflow-y-auto pr-2">
                                        {storedDatasets.map(dataset => (
                                            <li key={dataset.name} className="flex items-center justify-between p-2 bg-gray-100 dark:bg-gray-800 rounded-md">
                                                <span className="text-sm font-medium truncate" title={dataset.name}>{dataset.name}</span>
                                                <div className="flex items-center space-x-2 flex-shrink-0">
                                                    <button onClick={() => loadDataset(dataset.content)} className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300" title="Load Dataset">
                                                        <IconFileText className="w-5 h-5" />
                                                    </button>
                                                    <button onClick={() => deleteDataset(dataset.name)} className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300" title="Delete Dataset">
                                                        <IconTrash className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>

                        {analysisType === 'cross-sectional' && (
                            <div className="bg-white dark:bg-gray-900 p-6 rounded-lg shadow-lg self-start">
                                <h2 className="text-xl font-semibold mb-4">Theoretical Models</h2>
                                <div className="space-y-4">
                                    {theoreticalModels.map((model) => (
                                        <div key={model.id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                                            <div className="flex justify-between items-center mb-3">
                                                <input
                                                    type="text"
                                                    value={model.name}
                                                    onChange={(e) => updateModel(model.id, { name: e.target.value })}
                                                    className="font-semibold text-md bg-transparent focus:outline-none focus:ring-0 border-0 border-b-2 border-gray-300 dark:border-gray-600 focus:border-blue-500"
                                                />
                                                <button onClick={() => deleteModel(model.id)} className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300" title="Delete Model">
                                                    <IconTrash className="w-5 h-5" />
                                                </button>
                                            </div>
                                            {dataVariableNames.length > 0 ? (
                                                <TheoreticalModelInput
                                                    model={model}
                                                    variableNames={dataVariableNames}
                                                    onUpdate={updateModel}
                                                />
                                            ) : (
                                                <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                                                    Analyze data first to define models.
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                    <button onClick={addModel} className="w-full py-2 text-sm font-medium text-blue-600 bg-blue-100 dark:bg-blue-900/50 dark:text-blue-300 rounded-md hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors">
                                        + Add Model
                                    </button>
                                </div>
                            </div>
                        )}

                         <div className="bg-white dark:bg-gray-900 p-6 rounded-lg shadow-lg self-start relative">
                            <div title={!areModelsValid ? "Please ensure all model probabilities sum to 1." : ""}>
                                <button
                                    onClick={handleAnalyze}
                                    disabled={isLoading || !areModelsValid}
                                    className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
                                >
                                    {isLoading ? (
                                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                    ) : <IconChartBar className="w-5 h-5" />}
                                    <span>{isLoading ? 'Analyzing...' : 'Analyze Data'}</span>
                                </button>
                            </div>
                            {error && (
                                <div className="mt-4 p-3 bg-red-100 dark:bg-red-900/50 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-200 rounded-md text-sm">
                                    <span className="font-bold">Error: </span>{error}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="lg:col-span-2">
                        {analysisMode === 'cross-sectional' && crossSectionalResults ? (
                            <div className="bg-white dark:bg-gray-900 p-6 rounded-lg shadow-lg">
                                <div className="flex justify-between items-center mb-4 border-b border-gray-200 dark:border-gray-700 pb-4">
                                    <h2 className="text-2xl font-semibold text-gray-800 dark:text-white">Cross-Sectional Analysis Report</h2>
                                    <div className="flex items-center space-x-2">
                                         <button onClick={() => handleExport('json')} className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 dark:bg-gray-800 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex items-center space-x-2">
                                             <IconDownload className="w-4 h-4" /> <span>JSON</span>
                                         </button>
                                         <button onClick={() => handleExport('csv')} className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 dark:bg-gray-800 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex items-center space-x-2">
                                             <IconDownload className="w-4 h-4" /> <span>CSV</span>
                                         </button>
                                    </div>
                                </div>
                                <div className="border-b border-gray-200 dark:border-gray-700">
                                    <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                                        <button onClick={() => setActiveTab('single')} className={`${activeTab === 'single' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2`}>
                                            <IconChartBar className="w-5 h-5"/><span>Single Variable</span>
                                        </button>
                                        {crossSectionalResults.pairwise.length > 0 && (
                                            <button onClick={() => setActiveTab('pairwise')} className={`${activeTab === 'pairwise' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2`}>
                                                <IconTable className="w-5 h-5"/><span>Dependence & Conditional</span>
                                            </button>
                                        )}
                                        {crossSectionalResults.modelFit.length > 0 && (
                                            <button onClick={() => setActiveTab('modelFit')} className={`${activeTab === 'modelFit' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2`}>
                                                <IconTarget className="w-5 h-5"/><span>Model Fit</span>
                                            </button>
                                        )}
                                    </nav>
                                </div>
                                <div className="py-6">
                                    {activeTab === 'single' && (
                                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                                            {variables.map(variable => (
                                                <SingleVariableAnalysis
                                                    key={variable.id}
                                                    variable={variable}
                                                    results={crossSectionalResults.single_vars[variable.id]}
                                                    models={theoreticalModels}
                                                    onUpdate={updateVariable}
                                                />
                                            ))}
                                        </div>
                                    )}
                                    {activeTab === 'pairwise' && (
                                        <div className="space-y-8">
                                            <CorrelationHeatmap
                                                pairwiseResults={crossSectionalResults.pairwise}
                                                variables={variables}
                                                models={theoreticalModels}
                                            />
                                            <JointDistributionTable
                                                empiricalJointPMF={crossSectionalResults.empiricalJointPMF}
                                                theoreticalJointPMFs={crossSectionalResults.theoreticalJointPMFs}
                                                variables={variables}
                                                models={theoreticalModels}
                                            />
                                            <ConditionalAnalysis
                                                conditionalResults={crossSectionalResults.conditional}
                                                variables={variables}
                                                models={theoreticalModels}
                                            />
                                        </div>
                                    )}
                                    {activeTab === 'modelFit' && (
                                        <ModelFitResults
                                            modelFitResults={crossSectionalResults.modelFit}
                                        />
                                    )}
                                </div>
                            </div>
                        ) : analysisMode === 'time-series' && timeSeriesResults ? (
                           <TimeSeriesAnalysis results={timeSeriesResults} />
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full bg-white dark:bg-gray-900 p-8 rounded-lg shadow-lg">
                                <IconInfoCircle className="w-16 h-16 text-gray-400 dark:text-gray-500 mb-4" />
                                <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300">Awaiting Analysis</h3>
                                <p className="text-gray-500 dark:text-gray-400 mt-2 text-center">
                                    Enter your data, define any models, then click "Analyze Data" to generate a report.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default App;