import {
    type RandomVariable,
    type AnalysisResults,
    VariableType,
    type TheoreticalModel,
    type SingleVarResults,
    type PairwiseResult,
    type ModelFitResult,
    type JointPMF,
    type Distribution,
    type SingleVarMetrics,
    type PairwiseConditionalAnalysis,
    type ConditionalResult,
    type PairwiseMetrics,
    type TimeSeriesAnalysisResults,
    type TPM,
    type HellingerResult
} from '../types';

// --- UTILITY FUNCTIONS ---

/**
 * Calculates the mean of a numerical distribution.
 */
const calculateMean = (dist: Distribution): number => {
    return dist.reduce((acc, { value, probability }) => acc + Number(value) * probability, 0);
};

/**
 * Calculates the variance of a numerical distribution.
 */
const calculateVariance = (dist: Distribution, mean: number): number => {
    return dist.reduce((acc, { value, probability }) => acc + Math.pow(Number(value) - mean, 2) * probability, 0);
};

/**
 * Calculates the mode(s) of a distribution.
 */
const calculateMode = (dist: Distribution): (string | number)[] => {
    if (dist.length === 0) return [];
    const maxProb = Math.max(...dist.map(p => p.probability));
    // Use a small epsilon for floating point comparison
    return dist.filter(p => Math.abs(p.probability - maxProb) < 1e-9).map(p => p.value);
};

/**
 * Calculates the median of a distribution.
 */
const calculateMedian = (dist: Distribution, type: VariableType, ordinalOrder: string[]): string | number | undefined => {
    if (dist.length === 0) return undefined;
    
    let sortedDist = [...dist];
    if (type === VariableType.Numerical) {
        sortedDist.sort((a, b) => Number(a.value) - Number(b.value));
    } else if (type === VariableType.Ordinal && ordinalOrder.length > 0) {
        sortedDist.sort((a, b) => ordinalOrder.indexOf(String(a.value)) - ordinalOrder.indexOf(String(b.value)));
    }
    // For nominal, median is not well-defined, but we can return the first value past 0.5 cumulative for completeness.

    let cumulative = 0;
    for (const point of sortedDist) {
        cumulative += point.probability;
        if (cumulative >= 0.5) {
            return point.value;
        }
    }
    // Should not be reached if probabilities sum to 1, but as a fallback:
    return sortedDist[sortedDist.length - 1].value;
};


/**
 * Converts a PMF map to a Distribution array with cumulative probabilities.
 */
const pmfToDistribution = (pmf: JointPMF, type: VariableType, ordinalOrder: string[]): Distribution => {
    const dist: { value: string | number, probability: number }[] = Array.from(pmf.entries()).map(([value, probability]) => ({
        value: type === VariableType.Numerical ? Number(value) : value,
        probability,
    }));

    if (type === VariableType.Numerical) {
        dist.sort((a, b) => Number(a.value) - Number(b.value));
    } else if (type === VariableType.Ordinal && ordinalOrder.length > 0) {
        dist.sort((a, b) => ordinalOrder.indexOf(String(a.value)) - ordinalOrder.indexOf(String(b.value)));
    } else {
        // Sort by value for consistency if not numerical or ordered ordinal
        dist.sort((a, b) => String(a.value).localeCompare(String(a.value)));
    }
    
    let cumulative = 0;
    return dist.map(p => {
        cumulative += p.probability;
        return { ...p, cumulative };
    });
};

/**
 * Calculates single variable metrics from a PMF.
 */
const getSingleVarMetrics = (pmf: JointPMF, type: VariableType, ordinalOrder: string[]): SingleVarMetrics => {
    const distribution = pmfToDistribution(pmf, type, ordinalOrder);
    const metrics: SingleVarMetrics = {
        pmf: distribution,
        mode: calculateMode(distribution),
        median: calculateMedian(distribution, type, ordinalOrder),
    };

    if (type === VariableType.Numerical && distribution.every(p => !isNaN(Number(p.value)))) {
        metrics.mean = calculateMean(distribution);
        if(metrics.mean !== undefined){
            metrics.variance = calculateVariance(distribution, metrics.mean);
        }
    }

    return metrics;
};


// --- CORE LOGIC FUNCTIONS ---

/**
 * Calculates the joint probability mass function from the raw data.
 */
const getEmpiricalJointPMF = (variables: RandomVariable[]): JointPMF => {
    const jointPMF: JointPMF = new Map();
    const numSamples = variables[0]?.data.length || 0;
    if (numSamples === 0) return jointPMF;

    for (let i = 0; i < numSamples; i++) {
        const outcome = variables.map(v => v.data[i]).join(',');
        jointPMF.set(outcome, (jointPMF.get(outcome) || 0) + 1);
    }

    for (const [outcome, count] of jointPMF.entries()) {
        jointPMF.set(outcome, count / numSamples);
    }

    return jointPMF;
};

/**
 * Marginalizes a joint PMF to get the PMF of a subset of variables.
 */
const getMarginalPMF = (jointPMF: JointPMF, varIndicesToKeep: number[], numTotalVars: number): JointPMF => {
    const marginalPMF: JointPMF = new Map();
    for (const [outcome, prob] of jointPMF.entries()) {
        const values = outcome.split(',');
        if (values.length !== numTotalVars) continue;
        const marginalKey = varIndicesToKeep.map(i => values[i]).join(',');
        marginalPMF.set(marginalKey, (marginalPMF.get(marginalKey) || 0) + prob);
    }
    return marginalPMF;
};

/**
 * Calculates Pearson correlation for two numerical variables.
 */
