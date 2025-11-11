import { type RandomVariable, VariableType, type AnalysisResults, type SingleVarResults, type PairwiseResult, type Distribution } from '../types';

// --- UTILITY & PARSING ---

export const parseInput = (text: string): { name: string, data: string[] }[] => {
    return text.trim().split('\n').filter(line => line.trim() !== '').map((line, index) => {
        const parts = line.split(',').map(p => p.trim());
        if (parts.some(p => p === '')) {
            throw new Error(`Line ${index + 1} ("${line.substring(0, 30)}...") contains missing values. Please ensure all values are filled.`);
        }
        const filteredParts = parts.filter(p => p !== '');
        if (filteredParts.length === 0) return { name: '', data: [] };
        
        const isFirstPartText = isNaN(parseFloat(filteredParts[0]));
        const name = isFirstPartText ? filteredParts[0] : `Variable ${index + 1}`;
        const data = isFirstPartText ? filteredParts.slice(1) : filteredParts;
        return { name, data };
    }).filter(v => v.data.length > 0);
};


export const detectVariableType = (data: string[]): VariableType => {
    const isNumeric = data.every(d => !isNaN(parseFloat(d)) && isFinite(Number(d)));
    if (isNumeric) return VariableType.Numerical;
    return VariableType.Nominal;
};

// --- SINGLE VARIABLE CALCULATIONS ---

const calculatePMF = (data: (string | number)[]): Map<string | number, number> => {
    const counts = new Map<string | number, number>();
    data.forEach(val => {
        counts.set(val, (counts.get(val) || 0) + 1);
    });
    const total = data.length;
    const pmf = new Map<string | number, number>();
    counts.forEach((count, val) => {
        pmf.set(val, count / total);
    });
    return pmf;
};

const getDistribution = (data: (string | number)[], type: VariableType, order: string[]): Distribution => {
    const numericData = data.map(Number);
    const pmf = calculatePMF(type === VariableType.Numerical ? numericData : data);
    
    let sortedKeys: (string|number)[];
    if (type === VariableType.Numerical) {
        sortedKeys = Array.from(pmf.keys()).map(Number).sort((a, b) => a - b);
    } else if (type === VariableType.Ordinal && order.length > 0) {
        sortedKeys = order;
    } else {
        sortedKeys = Array.from(pmf.keys()).sort();
    }
    
    let cumulative = 0;
    const distribution: Distribution = [];

    sortedKeys.forEach(key => {
        const prob = pmf.get(key) || 0;
        if (prob > 0) {
            cumulative += prob;
            distribution.push({
                value: key,
                probability: prob,
                cumulative: cumulative
            });
        }
    });
    
    return distribution;
}


const calculateMean = (data: number[]): number => {
    return data.reduce((sum, val) => sum + val, 0) / data.length;
};

const calculateVariance = (data: number[], mean: number): number => {
    return data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length;
};

const calculateMode = (data: (string | number)[]): (string | number)[] => {
    const counts = new Map<string | number, number>();
    data.forEach(val => {
        counts.set(val, (counts.get(val) || 0) + 1);
    });
    let maxCount = 0;
    counts.forEach(count => {
        if (count > maxCount) maxCount = count;
    });
    if (maxCount <= 1 && data.length > 1) return []; // No unique mode
    const modes: (string | number)[] = [];
    counts.forEach((count, val) => {
        if (count === maxCount) modes.push(val);
    });
    return modes;
};

const calculateMedian = (data: (string|number)[], order: string[]): string | number => {
    const sortedData = [...data].sort((a, b) => order.indexOf(a.toString()) - order.indexOf(b.toString()));
    const mid = Math.floor(sortedData.length / 2);
    if (sortedData.length % 2 === 0) {
        // For even numbers, taking the lower of the two middle values as convention
        return sortedData[mid - 1];
    }
    return sortedData[mid];
};

// --- PAIRWISE DEPENDENCE CALCULATIONS ---

