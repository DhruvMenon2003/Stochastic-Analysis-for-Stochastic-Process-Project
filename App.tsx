import React, { useState, useMemo } from 'react';
import { type RandomVariable, type AnalysisResults, VariableType, type PairwiseResult } from './types';
import { parseInput, performFullAnalysis, detectVariableType, exportToJson, exportToCsv } from './services/analysisService';
import SingleVariableAnalysis from './components/SingleVariableAnalysis';
import CorrelationHeatmap from './components/CorrelationHeatmap';
import { IconChartBar, IconCode, IconInfoCircle, IconDownload, IconTable } from './components/Icons';

const App: React.FC = () => {
    const [inputText, setInputText] = useState<string>('VarA, 1, 2, 2, 3, 3, 3, 4, 4, 4, 4\nVarB, 10, 20, 20, 31, 31, 31, 44, 44, 44, 44\nVarC, red, blue, red, green, blue, red, red, green, blue, blue\nVarD, low, medium, high, medium, low, high, high, medium, low, low');
    const [variables, setVariables] = useState<RandomVariable[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'single' | 'pairwise'>('single');

    const analysisResults: AnalysisResults | null = useMemo(() => {
        if (variables.length === 0) return null;
        try {
            setError(null);
            return performFullAnalysis(variables);
        } catch (e) {
            if (e instanceof Error) {
                setError(`Analysis Error: ${e.message}`);
            } else {
                setError('An unknown error occurred during analysis.');
            }
            return null;
        }
    }, [variables]);

    const handleAnalyze = () => {
        setIsLoading(true);
        setError(null);
        setVariables([]);

        try {
            const parsedData = parseInput(inputText);
             if (parsedData.length === 0) {
                throw new Error("No valid data found. Please enter data in the format: VarName, val1, val2, ...");
            }

            const firstLength = parsedData[0].data.length;
            if (firstLength === 0) {
                throw new Error(`Variable "${parsedData[0].name || 'Variable 1'}" has no data points.`);
            }

            for (let i = 1; i < parsedData.length; i++) {
                const currentLength = parsedData[i].data.length;
                if (currentLength !== firstLength) {
                    throw new Error(`Data length mismatch. "${parsedData[0].name || 'Variable 1'}" has ${firstLength} points, but "${parsedData[i].name || `Variable ${i + 1}`}" has ${currentLength} points.`);
                }
            }

            const initialVariables: RandomVariable[] = parsedData.map((v, i) => ({
                id: `var-${i}-${Date.now()}`,
                name: v.name || `Variable ${i + 1}`,
                data: v.data,
                type: detectVariableType(v.data),
                ordinalOrder: [],
            }));

            setVariables(initialVariables);
            // Default to pairwise tab if it's more interesting
            setActiveTab(initialVariables.length > 1 ? 'pairwise' : 'single');

        } catch (e) {
            if (e instanceof Error) {
                setError(e.message);
            } else {
                setError('An unknown error occurred during parsing.');
            }
            setVariables([]);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleExport = (format: 'json' | 'csv') => {
        if (!analysisResults || variables.length === 0) return;

        const content = format === 'json' 
            ? exportToJson(analysisResults)
            : exportToCsv(analysisResults, variables);

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


    const updateVariable = (id: string, updatedProps: Partial<RandomVariable>) => {
        setVariables(prev =>
            prev.map(v => (v.id === id ? { ...v, ...updatedProps } : v))
        );
    };

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
                    <div className="lg:col-span-1 bg-white dark:bg-gray-900 p-6 rounded-lg shadow-lg self-start">
                        <h2 className="text-xl font-semibold mb-4">Input Data</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                            Enter each variable on a new line, values comma-separated. The first value can be the variable name.
                        </p>
                        <textarea
                            className="w-full h-64 p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            placeholder="Var1, 1, 2, 3, 4, 5&#10;Var2, a, b, a, c, b"
                        />
                        <button
                            onClick={handleAnalyze}
                            disabled={isLoading}
                            className="mt-4 w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
                        >
                            {isLoading ? (
                                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            ) : <IconChartBar className="w-5 h-5" />}
                            <span>{isLoading ? 'Analyzing...' : 'Analyze Data'}</span>
                        </button>
                        {error && (
                            <div className="mt-4 p-3 bg-red-100 dark:bg-red-900/50 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-200 rounded-md text-sm">
                                <span className="font-bold">Error: </span>{error}
                            </div>
                        )}
                    </div>

                    <div className="lg:col-span-2">
                        {variables.length > 0 && analysisResults ? (
                            <div className="bg-white dark:bg-gray-900 p-6 rounded-lg shadow-lg">
                                <div className="flex justify-between items-center mb-4 border-b border-gray-200 dark:border-gray-700 pb-4">
                                    <h2 className="text-2xl font-semibold text-gray-800 dark:text-white">Analysis Report</h2>
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
                                        {analysisResults.pairwise.length > 0 && (
                                            <button onClick={() => setActiveTab('pairwise')} className={`${activeTab === 'pairwise' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2`}>
                                                <IconTable className="w-5 h-5"/><span>Dependence Heatmap</span>
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
                                                    results={analysisResults.single_vars[variable.id]}
                                                    onUpdate={updateVariable}
                                                />
                                            ))}
                                        </div>
                                    )}
                                    {activeTab === 'pairwise' && (
                                        <CorrelationHeatmap 
                                            pairwiseResults={analysisResults.pairwise}
                                            variables={variables}
                                        />
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full bg-white dark:bg-gray-900 p-8 rounded-lg shadow-lg">
                                <IconInfoCircle className="w-16 h-16 text-gray-400 dark:text-gray-500 mb-4" />
                                <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300">Awaiting Analysis</h3>
                                <p className="text-gray-500 dark:text-gray-400 mt-2 text-center">
                                    Enter your data, then click "Analyze Data" to generate a report.
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