const calculatePearsonCorrelation = (data1: string[], data2: string[]): number => {
    const n = data1.length;
    const numData1 = data1.map(Number);
    const numData2 = data2.map(Number);
    
    const mean1 = numData1.reduce((a, b) => a + b, 0) / n;
    const mean2 = numData2.reduce((a, b) => a + b, 0) / n;
    
    const stdDev1 = Math.sqrt(numData1.map(x => Math.pow(x - mean1, 2)).reduce((a, b) => a + b, 0) / n);
    const stdDev2 = Math.sqrt(numData2.map(x => Math.pow(x - mean2, 2)).reduce((a, b) => a + b, 0) / n);
    
    if (stdDev1 === 0 || stdDev2 === 0) return 0;

    let cov = 0;
    for (let i = 0; i < n; i++) {
        cov += (numData1[i] - mean1) * (numData2[i] - mean2);
    }
    cov /= n;

    return cov / (stdDev1 * stdDev2);
};

/**
 * Calculates mutual information between two variables from their PMFs.
 */
const calculateMutualInformation = (jointPMF: JointPMF, marginal1: JointPMF, marginal2: JointPMF): number => {
    let mi = 0;
    for (const [jointKey, jointProb] of jointPMF.entries()) {
        const [key1, key2] = jointKey.split(',');
        const prob1 = marginal1.get(key1) || 0;
        const prob2 = marginal2.get(key2) || 0;
        if (jointProb > 1e-9 && prob1 > 1e-9 && prob2 > 1e-9) {
            mi += jointProb * Math.log2(jointProb / (prob1 * prob2));
        }
    }
    return mi;
};

/**
 * Calculates distance correlation.
 */
 const calculateDistanceCorrelation = (data1: string[], data2: string[]): number => {
    const n = data1.length;
    if (n < 2) return 0;

    const isNumeric1 = detectVariableType(data1) === VariableType.Numerical;
    const isNumeric2 = detectVariableType(data2) === VariableType.Numerical;

    const dist = (a: string, b: string, isNumeric: boolean) => isNumeric ? Math.abs(Number(a) - Number(b)) : (a === b ? 0 : 1);
    
    const a = Array.from({ length: n }, () => Array(n).fill(0));
    const b = Array.from({ length: n }, () => Array(n).fill(0));

    for (let i = 0; i < n; i++) {
        for (let j = i; j < n; j++) {
            a[i][j] = a[j][i] = dist(data1[i], data1[j], isNumeric1);
            b[i][j] = b[j][i] = dist(data2[i], data2[j], isNumeric2);
        }
    }

    const doubleCenter = (matrix: number[][]): number[][] => {
        const centered = Array.from({ length: n }, () => Array(n).fill(0));
        const rowMeans = matrix.map(row => row.reduce((s, v) => s + v, 0) / n);
        const colMeans = rowMeans; // symmetric
        const totalMean = rowMeans.reduce((s, v) => s + v, 0) / n;
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                centered[i][j] = matrix[i][j] - rowMeans[i] - colMeans[j] + totalMean;
            }
        }
        return centered;
    };
    
    const A = doubleCenter(a);
    const B = doubleCenter(b);
    
    let dCov2 = 0, dVar1_2 = 0, dVar2_2 = 0;
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            dCov2 += A[i][j] * B[i][j];
            dVar1_2 += A[i][j] * A[i][j];
            dVar2_2 += B[i][j] * B[i][j];
        }
    }
    
    dCov2 /= (n * n);
    dVar1_2 /= (n * n);
    dVar2_2 /= (n * n);
    
    if (dVar1_2 <= 1e-9 || dVar2_2 <= 1e-9) return 0;

    return Math.sqrt(Math.max(0, dCov2 / Math.sqrt(dVar1_2 * dVar2_2)));
};

/**
 * Calculates Cramer's V for two categorical variables.
 */
const calculateCramersV = (data1: string[], data2: string[]): number => {
    const n = data1.length;
    if (n === 0) return 0;

    const levels1 = [...new Set(data1)];
    const levels2 = [...new Set(data2)];
    const r = levels1.length;
    const k = levels2.length;
    if (r < 2 || k < 2) return 0;

    const contingencyTable: { [key1: string]: { [key2: string]: number } } = {};
    levels1.forEach(l1 => {
        contingencyTable[l1] = {};
        levels2.forEach(l2 => contingencyTable[l1][l2] = 0);
    });

    for (let i = 0; i < n; i++) {
        contingencyTable[data1[i]][data2[i]]++;
    }

    let chi2 = 0;
    for (let i = 0; i < r; i++) {
        for (let j = 0; j < k; j++) {
            const rowTotal = Object.values(contingencyTable[levels1[i]]).reduce((a, b) => a + b, 0);
            const colTotal = levels1.reduce((sum, l1) => sum + contingencyTable[l1][levels2[j]], 0);
            const expected = (rowTotal * colTotal) / n;
            if (expected > 0) {
                const observed = contingencyTable[levels1[i]][levels2[j]];
                chi2 += Math.pow(observed - expected, 2) / expected;
            }
        }
    }
    
    const minDim = Math.min(k - 1, r - 1);
    if (minDim === 0) return 0;

    return Math.sqrt(chi2 / (n * minDim));
};

/**
 * Calculates conditional distributions for a pair of variables.
 */