const calculatePearsonCorrelation = (data1: number[], data2: number[]): number => {
    if (data1.length !== data2.length) throw new Error("Data lengths must match for Pearson correlation.");
    const n = data1.length;
    const mean1 = calculateMean(data1);
    const mean2 = calculateMean(data2);
    const stdDev1 = Math.sqrt(calculateVariance(data1, mean1));
    const stdDev2 = Math.sqrt(calculateVariance(data2, mean2));

    if (stdDev1 === 0 || stdDev2 === 0) return NaN; // Cannot compute if one variable is constant

    let covariance = 0;
    for (let i = 0; i < n; i++) {
        covariance += (data1[i] - mean1) * (data2[i] - mean2);
    }
    covariance /= n;

    return covariance / (stdDev1 * stdDev2);
};

const calculateMutualInformation = (data1: (string | number)[], data2: (string | number)[]): number => {
    if (data1.length !== data2.length) throw new Error("Data lengths must match for Mutual Information.");
    const n = data1.length;
    const p1 = calculatePMF(data1);
    const p2 = calculatePMF(data2);
    
    const jointCounts = new Map<string, number>();
    for (let i = 0; i < n; i++) {
        const key = `${data1[i]}__${data2[i]}`;
        jointCounts.set(key, (jointCounts.get(key) || 0) + 1);
    }

    let mi = 0;
    jointCounts.forEach((count, key) => {
        const [val1, val2] = key.split('__');
        const p_xy = count / n;
        const p_x = p1.get(val1) || p1.get(Number(val1)) || 0;
        const p_y = p2.get(val2) || p2.get(Number(val2)) || 0;
        if (p_x > 0 && p_y > 0) {
            mi += p_xy * Math.log2(p_xy / (p_x * p_y));
        }
    });

    return mi;
};

const getDistanceMatrix = (data: (string | number)[], isNumeric: boolean) => {
    const n = data.length;
    const matrix = Array(n).fill(0).map(() => Array(n).fill(0));
    for (let i = 0; i < n; i++) {
        for (let j = i; j < n; j++) {
            let dist: number;
            if (isNumeric) {
                dist = Math.abs(Number(data[i]) - Number(data[j]));
            } else {
                dist = data[i] === data[j] ? 0 : 1;
            }
            matrix[i][j] = dist;
            matrix[j][i] = dist;
        }
    }
    return matrix;
};

const doubleCenterMatrix = (matrix: number[][]) => {
    const n = matrix.length;
    const rowMeans = matrix.map(row => row.reduce((a, b) => a + b, 0) / n);
    const colMeans = Array(n).fill(0).map((_, j) => matrix.reduce((sum, row) => sum + row[j], 0) / n);
    const totalMean = rowMeans.reduce((a, b) => a + b, 0) / n;

    const centered = Array(n).fill(0).map(() => Array(n).fill(0));
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            centered[i][j] = matrix[i][j] - rowMeans[i] - colMeans[j] + totalMean;
        }
    }
    return centered;
};


const calculateDistanceCorrelation = (data1: (string | number)[], isNumeric1: boolean, data2: (string | number)[], isNumeric2: boolean): number => {
    if (data1.length !== data2.length) throw new Error("Data lengths must match for Distance Correlation.");
    const n = data1.length;
    if (n === 0) return NaN;

    const distA = getDistanceMatrix(data1, isNumeric1);
    const distB = getDistanceMatrix(data2, isNumeric2);

    const centeredA = doubleCenterMatrix(distA);
    const centeredB = doubleCenterMatrix(distB);

    let dCov2 = 0;
    let dVarA2 = 0;
    let dVarB2 = 0;

    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            dCov2 += centeredA[i][j] * centeredB[i][j];
            dVarA2 += centeredA[i][j] * centeredA[i][j];
            dVarB2 += centeredB[i][j] * centeredB[i][j];
        }
    }
    dCov2 /= (n * n);
    dVarA2 /= (n * n);
    dVarB2 /= (n * n);

    if (dVarA2 <= 0 || dVarB2 <= 0) return 0;

    return Math.sqrt(dCov2 / Math.sqrt(dVarA2 * dVarB2));
};


