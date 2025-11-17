import React, { useState } from 'react';
import { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Line } from 'recharts';
import { type TimeSeriesAnalysisResults } from '../types';

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

export default StationaryAnalysis;