const getConditionalDistributions = (
    jointPMF: JointPMF,
    marginal1: JointPMF,
    marginal2: JointPMF,
    var1: RandomVariable,
    var2: RandomVariable
): { [givenVarName: string]: ConditionalResult[] } => {
    const results: { [givenVarName: string]: ConditionalResult[] } = {
        [var1.name]: [],
        [var2.name]: [],
    };
    const var1IsNumeric = var1.type === VariableType.Numerical;
    const var2IsNumeric = var2.type === VariableType.Numerical;

    // P(var1 | var2)
    for (const [val2, prob2] of marginal2.entries()) {
        if(prob2 < 1e-9) continue;
        const conditionalDist: { value: string, probability: number }[] = [];
        for (const [val1] of marginal1.entries()) {
            const jointProb = jointPMF.get(`${val1},${val2}`) || 0;
            conditionalDist.push({ value: val1, probability: jointProb / prob2 });
        }
        
        const dist = pmfToDistribution(new Map(conditionalDist.map(i => [i.value, i.probability])), var1.type, var1.ordinalOrder);
        const result: ConditionalResult = { conditionalVariable: var1.name, givenVariable: var2.name, conditionValue: val2, distribution: dist };
        if (var1IsNumeric) {
            result.mean = calculateMean(dist);
            if(result.mean !== undefined) {
                result.variance = calculateVariance(dist, result.mean);
            }
        }
        results[var2.name].push(result);
    }
    
    // P(var2 | var1)
    for (const [val1, prob1] of marginal1.entries()) {
         if(prob1 < 1e-9) continue;
        const conditionalDist: { value: string, probability: number }[] = [];
        for (const [val2] of marginal2.entries()) {
            const jointProb = jointPMF.get(`${val1},${val2}`) || 0;
            conditionalDist.push({ value: val2, probability: jointProb / prob1 });
        }

        const dist = pmfToDistribution(new Map(conditionalDist.map(i => [i.value, i.probability])), var2.type, var2.ordinalOrder);
        const result: ConditionalResult = { conditionalVariable: var2.name, givenVariable: var1.name, conditionValue: val1, distribution: dist };
        if (var2IsNumeric) {
            result.mean = calculateMean(dist);
             if(result.mean !== undefined) {
                result.variance = calculateVariance(dist, result.mean);
            }
        }
        results[var1.name].push(result);
    }
    
    return results;
};

/**
 * Parses a theoretical model's distribution string into a JointPMF.
 */
const parseTheoreticalModel = (model: TheoreticalModel, varNamesInOrder: string[]): JointPMF | string => {
    const lines = model.distribution.trim().split('\n');
    if (lines.length < 2) return "Model distribution is empty or invalid.";

    const header = lines[0].split(',').map(h => h.trim());
    const probIndex = header.indexOf('Probability');
    if (probIndex === -1) return "Model distribution must have a 'Probability' column.";
    
    const modelVarNames = header.slice(0, probIndex);
    if(JSON.stringify(modelVarNames) !== JSON.stringify(varNamesInOrder)) {
        return `Model variable order (${modelVarNames.join(',')}) does not match data order (${varNamesInOrder.join(',')}).`;
    }

    const jointPMF: JointPMF = new Map();
    let totalProb = 0;

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        if (values.length !== header.length) continue;
        const prob = parseFloat(values[probIndex]);
        if (isNaN(prob) || prob < 0) return `Invalid probability in row ${i + 1}: ${values[probIndex]}`;
        
        const key = values.slice(0, probIndex).join(',');
        jointPMF.set(key, (jointPMF.get(key) || 0) + prob);
        totalProb += prob;
    }

    if (Math.abs(totalProb - 1.0) > 1e-5) {
       // This is handled in the UI, but could be a warning here.
    }
    
    return jointPMF;
};


/**
 * Calculates the Hellinger distance between two probability mass functions.
 * This is a direct TypeScript translation of the provided MATLAB function.
 * Formula: H(P, Q) = (1/√2) * ||√P - √Q||₂
 * @param pmf1 The first probability distribution (model).
 * @param pmf2 The second probability distribution (data).
 * @returns A number between 0 (identical) and 1 (maximally different).
 */
const calculateHellingerDistance = (pmf1: JointPMF, pmf2: JointPMF): number => {
    const allKeys = new Set([...pmf1.keys(), ...pmf2.keys()]);
    let sumOfSquaredDiffs = 0;

    for (const key of allKeys) {
        const p1 = pmf1.get(key) || 0;
        const p2 = pmf2.get(key) || 0;
        sumOfSquaredDiffs += Math.pow(Math.sqrt(p1) - Math.sqrt(p2), 2);
    }

    return (1 / Math.sqrt(2)) * Math.sqrt(sumOfSquaredDiffs);
};

/**
 * Calculates the Shannon entropy (base 2) of a probability mass function.
 * It normalizes the PMF internally to handle potential floating point errors.
 * @param pmf A map representing the probability distribution.
 * @returns The Shannon entropy in bits.
 */
const calculateShannonEntropy = (pmf: JointPMF): number => {
    let total = 0;
    for (const p of pmf.values()) {
        total += p;
    }
    // Use a small epsilon for floating point comparison to avoid division by zero.
    if (Math.abs(total) < 1e-9) return 0;

    let H = 0;
    for (const p of pmf.values()) {
        if (p > 0) {
            const normalizedP = p / total;
            H -= normalizedP * Math.log2(normalizedP);
        }
    }
    return H;
};

/**
 * Calculates the Generalized Jensen-Shannon Divergence for multiple PMFs.
 * The divergence is H(M) - Σ(H(Pi))/n, where M is the mixture distribution.
 * @param pmfs An array of JointPMF objects.
 * @returns The GJS divergence in bits.
 */