// --- MAIN ANALYSIS ORCHESTRATOR ---

export const performFullAnalysis = (variables: RandomVariable[]): AnalysisResults => {
    const results: AnalysisResults = {
        single_vars: {},
        pairwise: [],
    };

    // Single variable analysis
    variables.forEach(v => {
        const singleResult: SingleVarResults = { pmf: [] };
        const numericData = v.type === VariableType.Numerical ? v.data.map(Number) : [];
        
        singleResult.pmf = getDistribution(v.data, v.type, v.ordinalOrder);

        if (v.type === VariableType.Numerical) {
            const mean = calculateMean(numericData);
            singleResult.mean = mean;
            singleResult.variance = calculateVariance(numericData, mean);
        }
        if (v.type === VariableType.Nominal || v.type === VariableType.Ordinal) {
            singleResult.mode = calculateMode(v.data);
        }
        if (v.type === VariableType.Ordinal) {
            if (v.ordinalOrder.length > 0 && v.ordinalOrder.length === new Set(v.data).size) {
                 singleResult.median = calculateMedian(v.data, v.ordinalOrder);
            }
        }
        results.single_vars[v.id] = singleResult;
    });
    
    // Pairwise analysis
    if (variables.length > 1) {
        for (let i = 0; i < variables.length; i++) {
            for (let j = i + 1; j < variables.length; j++) {
                const v1 = variables[i];
                const v2 = variables[j];
                const pairwiseResult: PairwiseResult = {
                    var1_id: v1.id, var1_name: v1.name,
                    var2_id: v2.id, var2_name: v2.name
                };

                const isV1Numeric = v1.type === VariableType.Numerical;
                const isV2Numeric = v2.type === VariableType.Numerical;
                
                if (isV1Numeric && isV2Numeric) {
                    pairwiseResult.pearsonCorrelation = calculatePearsonCorrelation(v1.data.map(Number), v2.data.map(Number));
                }

                pairwiseResult.mutualInformation = calculateMutualInformation(v1.data, v2.data);
                pairwiseResult.distanceCorrelation = calculateDistanceCorrelation(v1.data, isV1Numeric, v2.data, isV2Numeric);
                
                results.pairwise.push(pairwiseResult);
            }
        }
    }
    
    return results;
};

// --- EXPORT FUNCTIONS ---

export const exportToJson = (results: AnalysisResults): string => {
    return JSON.stringify(results, null, 2);
};

export const exportToCsv = (results: AnalysisResults, variables: RandomVariable[]): string => {
    let csv = '';

    csv += 'Single Variable Analysis\n';
    csv += 'Variable Name,Type,Metric,Value\n';
    variables.forEach(v => {
        const res = results.single_vars[v.id];
        const formatVal = (val: any) => val === undefined || val === null ? 'N/A' : val;
        csv += `"${v.name}","${v.type}",Mean,${formatVal(res.mean?.toFixed(4))}\n`;
        csv += `"${v.name}","${v.type}",Variance,${formatVal(res.variance?.toFixed(4))}\n`;
        csv += `"${v.name}","${v.type}",Mode,${Array.isArray(res.mode) && res.mode.length > 0 ? `"${res.mode.join('; ')}"` : 'N/A'}\n`;
        csv += `"${v.name}","${v.type}",Median,${formatVal(res.median)}\n`;
    });

    if(results.pairwise.length > 0) {
        csv += '\n';
        csv += 'Pairwise Dependence Analysis\n';
        csv += 'Variable 1,Variable 2,Distance Correlation,Pearson Correlation,Mutual Information\n';
        results.pairwise.forEach(p => {
            csv += `"${p.var1_name}","${p.var2_name}",${p.distanceCorrelation?.toFixed(4) ?? 'N/A'},${p.pearsonCorrelation?.toFixed(4) ?? 'N/A'},${p.mutualInformation?.toFixed(4) ?? 'N/A'}\n`;
        });
    }

    return csv;
};
