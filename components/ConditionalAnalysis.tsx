import React, { useState, useMemo } from 'react';
import { type AnalysisResults, type RandomVariable, type TheoreticalModel, ConditionalResult } from '../types';

interface ConditionalAnalysisProps {
    conditionalResults: AnalysisResults['conditional'];
    variables: RandomVariable[];
    models: TheoreticalModel[];
}

const formatNumber = (num?: number) => (num !== undefined && num !== null ? num.toFixed(4) : 'N/A');

const ConditionalResultTable: React.FC<{
    results: ConditionalResult[];
}> = ({ results }) => {
    if (!results || results.length === 0) return <p className="text-sm text-center italic text-gray-500 dark:text-gray-400 py-4">No conditional data available for this selection.</p>;

    return (
        <div className="overflow-x-auto p-1">
            <table className="min-w-full text-sm divide-y divide-gray-200 dark:divide-gray-700">
                 <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                        <th className="px-3 py-2 text-left font-medium">Value</th>
                        <th className="px-3 py-2 text-left font-medium">Probability</th>
                        <th className="px-3 py-2 text-left font-medium">Mean</th>
                        <th className="px-3 py-2 text-left font-medium">Variance</th>
                    </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                    {results.map(res => (
                        <React.Fragment key={res.conditionValue}>
                             <tr className="bg-gray-50 dark:bg-gray-800/50">
                                <td colSpan={4} className="px-3 py-2 font-bold text-gray-800 dark:text-gray-200">
                                    Condition: {res.givenVariable} = {res.conditionValue}
                                </td>
                            </tr>
                            {res.distribution.map((distPoint, index) => (
                                <tr key={distPoint.value}>
                                    <td className="px-3 py-2">{distPoint.value}</td>
                                    <td className="px-3 py-2 font-mono">{formatNumber(distPoint.probability)}</td>
                                    {index === 0 && (
                                        <>
                                            <td rowSpan={res.distribution.length} className="px-3 py-2 font-mono align-top border-l border-gray-200 dark:border-gray-700">{formatNumber(res.mean)}</td>
                                            <td rowSpan={res.distribution.length} className="px-3 py-2 font-mono align-top border-l border-gray-200 dark:border-gray-700">{formatNumber(res.variance)}</td>
                                        </>
                                    )}
                                </tr>
                            ))}
                        </React.Fragment>
                    ))}
                </tbody>
            </table>
        </div>
    );
};


const ConditionalAnalysis: React.FC<ConditionalAnalysisProps> = ({ conditionalResults, variables, models }) => {
    const [var1Id, setVar1Id] = useState<string>(variables[0]?.id || '');
    const [var2Id, setVar2Id] = useState<string>(variables[1]?.id || '');
    const [selectedSourceId, setSelectedSourceId] = useState<string>('empirical');

    const { selectedResults, sources } = useMemo(() => {
        if (!var1Id || !var2Id || var1Id === var2Id) return { selectedResults: null, sources: [] };
        
        const v1 = variables.find(v => v.id === var1Id);
        const v2 = variables.find(v => v.id === var2Id);
        if (!v1 || !v2) return { selectedResults: null, sources: [] };

        const sortedVars = [v1, v2].sort((a,b) => a.id.localeCompare(b.id));
        const key = `${sortedVars[0].id}-${sortedVars[1].id}`;
        
        const results = conditionalResults[key];
        
        const availableSources = [
            { id: 'empirical', name: 'Empirical (Data)' },
            ...models.filter(m => results?.theoretical[m.id]).map(m => ({ id: m.id, name: m.name }))
        ];

        return { selectedResults: results, sources: availableSources };
    }, [var1Id, var2Id, conditionalResults, variables, models]);

    if (variables.length < 2) return null;

    const selectedVar1 = variables.find(v => v.id === var1Id);
    const selectedVar2 = variables.find(v => v.id === var2Id);

    const displayedResults1 = selectedSourceId === 'empirical' 
        ? selectedResults?.empirical[selectedVar2?.name ?? ''] 
        : selectedResults?.theoretical[selectedSourceId]?.[selectedVar2?.name ?? ''];
        
    const displayedResults2 = selectedSourceId === 'empirical'
        ? selectedResults?.empirical[selectedVar1?.name ?? '']
        : selectedResults?.theoretical[selectedSourceId]?.[selectedVar1?.name ?? ''];

    return (
        <div className="space-y-4">
            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                 <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                    <h3 className="text-xl font-semibold">Conditional Analysis</h3>
                     {sources.length > 1 && (
                        <select
                            value={selectedSourceId}
                            onChange={(e) => setSelectedSourceId(e.target.value)}
                            className="block text-sm border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md py-1.5"
                        >
                            {sources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    )}
                 </div>
                <div className="flex flex-wrap items-center gap-4 mb-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                    <div>
                        <label htmlFor="var1-select" className="text-sm font-medium mr-2">Variable (e.g., A)</label>
                        <select id="var1-select" value={var1Id} onChange={e => setVar1Id(e.target.value)} className="p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800">
                             {variables.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                        </select>
                    </div>
                    <span className="font-bold text-lg">|</span>
                    <div>
                        <label htmlFor="var2-select" className="text-sm font-medium mr-2">Given (e.g., B)</label>
                        <select id="var2-select" value={var2Id} onChange={e => setVar2Id(e.target.value)} className="p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800">
                             {variables.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                        </select>
                    </div>
                </div>

                {var1Id === var2Id && var1Id !== '' && (
                    <p className="text-sm text-yellow-600 dark:text-yellow-400">Please select two different variables for conditional analysis.</p>
                )}
                
                {selectedResults && selectedVar1 && selectedVar2 && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div>
                             <h4 className="text-lg font-semibold mb-2 text-center">P({selectedVar1.name} | {selectedVar2.name})</h4>
                             {displayedResults1 && <ConditionalResultTable results={displayedResults1} />}
                        </div>
                         <div>
                             <h4 className="text-lg font-semibold mb-2 text-center">P({selectedVar2.name} | {selectedVar1.name})</h4>
                              {displayedResults2 && <ConditionalResultTable results={displayedResults2} />}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ConditionalAnalysis;