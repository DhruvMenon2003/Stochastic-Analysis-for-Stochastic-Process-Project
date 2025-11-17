import React from 'react';
import { type TPM } from '../types';

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

export default TPMDisplay;
