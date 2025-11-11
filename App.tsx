
import React, { useState, useMemo, useRef } from 'react';
import { type RandomVariable, type AnalysisResults, VariableType, type TheoreticalModel } from './types';
import { parseInput, performFullAnalysis, detectVariableType, exportToJson, exportToCsv } from './services/analysisService';
import SingleVariableAnalysis from './components/SingleVariableAnalysis';
import CorrelationHeatmap from './components/CorrelationHeatmap';
import ModelFitResults from './components/ModelFitResults';
import TheoreticalModelInput from './components/TheoreticalModelInput';
import ConditionalAnalysis from './components/ConditionalAnalysis';
import JointDistributionTable from './components/JointDistributionTable';
import { IconChartBar, IconCode, IconInfoCircle, IconDownload, IconTable, IconUpload, IconTrash, IconFileText, IconTarget } from './components/Icons';

// Helper to transform the new model UI state into the string format the analysis service expects
const generateDistributionString = (model: TheoreticalModel, varNames: string[]): string => {
    if (varNames.length === 0) return '';
    
    const header = [...varNames, 'Probability'].join(',');
    
    const rows = Object.entries(model.jointProbabilities)
        .map(([key, probStr]) => {
            const prob = parseFloat(probStr);
            if (!key || isNaN(prob) || prob <= 0) return null;
            return `${key},${prob}`;
        })
        .filter(Boolean);

    return [header, ...rows].join('\n');
};


const App: React.FC = () => {
    const [inputText, setInputText] = useState<string>('VarA,VarB,VarC,VarD\n1,10,red,low\n2,20,blue,medium\n2,20,red,high\n3,31,green,medium\n3,31,blue,low\n3,31,red,high\n4,44,red,high\n4,44,green,medium\n4,44,blue,low\n4,44,blue,low');
    const [variables, setVariables] = useState<RandomVariable[]>([]);
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

    const areModelsValid = useMemo(() => {
        if (theoreticalModels.length === 0 || variables.length === 0) {
            return true;
        }
        return theoreticalModels.every(model => {
             const sum = Object.values(model.jointProbabilities).reduce((acc, probStr) => {
                const prob = parseFloat(probStr);
                return isNaN(prob) ? acc : acc + prob;
            }, 0);
             // Check if all probabilities are filled
             const stateSpaces = variables.map(v => model.stateSpaces[v.name]?.split(',').map(s => s.trim()).filter(Boolean) ?? []);
             if (stateSpaces.some(s => s.length === 0)) return true; // Don't validate if spaces are not defined
             const expectedProbs = stateSpaces.reduce((acc, curr) => acc * (curr.length || 1), 1);
             if (Object.keys(model.jointProbabilities).length !== expectedProbs) return true; // Don't validate if not fully populated

            return Math.abs(sum - 1.0) < 1e-5;
        });
    }, [theoreticalModels, variables]);

    const analysisResults: AnalysisResults | null = useMemo(() => {
        if (variables.length === 0) return null;
        try {
            setError(null);
            // Before analysis, transform the models into the required string format
            const modelsForAnalysis = theoreticalModels.map(m => ({
                ...m,
                distribution: generateDistributionString(m, variables.map(v => v.name))
            }));
            return performFullAnalysis(variables, modelsForAnalysis);
        } catch (e) {
            if (e instanceof Error) {
                setError(`Analysis Error: ${e.message}`);
            } else {
                setError('An unknown error occurred during analysis.');
            }
            return null;
        }
    }, [variables, theoreticalModels]);

    const handleAnalyze = () => {
        setIsLoading(true);
        setError(null);
        setVariables([]);

        try {
            const parsedData = parseInput(inputText);
            if (parsedData.length === 0 || parsedData[0].data.length === 0) {
                throw new Error("No data found. Please ensure the input has a header and data rows.");
            }

            const initialVariables: RandomVariable[] = parsedData.map((v, i) => ({
                id: `var-${i}-${Date.now()}`,
                name: v.name,
                data: v.data,
                type: detectVariableType(v.data),
                ordinalOrder: [],
            }));

            setVariables(initialVariables);
            // Default to an appropriate tab
            if (initialVariables.length > 1) setActiveTab('pairwise');
            else setActiveTab('single');

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

    const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        const uploadPromises: Promise<{ name: string; content: string } | { error: string }>[] = [];

        Array.from(files).forEach(file => {
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
    };

    const deleteDataset = (nameToDelete: string) => {
        setStoredDatasets(prev => prev.filter(dataset => dataset.name !== nameToDelete));
    };


    const updateVariable = (id: string, updatedProps: Partial<RandomVariable>) => {
        setVariables(prev =>
            prev.map(v => (v.id === id ? { ...v, ...updatedProps } : v))
        );
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
                                Enter comma-separated variable names in the first line (header). Each subsequent line should be a data instance.
                            </p>
                            <textarea
                                className="w-full h-64 p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                placeholder="Header1,Header2,Header3&#10;1,a,low&#10;2,b,medium&#10;3,c,high"
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
                                                Analyze data first to define model state spaces.
                                            </p>
                                        )}
                                    </div>
                                ))}
                                <button onClick={addModel} className="w-full py-2 text-sm font-medium text-blue-600 bg-blue-100 dark:bg-blue-900/50 dark:text-blue-300 rounded-md hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors">
                                    + Add Model
                                </button>
                            </div>
                        </div>

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
                                                <IconTable className="w-5 h-5"/><span>Dependence & Conditional</span>
                                            </button>
                                        )}
                                        {analysisResults.modelFit.length > 0 && (
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
                                                    results={analysisResults.single_vars[variable.id]}
                                                    models={theoreticalModels}
                                                    onUpdate={updateVariable}
                                                />
                                            ))}
                                        </div>
                                    )}
                                    {activeTab === 'pairwise' && (
                                        <div className="space-y-8">
                                            <CorrelationHeatmap 
                                                pairwiseResults={analysisResults.pairwise}
                                                variables={variables}
                                                models={theoreticalModels}
                                            />
                                            <JointDistributionTable
                                                jointPMF={analysisResults.empiricalJointPMF}
                                                variables={variables}
                                            />
                                            <ConditionalAnalysis
                                                conditionalResults={analysisResults.conditional}
                                                variables={variables}
                                                models={theoreticalModels}
                                            />
                                        </div>
                                    )}
                                    {activeTab === 'modelFit' && (
                                        <ModelFitResults
                                            modelFitResults={analysisResults.modelFit}
                                        />
                                    )}
                                </div>
                            </div>
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
