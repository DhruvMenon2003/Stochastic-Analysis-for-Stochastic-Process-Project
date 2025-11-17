import React, { useMemo } from 'react';
import { type JointPMF } from '../types';

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

export default JointPMFTable;