const calculateGeneralizedJensenShannonDivergence = (pmfs: JointPMF[]): number => {
    const n = pmfs.length;
    if (n < 2) return 0;

    const mixturePmf: JointPMF = new Map();
    const allKeys = new Set<string>();
    pmfs.forEach(pmf => pmf.forEach((_, key) => allKeys.add(key)));

    for(const key of allKeys) {
        let sumProb = 0;
        pmfs.forEach(pmf => {
            sumProb += pmf.get(key) || 0;
        });
        mixturePmf.set(key, sumProb / n);
    }
    
    // Entropy of the mixture
    const H_M = calculateShannonEntropy(mixturePmf);
    
    // Mean of the entropies
    const H_sum = pmfs.reduce((sum, pmf) => sum + calculateShannonEntropy(pmf), 0);
    const H_mean = H_sum / n;

    // The result of JSD is between 0 and 1 (for log base 2).
    // Clamp to avoid small negative numbers due to floating point errors.
    return Math.max(0, H_M - H_mean);
};


// --- EXPORTED API ---

export const createDistributionStringFromModel = (model: TheoreticalModel, varNames: string[]): string => {
    if (varNames.length === 0) return '';
    const header = [...varNames, 'Probability'].join(',');
    const rows = Object.entries(model.jointProbabilities)
        .map(([key, probStr]) => {
            const prob = parseFloat(probStr as string);
            if (!key || isNaN(prob) || prob <= 0) return null;
            return `${key},${prob}`;
        })
        .filter(Boolean);

    return [header, ...rows].join('\n');
};

export const parseInput = (text: string): { name: string; data: string[] }[] => {
    const lines = text.trim().split('\n').filter(line => line.trim() !== '');
    if (lines.length < 2) {
        throw new Error("Input data must contain a header row and at least one data row.");
    }

    const header = lines[0].split(',').map(h => h.trim());
    const headerLength = header.length;
    if (headerLength === 0) {
        throw new Error("Header row is empty or invalid.");
    }
    
    const dataRows = lines.slice(1);
    const variables: { name: string; data: string[] }[] = header.map(name => ({ name, data: [] }));

    dataRows.forEach((row, rowIndex) => {
        const values = row.split(',').map(v => v.trim());
        if (values.length !== headerLength) {
            throw new Error(`Data row ${rowIndex + 1} has ${values.length} columns, but header has ${headerLength}. All rows must have the same number of columns.`);
        }
        values.forEach((value, index) => {
            if (variables[index]) variables[index].data.push(value);
        });
    });

    return variables.filter(v => v.name);
};


export const detectVariableType = (data: string[]): VariableType => {
    if (data.every(d => d === '' || !isNaN(Number(d)))) {
        return VariableType.Numerical;
    }
    return VariableType.Nominal;
};

const replacer = (key: any, value: any) => {
    if (value instanceof Map) return { dataType: 'Map', value: Array.from(value.entries()) };
    return value;
};

export const exportToJson = (results: AnalysisResults): string => {
    return JSON.stringify(results, replacer, 2);
};

const formatCsvValue = (val: any): string => {
    if (val === undefined || val === null) return 'N/A';
    if (Array.isArray(val)) return `"${val.join('; ')}"`;
    const str = String(val);
    if (str.includes(',')) return `"${str}"`;
    return str;
};

export const exportToCsv = (results: AnalysisResults, variables: RandomVariable[]): string => {
    let csv = '';

    // Single Variable Analysis
    csv += 'Single Variable Analysis\n';
    const firstVar = variables[0];
    if (firstVar && results.single_vars[firstVar.id]) {
        const modelNames = Object.keys(results.single_vars[firstVar.id].theoretical || {});
        
        variables.forEach(v => {
            const res = results.single_vars[v.id];
            if (!res) return;
            csv += `\nVariable,"${v.name}"\n`;
            csv += `Metric,Empirical,${modelNames.map(formatCsvValue).join(',')}\n`;
            
            const metrics: (keyof SingleVarMetrics)[] = ['mean', 'variance', 'median', 'mode'];
            metrics.forEach(metric => {
                const empiricalValue = res.empirical[metric];
                if (empiricalValue !== undefined && (!Array.isArray(empiricalValue) || empiricalValue.length > 0)) {
                    let row = `${metric},${formatCsvValue(empiricalValue)},`;
                    row += modelNames.map(modelId => formatCsvValue(res.theoretical[modelId]?.[metric])).join(',') + '\n';
                    csv += row;
                }
            });

            csv += '\nPMF (Empirical)\nValue,Probability\n';
            res.empirical.pmf.forEach(p => { csv += `${formatCsvValue(p.value)},${formatCsvValue(p.probability)}\n`; });

            modelNames.forEach(modelId => {
                csv += `\nPMF (${modelId})\nValue,Probability\n`;
                (res.theoretical[modelId]?.pmf || []).forEach(p => { csv += `${formatCsvValue(p.value)},${formatCsvValue(p.probability)}\n`; });
            });
        });
    }

    // Pairwise Analysis
    if (results.pairwise.length > 0) {
        csv += '\nPairwise Dependence Analysis\n';
        const firstPair = results.pairwise[0];
        const modelNames = Object.keys(firstPair.theoretical);
        csv += `Variable 1,Variable 2,Metric,Empirical,${modelNames.map(formatCsvValue).join(',')}\n`;

        const pairwiseMetrics: (keyof PairwiseMetrics)[] = ['distanceCorrelation', 'pearsonCorrelation', 'mutualInformation', 'cramersV'];
        results.pairwise.forEach(pair => {
            pairwiseMetrics.forEach(metric => {
                if (pair.empirical[metric] !== undefined) {
                    let row = `${pair.var1_name},${pair.var2_name},${metric},${formatCsvValue(pair.empirical[metric])},`;
                    row += modelNames.map(modelId => formatCsvValue(pair.theoretical[modelId]?.[metric])).join(',') + '\n';
                    csv += row;
                }
            });
        });
    }

    // Model Fit
    if (results.modelFit.length > 0) {
        csv += '\nModel Fit Analysis\n';
        csv += 'Model,Metric,Value\n';
        results.modelFit.forEach(fit => {
            if (fit.error) {
                csv += `${formatCsvValue(fit.modelName)},error,${formatCsvValue(fit.error)}\n`;
            } else {
                if (fit.hellingerDistance !== undefined) csv += `${formatCsvValue(fit.modelName)},Hellinger Distance,${formatCsvValue(fit.hellingerDistance)}\n`;
                if (fit.jensenShannonDistance !== undefined) csv += `${formatCsvValue(fit.modelName)},Jensen-Shannon Distance,${formatCsvValue(fit.jensenShannonDistance)}\n`;
                if (fit.mse) {
                    Object.entries(fit.mse).forEach(([varName, mse]) => {
                        csv += `${formatCsvValue(fit.modelName)},MSE (${varName}),${formatCsvValue(mse)}\n`;
                    });
                }
            }
        });
    }

    return csv;
};

export const performFullAnalysis = (variables: RandomVariable[], theoreticalModels: TheoreticalModel[] = []): AnalysisResults => {
    if (variables.length === 0 || variables[0]?.data.length === 0) {
        throw new Error("Cannot perform analysis on empty dataset.");
    }
    
    const numVars = variables.length;
    
    // --- EMPIRICAL ANALYSIS ---
    const empiricalJointPMF = getEmpiricalJointPMF(variables);
    const single_vars: { [variableId: string]: SingleVarResults } = {};
    const empiricalMarginals: { [variableId: string]: JointPMF } = {};

    variables.forEach((v, i) => {
        const pmf = getMarginalPMF(empiricalJointPMF, [i], numVars);
        empiricalMarginals[v.id] = pmf;
        single_vars[v.id] = {
            empirical: getSingleVarMetrics(pmf, v.type, v.ordinalOrder),
            theoretical: {},
        };
    });

    const pairwise: PairwiseResult[] = [];
    const conditional: { [pairKey: string]: PairwiseConditionalAnalysis } = {};

    for (let i = 0; i < numVars; i++) {
        for (let j = i + 1; j < numVars; j++) {
            const var1 = variables[i];
            const var2 = variables[j];
            
            const jointPMF = getMarginalPMF(empiricalJointPMF, [i, j], numVars);
            const marginal1 = empiricalMarginals[var1.id];
            const marginal2 = empiricalMarginals[var2.id];
            
            const isVar1Categorical = var1.type === VariableType.Nominal || var1.type === VariableType.Ordinal;
            const isVar2Categorical = var2.type === VariableType.Nominal || var2.type === VariableType.Ordinal;

            pairwise.push({
                var1_id: var1.id, var1_name: var1.name, var2_id: var2.id, var2_name: var2.name,
                empirical: {
                    distanceCorrelation: calculateDistanceCorrelation(var1.data, var2.data),
                    mutualInformation: calculateMutualInformation(jointPMF, marginal1, marginal2),
                    pearsonCorrelation: (var1.type === VariableType.Numerical && var2.type === VariableType.Numerical) ? calculatePearsonCorrelation(var1.data, var2.data) : undefined,
                    cramersV: (isVar1Categorical && isVar2Categorical) ? calculateCramersV(var1.data, var2.data) : undefined,
                },
                theoretical: {},
            });

            const pairKey = [var1.id, var2.id].sort().join('-');
            conditional[pairKey] = {
                empirical: getConditionalDistributions(jointPMF, marginal1, marginal2, var1, var2),
                theoretical: {}
            };
        }
    }
    
    // --- THEORETICAL & MODEL FIT ANALYSIS ---
    const modelFit: ModelFitResult[] = [];
    const varNamesInOrder = variables.map(v => v.name);
    const theoreticalJointPMFs: { [modelId: string]: JointPMF } = {};

    theoreticalModels.forEach(model => {
        const parsedModelPMF = parseTheoreticalModel(model, varNamesInOrder);
        
        if (typeof parsedModelPMF === 'string') {
            modelFit.push({ modelName: model.name, error: parsedModelPMF });
            return;
        }

        if (parsedModelPMF.size === 0) {
            return;
        }
        
        theoreticalJointPMFs[model.id] = parsedModelPMF;
        
        const mseMetrics: { [metricName: string]: number } = {};

        // Calculate single var, pairwise, and conditional for the model
        variables.forEach((v, i) => {
             const modelMarginalPMF = getMarginalPMF(parsedModelPMF, [i], numVars);
             single_vars[v.id].theoretical[model.id] = getSingleVarMetrics(modelMarginalPMF, v.type, v.ordinalOrder);
        });

        for (let i = 0; i < numVars; i++) {
            for (let j = i + 1; j < numVars; j++) {
                const var1 = variables[i];
                const var2 = variables[j];
                const pairKey = [var1.id, var2.id].sort().join('-');

                const modelPairPMF = getMarginalPMF(parsedModelPMF, [i, j], numVars);
                const modelMarginal1 = getMarginalPMF(parsedModelPMF, [i], numVars);
                const modelMarginal2 = getMarginalPMF(parsedModelPMF, [j], numVars);
                
                const pairResult = pairwise.find(p => p.var1_id === var1.id && p.var2_id === var2.id);
                if (pairResult) {
                     const isVar1Categorical = var1.type === VariableType.Nominal || var1.type === VariableType.Ordinal;
                     const isVar2Categorical = var2.type === VariableType.Nominal || var2.type === VariableType.Ordinal;
                     
                     // Need to get model data to calculate Cramer's V. This is complex.
                     // For now, only calculating MI for theoretical models.
                    pairResult.theoretical[model.id] = {
                        mutualInformation: calculateMutualInformation(modelPairPMF, modelMarginal1, modelMarginal2),
                    };
                }
                
                if (conditional[pairKey]) {
                   conditional[pairKey].theoretical[model.id] = getConditionalDistributions(modelPairPMF, modelMarginal1, modelMarginal2, var1, var2);
                }
            }
        }
        
        // --- MSE Calculations ---

        // Single-variable MSE for numerical variables
        variables.forEach(v => {
            if (v.type === VariableType.Numerical) {
                const empiricalMetrics = single_vars[v.id].empirical;
                const modelMetrics = single_vars[v.id].theoretical[model.id];
                if (empiricalMetrics.mean !== undefined && modelMetrics.mean !== undefined && modelMetrics.variance !== undefined) {
                    const bias = modelMetrics.mean - empiricalMetrics.mean;
                    const mse = modelMetrics.variance + (bias * bias);
                    mseMetrics[`MSE: ${v.name}`] = mse;
                }
            }
        });

        // Conditional MSE (Numerical | Categorical)
        for (let i = 0; i < numVars; i++) {
            for (let j = 0; j < numVars; j++) {
                if (i === j) continue;
                
                const targetVar = variables[i];
                const givenVar = variables[j];
                
                const isTargetNumerical = targetVar.type === VariableType.Numerical;
                const isGivenCategorical = givenVar.type === VariableType.Nominal || givenVar.type === VariableType.Ordinal;

                if (isTargetNumerical && isGivenCategorical) {
                    const pairKey = [targetVar.id, givenVar.id].sort().join('-');
                    const modelConditionals = conditional[pairKey]?.theoretical[model.id]?.[givenVar.name];
                    const empiricalMarginal = single_vars[givenVar.id].empirical.pmf;
                    
                    if (!modelConditionals || !empiricalMarginal) continue;

                    const predictions = new Map<string, number>(); // conditionValue -> predictedMean
                    modelConditionals.forEach(cond => {
                        if (cond.mean !== undefined) predictions.set(cond.conditionValue, cond.mean);
                    });
                    
                    const squaredErrorsByCondition: { [condition: string]: number[] } = {};
                    
                    for (let k = 0; k < targetVar.data.length; k++) {
                        const trueValue = Number(targetVar.data[k]);
                        const conditionValue = givenVar.data[k];
                        const predictedValue = predictions.get(conditionValue);
                        
                        if (!isNaN(trueValue) && predictedValue !== undefined) {
                            const sqError = Math.pow(trueValue - predictedValue, 2);
                            if (!squaredErrorsByCondition[conditionValue]) {
                                squaredErrorsByCondition[conditionValue] = [];
                            }
                            squaredErrorsByCondition[conditionValue].push(sqError);
                        }
                    }
                    
                    let cumulativeMSE = 0;
                    
                    Object.entries(squaredErrorsByCondition).forEach(([condition, errors]) => {
                        if (errors.length > 0) {
                            const mse = errors.reduce((a, b) => a + b, 0) / errors.length;
                            const perConditionMetricName = `MSE: ${targetVar.name} | ${givenVar.name}=${condition}`;
                            mseMetrics[perConditionMetricName] = mse;
                            
                            const marginalProb = empiricalMarginal.find(p => p.value == condition)?.probability || 0;
                            cumulativeMSE += mse * marginalProb;
                        }
                    });
                    
                    if (cumulativeMSE > 0) {
                        const metricName = `Cumulative MSE (${targetVar.name} | ${givenVar.name})`;
                        mseMetrics[metricName] = cumulativeMSE;
                    }
                }
            }
        }

        modelFit.push({
            modelName: model.name,
            hellingerDistance: calculateHellingerDistance(empiricalJointPMF, parsedModelPMF),
            jensenShannonDistance: Math.sqrt(calculateGeneralizedJensenShannonDivergence([empiricalJointPMF, parsedModelPMF])),
            mse: mseMetrics
        });
    });
    
    return { variables, single_vars, pairwise, modelFit, conditional, empiricalJointPMF, theoreticalJointPMFs };
};


// --- TIME SERIES ANALYSIS ---

/**
 * Checks if the input data format matches the time-series criteria.
 * Criteria: First column is 'Time', subsequent columns are 'Instance1', 'Instance2', etc. (case-insensitive).
 */
export const detectAnalysisType = (text: string): 'time-series' | 'cross-sectional' => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return 'cross-sectional';

    const header = lines[0].split(',').map(h => h.trim().toLowerCase());
    if (header.length < 2) return 'cross-sectional';

    if (header[0] !== 'time') return 'cross-sectional';

    for (let i = 1; i < header.length; i++) {
        if (!header[i].startsWith('instance')) {
             return 'cross-sectional';
        }
    }

    return 'time-series';
};

const calculateTPM = (
    timeLabels: string[],
    instanceData: string[][],
    stateSpace: string[],
    timeIndex: number, // The index of the 'to' state
    order: number
): TPM => {
    const tpm: TPM = new Map();
    const fromStateCounts: Map<string, number> = new Map();
    const jointCounts: Map<string, Map<string, number>> = new Map();

    const numInstances = instanceData.length;
    
    if (timeIndex < order) return tpm; // Not enough history

    for (let i = 0; i < numInstances; i++) {
        const fromStateParts: string[] = [];
        for (let j = order; j > 0; j--) {
            fromStateParts.push(instanceData[i][timeIndex - j]);
        }
        const fromState = fromStateParts.join(',');
        const toState = instanceData[i][timeIndex];

        // Increment counts
        fromStateCounts.set(fromState, (fromStateCounts.get(fromState) || 0) + 1);
        if (!jointCounts.has(fromState)) {
            jointCounts.set(fromState, new Map());
        }
        const toCounts = jointCounts.get(fromState)!;
        toCounts.set(toState, (toCounts.get(toState) || 0) + 1);
    }
    
    // Calculate probabilities
    for (const [fromState, totalCount] of fromStateCounts.entries()) {
        if (totalCount > 0) {
            const toDist = new Map<string, number>();
            const toCounts = jointCounts.get(fromState)!;
            for (const toState of stateSpace) {
                const prob = (toCounts.get(toState) || 0) / totalCount;
                toDist.set(toState, prob);
            }
            tpm.set(fromState, toDist);
        }
    }
    return tpm;
};

const calculateHellingerDistanceTPM = (tpm1: TPM, tpm2: TPM): number => {
    const fromStates = new Set([...tpm1.keys(), ...tpm2.keys()]);
    const toStates = new Set<string>();
    for (const fromState of fromStates) {
        tpm1.get(fromState)?.forEach((_, toState) => toStates.add(toState));
        tpm2.get(fromState)?.forEach((_, toState) => toStates.add(toState));
    }
    const sortedFromStates = [...fromStates].sort();
    const sortedToStates = [...toStates].sort();

    if (sortedFromStates.length === 0 || sortedToStates.length === 0) return 0;

    const p: number[] = [];
    const q: number[] = [];
    for (const fromState of sortedFromStates) {
        for (const toState of sortedToStates) {
            p.push(tpm1.get(fromState)?.get(toState) || 0);
            q.push(tpm2.get(fromState)?.get(toState) || 0);
        }
    }

    let sumOfSquaredDiffs = 0;
    for (let i = 0; i < p.length; i++) {
        sumOfSquaredDiffs += Math.pow(Math.sqrt(p[i]) - Math.sqrt(q[i]), 2);
    }

    return (1 / Math.sqrt(2)) * Math.sqrt(sumOfSquaredDiffs);
};

// --- New GJS Divergence implementation based on user's MATLAB code ---

// Helper to convert a TPM to a single, normalized joint PMF over (from, to) states.
const tpmToJointPmf = (tpm: TPM, allFromStates: string[], allToStates: string[]): JointPMF => {
    const pmf: JointPMF = new Map();
    let totalProb = 0;
    
    for(const fromState of allFromStates) {
        for(const toState of allToStates) {
            const prob = tpm.get(fromState)?.get(toState) || 0;
            if(prob > 0) {
                 pmf.set(`${fromState},${toState}`, prob);
                 totalProb += prob;
            }
        }
    }
    
    // This assumes the rows of the TPM sum to 1. The total sum is the number of rows.
    // To treat it as a single joint distribution, we normalize by the number of 'from' states.
    if (allFromStates.length > 0) {
        const numFromStates = allFromStates.length;
        for (const [key, prob] of pmf.entries()) {
            pmf.set(key, prob / numFromStates);
        }
    }
    
    return pmf;
};

const calculateGJS_TPM_Distance_normalized = (tpms: TPM[]): number => {
    const n = tpms.length;
    if (n < 2) return 0;

    // 1. Define the complete state space to ensure all matrices are comparable.
    const allFromStates = new Set<string>();
    const allToStates = new Set<string>();
    tpms.forEach(tpm => {
        tpm.forEach((dist, fromState) => {
            allFromStates.add(fromState);
            dist.forEach((_, toState) => allToStates.add(toState));
        });
    });
    const fromStateList = [...allFromStates].sort();
    const toStateList = [...allToStates].sort();
    
    // 2. Convert each TPM to a normalized joint PMF.
    const pmfs = tpms.map(tpm => tpmToJointPmf(tpm, fromStateList, toStateList));

    // 3. Calculate divergence using the new generalized function.
    const divergence_bits = calculateGeneralizedJensenShannonDivergence(pmfs);

    // 4. Calculate normalized GJS Divergence.
    const JSD_norm_divergence = divergence_bits / Math.log2(n);
    const clamped_divergence = Math.min(Math.max(JSD_norm_divergence, 0), 1);
    
    // 5. Return the distance, which is the square root of the normalized divergence.
    return Math.sqrt(clamped_divergence);
};


const runHomogeneityCheck = (tpms: {tpm: TPM, label: string}[]): { hellingerDistances: HellingerResult[], gjsDistance: number, isHomogeneous: boolean } => {
    if (tpms.length < 2) {
        return { hellingerDistances: [], gjsDistance: 0, isHomogeneous: true };
    }

    const hellingerDistances: HellingerResult[] = [];
    for (let i = 0; i < tpms.length; i++) {
        for (let j = i + 1; j < tpms.length; j++) {
            const dist = calculateHellingerDistanceTPM(tpms[i].tpm, tpms[j].tpm);
            hellingerDistances.push({ pair: `${tpms[i].label} vs ${tpms[j].label}`, distance: dist });
        }
    }

    const gjsDistance = calculateGJS_TPM_Distance_normalized(tpms.map(t => t.tpm));
    
    // NOTE: The 0.5 threshold for homogeneity is a heuristic. For rigorous scientific
    // applications, this might be replaced with a formal statistical test (e.g., Chi-squared test)
    // or a user-configurable sensitivity level. It is applied to both Hellinger and JS distances.
    const isHomogeneous = hellingerDistances.every(r => r.distance <= 0.5) && gjsDistance <= 0.5;

    return { hellingerDistances, gjsDistance, isHomogeneous };
};


