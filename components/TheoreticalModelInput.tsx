import React, { useMemo } from 'react';
import { type TheoreticalModel } from '../types';

interface TheoreticalModelInputProps {
    model: TheoreticalModel;
    variableNames: string[];
    onUpdate: (id: string, updatedProps: Partial<TheoreticalModel>) => void;
}

const cartesianProduct = <T,>(...arrays: T[][]): T[][] => {
    return arrays.reduce<T[][]>(
        (acc, curr) => {
            if (acc.length === 0) return curr.map(item => [item]);
            return acc.flatMap(a => curr.map(c => [...a, c]));
        },
        []
    );
};


const TheoreticalModelInput: React.FC<TheoreticalModelInputProps> = ({ model, variableNames, onUpdate }) => {
    
    const handleStateSpaceChange = (varName: string, value: string) => {
        const newStateSpaces = { ...model.stateSpaces, [varName]: value };
        
        // When state space changes, we regenerate the joint probability table with default 0s
        const parsedSpaces = variableNames
            .map(name => newStateSpaces[name]?.split(',').map(s => s.trim()).filter(Boolean) ?? []);

        let newJointProbabilities: { [key: string]: string } = {};
        if (parsedSpaces.every(space => space.length > 0)) {
            const jointSpace = cartesianProduct(...parsedSpaces);
            jointSpace.forEach(state => {
                const key = state.join(',');
                newJointProbabilities[key] = '0';
            });
        }

        onUpdate(model.id, { stateSpaces: newStateSpaces, jointProbabilities: newJointProbabilities });
    };

    const handleProbabilityChange = (key: string, value: string) => {
        // Enforce 5 decimal place limit
        const match = value.match(/^-?\d*\.?\d{0,5}/);
        const truncatedValue = match ? match[0] : '';
        const newProbs = { ...model.jointProbabilities, [key]: truncatedValue };
        onUpdate(model.id, { jointProbabilities: newProbs });
    };

    const { jointStateSpace, probabilitySum, isSumValid } = useMemo(() => {
        const parsedSpaces = variableNames
            .map(name => model.stateSpaces[name]?.split(',').map(s => s.trim()).filter(Boolean) ?? [])
            .filter(space => space.length > 0);

        if (parsedSpaces.length !== variableNames.length) {
            return { jointStateSpace: [], probabilitySum: 0, isSumValid: false };
        }

        const jointStateSpace = cartesianProduct(...parsedSpaces);
        
        let probabilitySum = 0;
        Object.values(model.jointProbabilities).forEach(probStr => {
            const prob = Number(probStr);
            if (!isNaN(prob)) {
                probabilitySum += prob;
            }
        });
        
        const isSumValid = Math.abs(probabilitySum - 1.0) < 1e-5;

        return { jointStateSpace, probabilitySum, isSumValid };
    }, [model.stateSpaces, model.jointProbabilities, variableNames]);


    return (
        <div className="space-y-4">
            <div>
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">1. Define State Spaces</h4>
                <div className="space-y-2">
                    {variableNames.map(name => (
                        <div key={name}>
                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">{name}</label>
                            <input
                                type="text"
                                value={model.stateSpaces[name] || ''}
                                onChange={(e) => handleStateSpaceChange(name, e.target.value)}
                                placeholder="e.g., value1, value2"
                                className="mt-1 w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-800 text-sm"
                            />
                        </div>
                    ))}
                </div>
            </div>

            {jointStateSpace.length > 0 && (
                <div>
                     <div className="flex justify-between items-center mb-2">
                        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">2. Set Probabilities</h4>
                        <div className={`text-xs font-mono p-1 rounded ${isSumValid ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300'}`}>
                           Sum: {probabilitySum.toFixed(5)}
                        </div>
                    </div>
                    <div className="max-h-60 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-md">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                             <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                                <tr>
                                    {variableNames.map(name => (
                                        <th key={name} className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">{name}</th>
                                    ))}
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Probability</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                                {jointStateSpace.map((state, index) => {
                                    const key = state.join(',');
                                    return (
                                        <tr key={index}>
                                            {state.map((val, i) => (
                                                <td key={i} className="px-3 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{val}</td>
                                            ))}
                                            <td className="px-3 py-2">
                                                <input
                                                    type="number"
                                                    step="0.00001"
                                                    min="0"
                                                    max="1"
                                                    value={model.jointProbabilities[key] || ''}
                                                    onChange={(e) => handleProbabilityChange(key, e.target.value)}
                                                    placeholder="0"
                                                    className="w-full p-1 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-800 text-sm"
                                                />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TheoreticalModelInput;