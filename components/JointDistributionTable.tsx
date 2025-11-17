import React from 'react';
import { type RandomVariable, type JointPMF } from '../types';

interface JointDistributionTableProps {
    jointPMF: JointPMF;
    variables: RandomVariable[];
}

const JointDistributionTable: React.FC<JointDistributionTableProps> = ({ jointPMF, variables }) => {
    if (!jointPMF || jointPMF.size === 0) {
        return null;
    }

    const sortedEntries = Array.from(jointPMF.entries()).sort((a, b) => a[0].localeCompare(b[0]));

    return (
        <div className="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-6">
            <h3 className="text-xl font-semibold">Empirical Joint Distribution</h3>
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