export const performTimeSeriesAnalysis = (text: string): TimeSeriesAnalysisResults => {
    const lines = text.trim().split('\n');
    const header = lines[0].split(',').map(h => h.trim());
    const dataRows = lines.slice(1);

    const timeLabels = dataRows.map(row => row.split(',')[0].trim());
    const instanceData: string[][] = []; // This will be structured as: numInstances x numTimeSteps
    const numInstances = header.length - 1;
    const numTimeSteps = timeLabels.length;

    for (let i = 0; i < numInstances; i++) {
        instanceData.push(dataRows.map(row => row.split(',')[i + 1].trim()));
    }
    const stateSpace = [...new Set(instanceData.flat())].sort();
    
    const tpms_firstOrder: { tpm: TPM; label: string }[] = [];
    for (let t = 1; t < numTimeSteps; t++) {
        tpms_firstOrder.push({
            tpm: calculateTPM(timeLabels, instanceData, stateSpace, t, 1),
            label: `P(${timeLabels[t]}|${timeLabels[t-1]})`
        });
    }
    
    const homogeneityCheck = runHomogeneityCheck(tpms_firstOrder);
    
    const allFromStates = new Set<string>();
    const allToStates = new Set<string>(stateSpace);
    tpms_firstOrder.forEach(({tpm}) => tpm.forEach((_, fromState) => allFromStates.add(fromState)));
    
    const average_tpm: TPM = new Map();
    for(const fromState of allFromStates) {
        const avgDist = new Map<string, number>();
        for (const toState of allToStates) {
            let sumProb = 0;
            tpms_firstOrder.forEach(({tpm}) => {
                sumProb += tpm.get(fromState)?.get(toState) || 0;
            });
            avgDist.set(toState, sumProb / tpms_firstOrder.length);
        }
        average_tpm.set(fromState, avgDist);
    }
    const average_tpm_firstOrder = { tpm: average_tpm, label: 'Average 1st Order TPM' };
    
    const fullHistoryPMF: JointPMF = new Map();
    for (let i = 0; i < numInstances; i++) {
        const sequence = instanceData[i].join(',');
        fullHistoryPMF.set(sequence, (fullHistoryPMF.get(sequence) || 0) + 1);
    }
    for (const [seq, count] of fullHistoryPMF.entries()) {
        fullHistoryPMF.set(seq, count / numInstances);
    }

    const representativeTPM = homogeneityCheck.isHomogeneous 
        ? (tpms_firstOrder[0]?.tpm || new Map())
        : average_tpm_firstOrder.tpm;

    const initialStatePMF: JointPMF = new Map();
    for(let i=0; i < numInstances; i++) {
        const initialState = instanceData[i][0];
        initialStatePMF.set(initialState, (initialStatePMF.get(initialState) || 0) + 1);
    }
    for(const [state, count] of initialStatePMF.entries()) {
        initialStatePMF.set(state, count / numInstances);
    }

    const markovApproximationPMF: JointPMF = new Map();
    for (const sequence of fullHistoryPMF.keys()) {
        const states = sequence.split(',');
        if (states.length === 0) continue;
        
        let probability = initialStatePMF.get(states[0]) || 0;
        
        for (let t = 1; t < states.length; t++) {
            const fromState = states[t-1];
            const toState = states[t];
            const transitionProb = representativeTPM.get(fromState)?.get(toState) || 0;
            probability *= transitionProb;
        }
        markovApproximationPMF.set(sequence, probability);
    }

    const hellingerDistance = calculateHellingerDistance(fullHistoryPMF, markovApproximationPMF);
    const jensenShannonDistance = Math.sqrt(calculateGeneralizedJensenShannonDivergence([fullHistoryPMF, markovApproximationPMF]));

    const markovianFit = {
        fullHistoryPMF,
        markovApproximationPMF,
        initialStatePMF,
        hellingerDistance,
        jensenShannonDistance,
    };

    const tpm_fullHistory = {
        tpm: calculateTPM(timeLabels, instanceData, stateSpace, numTimeSteps - 1, numTimeSteps - 1),
        label: `P(${timeLabels[numTimeSteps-1]}|...${timeLabels[0]})`
    };

    const weakStationarity = {
        mean: [] as number[],
        variance: [] as number[],
        timeLabels: timeLabels,
    };
    for (let t = 0; t < numTimeSteps; t++) {
        const valuesAtTimeT = instanceData.map(instance => Number(instance[t])).filter(v => !isNaN(v));
        if (valuesAtTimeT.length > 0) {
            const mean = valuesAtTimeT.reduce((a, b) => a + b, 0) / valuesAtTimeT.length;
            const variance = valuesAtTimeT.length > 1 
                ? valuesAtTimeT.reduce((a, v) => a + Math.pow(v - mean, 2), 0) / (valuesAtTimeT.length - 1) // Using sample variance
                : 0;
            weakStationarity.mean.push(mean);
            weakStationarity.variance.push(variance);
        } else {
            weakStationarity.mean.push(NaN);
            weakStationarity.variance.push(NaN);
        }
    }
    
    return {
        isHomogeneous: homogeneityCheck.isHomogeneous,
        homogeneityMetrics: { hellingerDistances: homogeneityCheck.hellingerDistances, gjsDistance: homogeneityCheck.gjsDistance },
        markovianFit,
        tpms_firstOrder,
        tpm_fullHistory,
        average_tpm_firstOrder,
        weakStationarity,
        stateSpace,
    };
};