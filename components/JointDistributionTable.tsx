import React, { useState, useMemo } from 'react';
import { type RandomVariable, type JointPMF, type TheoreticalModel } from '../types';

interface JointDistributionTableProps {
    empiricalJointPMF: JointPMF;
    theoreticalJointPMFs: { [modelId: string]: JointPMF };
    variables: RandomVariable[];
    models: TheoreticalModel[];
}

const JointDistributionTable: React.FC<JointDistributionTableProps> = ({ empiricalJointPMF, theoreticalJointPMFs, variables, models }) => {
    const [selectedSourceId, setSelectedSourceId] = useState<string>('empirical');

    const sources = useMemo(() => [
        { id: 'empirical', name: 'Empirical (Data)' },
        ...models.filter(m => theoreticalJointPMFs[m.id]).map(m => ({ id: m.id, name: m.name }))
    ], [models, theoreticalJointPMFs]);

    const activePMF = useMemo(() => {
        if (selectedSourceId === 'empirical') {
            return empiricalJointPMF;
        }
        return theoreticalJointPMFs[selectedSourceId];
    }, [selectedSourceId, empiricalJointPMF, theoreticalJointPMFs]);


    if (!activePMF || activePMF.size === 0) {
        return null;
    }

    const sortedEntries = Array.from(activePMF.entries()).sort((a, b) => a[0].localeCompare(b[0]));

    return (
        <div className="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <h3 className="text-xl font-semibold">Joint Distribution</h3>
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
            <div className="max-h-80 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                        <tr>
                            {variables.map(v => (
                                <th key={v.id} className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                    {v.name}
                                </th>
                            ))}
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                Probability
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                        {sortedEntries.map(([key, probability]) => {
                            const values = key.split(',');
                            return (
                                <tr key={key}>
                                    {values.map((val, index) => (
                                        <td key={`${key}-${index}`} className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                                            {val}
                                        </td>
                                    ))}
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300 font-mono">
                                        {probability.toFixed(5)}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default JointDistributionTable;